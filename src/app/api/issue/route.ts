import prisma from '@/lib/prisma'
import { getOrSetCache, invalidateCache } from '@/lib/cache'
import { IssuePurpose } from '@/generated/prisma/client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type IssueSeqResult = {
  issue_id: number | bigint
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { itemCode, batchNo, qty, deptCode, authorisedBy, issuedBy, purpose, specificLocation, notes } = body
    const quantity = Number(qty || 0)
    if (!itemCode || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
    }

    const it = await prisma.item.findFirst({ where: { itemCode } })
    if (!it) return NextResponse.json({ error: 'item not found' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      let batch = null
      if (batchNo) {
        batch = await tx.itemBatch.findFirst({ where: { itemId: it.itemId, batchNumber: batchNo } })
      } else {
        batch = await tx.itemBatch.findFirst({
          where: { itemId: it.itemId, quantityAvailable: { gte: quantity } },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        })
      }
      if (!batch) throw new Error('suitable batch not found or insufficient quantity')

      const stockAgg = await tx.itemBatch.aggregate({
        where: { itemId: it.itemId },
        _sum: { quantityAvailable: true },
      })
      const stockBefore = Number(stockAgg._sum.quantityAvailable || 0)
      const stockAfter = stockBefore - quantity

      let deptId: number | null = null
      if (deptCode) {
        const d = await tx.department.findFirst({ where: { OR: [{ deptCode }, { deptName: deptCode }] } })
        if (d) deptId = d.deptId
      }
      if (!deptId) deptId = it.primaryDeptId

      let authId = null
      if (authorisedBy) {
        const u = await tx.user.findFirst({ where: { fullName: authorisedBy } })
        authId = u ? u.userId : (await tx.user.findFirst())?.userId ?? 1
      }
      let issuedId = null
      if (issuedBy) {
        const u = await tx.user.findFirst({ where: { fullName: issuedBy } })
        issuedId = u ? u.userId : (await tx.user.findFirst())?.userId ?? 1
      }

      const batchQtyBefore = Number(batch.quantityAvailable || 0)
      const batchQtyAfter = batchQtyBefore - quantity
      const updatedBatch = await tx.itemBatch.update({
        where: { batchId: batch.batchId },
        data: { quantityAvailable: batchQtyAfter },
      })

      const purposeMap: Record<string, IssuePurpose> = {
        'Patient dispensing — OPD': IssuePurpose.patient_opd,
        'Patient dispensing — IPD': IssuePurpose.patient_ipd,
        'Department restocking': IssuePurpose.dept_restock,
        'Panchakarma therapy': IssuePurpose.panchakarma,
        'Research / study': IssuePurpose.research,
        'Quality testing': IssuePurpose.quality_test,
        'Other': IssuePurpose.other,
      }
      const purposeEnum = purposeMap[String(purpose || '')] || IssuePurpose.other

      const seqRes = await tx.$queryRaw<IssueSeqResult[]>`SELECT nextval('stock_issues_issue_id_seq') as issue_id`
      const issueId = Number(seqRes[0]?.issue_id ?? 0)
      const issueNumber = `ISSUE-${new Date().getFullYear()}-${issueId.toString().padStart(4, '0')}`

      const created = await tx.stockIssue.create({
        data: {
          issueId,
          issueNumber,
          itemId: it.itemId,
          batchId: batch.batchId,
          deptId: deptId as number,
          quantityIssued: quantity,
          unit: it.unit || '',
          specificLocation: specificLocation ?? '',
          authorisedBy: authId ?? 1,
          issuedBy: issuedId ?? 1,
          purpose: purposeEnum,
          stockBefore,
          stockAfter,
          batchQtyBefore,
          batchQtyAfter,
          notes: notes ?? '',
        },
      })

      return { created, updatedBatch }
    })

    // Invalidate caches affected by stock issue
    invalidateCache('dashboard', 'registry', 'capex', 'opex', 'items', 'issue', 'consumption')

    return NextResponse.json({ ok: true, issue: result.created, batch: result.updatedBatch })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/issue error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function fetchStockIssues() {
  const rows = await prisma.stockIssue.findMany({
    orderBy: { issueDate: 'desc' },
    take: 200,
    include: {
      item: { select: { itemName: true, category: true, itemCode: true } },
      batch: { select: { batchNumber: true } },
      department: { select: { deptName: true, deptCode: true } },
      authoriser: { select: { fullName: true } },
    },
  })

  return rows.map((r) => ({
    iss: r.issueNumber,
    date: r.issueDate
      ? r.issueDate.toISOString()
      : r.createdAt
      ? r.createdAt.toISOString()
      : new Date().toISOString(),
    item: r.item?.itemName ?? String(r.itemId),
    cat: r.item?.category ?? 'OPEX',
    batch: r.batch?.batchNumber ?? '',
    qty: `${Number(r.quantityIssued || 0)} ${r.unit || ''}`,
    dept: r.department?.deptName ?? '',
    auth: r.authoriser?.fullName ?? '',
    purpose: String(r.purpose || ''),
  }))
}

export async function GET() {
  try {
    const mapped = await getOrSetCache(
      'api:issue:list',
      () => fetchStockIssues(),
      15,
      ['issue']
    )

    return NextResponse.json(mapped, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/issue error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
