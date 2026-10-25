import prisma from '@/lib/prisma'
import { getOrSetCache, invalidateCache } from '@/lib/cache'
import { apiGuard, assertSameOrigin, noStoreJson, resolveDepartmentScope } from '@/lib/auth/guards'
import { ISSUE_ROLES } from '@/lib/auth/roles'
import { IssuePurpose } from '@/generated/prisma/client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type IssueSeqResult = {
  issue_id: number | bigint
}

class IssueHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function POST(req: Request) {
  const auth = await apiGuard(ISSUE_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const body = await req.json()
    const {
      itemCode,
      batchNo,
      qty,
      deptId: requestedDeptId,
      authorisedByUserId,
      purpose,
      specificLocation,
      notes,
    } = body
    const quantity = Number(qty || 0)
    if (!itemCode || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
    }

    const it = await prisma.item.findFirst({ where: { itemCode } })
    if (!it) return NextResponse.json({ error: 'item not found' }, { status: 404 })

    let targetDeptId: number
    if (auth.user.role === 'hod') {
      if (!auth.user.deptId) {
        return NextResponse.json({ error: 'No department assigned to this HOD account' }, { status: 403 })
      }
      targetDeptId = auth.user.deptId
    } else {
      const parsedDeptId = Number(requestedDeptId)
      if (!Number.isInteger(parsedDeptId) || parsedDeptId <= 0) {
        return NextResponse.json({ error: 'deptId is required' }, { status: 400 })
      }
      targetDeptId = parsedDeptId
    }

    const dept = await prisma.department.findFirst({
      where: { deptId: targetDeptId, isActive: true },
      select: { deptId: true },
    })
    if (!dept) {
      return NextResponse.json({ error: 'department not found or inactive' }, { status: 400 })
    }

    let authoriserId: number
    if (auth.user.role === 'hod') {
      authoriserId = auth.user.userId
    } else {
      const parsedAuthoriserId = Number(authorisedByUserId)
      if (!Number.isInteger(parsedAuthoriserId) || parsedAuthoriserId <= 0) {
        return NextResponse.json({ error: 'authorisedByUserId is required' }, { status: 400 })
      }
      const authoriser = await prisma.user.findFirst({
        where: {
          userId: parsedAuthoriserId,
          role: 'hod',
          isActive: true,
          deptId: targetDeptId,
        },
        select: { userId: true },
      })
      if (!authoriser) {
        return NextResponse.json(
          { error: 'Authoriser must be an active HOD of the target department' },
          { status: 400 }
        )
      }
      authoriserId = authoriser.userId
    }

    const result = await prisma.$transaction(async (tx) => {
      let batch = null
      if (batchNo) {
        batch = await tx.itemBatch.findFirst({ where: { itemId: it.itemId, batchNumber: batchNo } })
        if (!batch) throw new IssueHttpError('batch not found for this item', 400)
        if (Number(batch.quantityAvailable || 0) < quantity) {
          throw new IssueHttpError('insufficient quantity in selected batch', 409)
        }
      } else {
        batch = await tx.itemBatch.findFirst({
          where: { itemId: it.itemId, quantityAvailable: { gte: quantity } },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        })
        if (!batch) throw new IssueHttpError('no batch has enough stock for this quantity', 409)
      }

      const stockAgg = await tx.itemBatch.aggregate({
        where: { itemId: it.itemId },
        _sum: { quantityAvailable: true },
      })
      const stockBefore = Number(stockAgg._sum.quantityAvailable || 0)
      const stockAfter = stockBefore - quantity

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
          deptId: targetDeptId,
          quantityIssued: quantity,
          unit: it.unit || '',
          specificLocation: specificLocation ?? '',
          authorisedBy: authoriserId,
          issuedBy: auth.user.userId,
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
    if (err instanceof IssueHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/issue error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function fetchStockIssues(deptId: number | null) {
  const rows = await prisma.stockIssue.findMany({
    where: deptId ? { deptId } : undefined,
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
  const auth = await apiGuard(ISSUE_ROLES)
  if (auth.response) return auth.response

  const scope = resolveDepartmentScope(auth.user)
  if (!scope) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const mapped = await getOrSetCache(
      `api:issue:list:${scope.cacheScope}`,
      () => fetchStockIssues(scope.deptId),
      15,
      ['issue']
    )

    return noStoreJson(mapped)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/issue error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
