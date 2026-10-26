import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { ROLES } from '@/lib/auth/roles'
import { writeAudit } from '@/lib/auth/audit'
import { AuditAction, IssuePurpose } from '@/generated/prisma/client'
import { invalidateCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

interface DepartmentHoldingItem {
  itemId: number
  itemCode: string
  itemName: string
  category: string
  subCategory: string | null
  unit: string
  deptId: number
  deptName: string
  deptCode: string
  totalIssued: number
  firstIssuedAt: string | null
  lastIssuedAt: string | null
  records: {
    type: 'DEMAND_FULFILLED' | 'STOCK_ISSUE'
    referenceNumber: string
    quantity: number
    date: string
    authorizedBy: string
    purpose?: string
    notes?: string
  }[]
}

export async function GET(req: Request) {
  const auth = await apiGuard(ROLES)
  if (auth.response) return auth.response

  const { user } = auth
  const url = new URL(req.url)
  const reqDeptId = url.searchParams.get('deptId')
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const categoryFilter = url.searchParams.get('category') || 'ALL'

  // Determine authorized department scope
  let effectiveDeptId: number | null = null
  if (user.role === 'hod' || user.role === 'requester') {
    if (!user.deptId) {
      return noStoreJson({ error: 'No department assigned to your account' }, { status: 403 })
    }
    effectiveDeptId = user.deptId
  } else if (reqDeptId && reqDeptId !== 'all') {
    const parsed = Number(reqDeptId)
    if (Number.isInteger(parsed) && parsed > 0) {
      effectiveDeptId = parsed
    }
  }

  try {
    // 1. Fetch available departments list
    const departments = await prisma.department.findMany({
      where: effectiveDeptId && (user.role === 'hod' || user.role === 'requester')
        ? { deptId: effectiveDeptId, isActive: true }
        : { isActive: true },
      orderBy: { deptName: 'asc' },
      select: { deptId: true, deptCode: true, deptName: true, floorLocation: true },
    })

    // 2. Fetch all Fulfilled Demands (with items) for the scoped department(s)
    const fulfilledDemands = await prisma.demandRequest.findMany({
      where: {
        status: { in: ['fulfilled', 'approved'] },
        ...(effectiveDeptId ? { deptId: effectiveDeptId } : {}),
      },
      orderBy: { fulfilledAt: 'desc' },
      include: {
        department: { select: { deptId: true, deptCode: true, deptName: true } },
        requester: { select: { fullName: true } },
        adminApprover: { select: { fullName: true } },
        items: {
          include: {
            item: {
              select: {
                itemId: true,
                itemCode: true,
                itemName: true,
                category: true,
                subCategory: true,
                unit: true,
              },
            },
          },
        },
      },
    })

    // 3. Fetch all Stock Issues for the scoped department(s)
    const stockIssues = await prisma.stockIssue.findMany({
      where: effectiveDeptId ? { deptId: effectiveDeptId } : undefined,
      orderBy: { issueDate: 'desc' },
      include: {
        department: { select: { deptId: true, deptCode: true, deptName: true } },
        item: {
          select: {
            itemId: true,
            itemCode: true,
            itemName: true,
            category: true,
            subCategory: true,
            unit: true,
          },
        },
        authoriser: { select: { fullName: true } },
        batch: { select: { batchNumber: true } },
      },
    })

    // 4. Aggregate into Department Holdings Map
    const holdingsMap = new Map<string, DepartmentHoldingItem>()

    // Process fulfilled demands
    for (const demand of fulfilledDemands) {
      const dateStr = (demand.fulfilledAt || demand.updatedAt || demand.createdAt).toISOString()
      const authorizer = demand.adminApprover?.fullName || 'Inventory Admin'
      for (const line of demand.items) {
        if (!line.item) continue
        const key = `${demand.deptId}-${line.item.itemId}`
        const qty = Number(line.quantity || 0)
        let existing = holdingsMap.get(key)
        if (!existing) {
          existing = {
            itemId: line.item.itemId,
            itemCode: line.item.itemCode,
            itemName: line.item.itemName,
            category: line.item.category,
            subCategory: line.item.subCategory,
            unit: line.unit || line.item.unit || 'nos',
            deptId: demand.department.deptId,
            deptName: demand.department.deptName,
            deptCode: demand.department.deptCode,
            totalIssued: 0,
            firstIssuedAt: dateStr,
            lastIssuedAt: dateStr,
            records: [],
          }
          holdingsMap.set(key, existing)
        }

        existing.totalIssued += qty
        if (new Date(dateStr) > new Date(existing.lastIssuedAt || 0)) {
          existing.lastIssuedAt = dateStr
        }
        if (new Date(dateStr) < new Date(existing.firstIssuedAt || dateStr)) {
          existing.firstIssuedAt = dateStr
        }

        existing.records.push({
          type: 'DEMAND_FULFILLED',
          referenceNumber: demand.requestNumber,
          quantity: qty,
          date: dateStr,
          authorizedBy: authorizer,
          purpose: demand.justification || 'Department Demand Requisition',
          notes: line.notes || demand.reviewNotes || undefined,
        })
      }
    }

    // Process stock issues
    for (const issue of stockIssues) {
      if (!issue.item) continue
      const key = `${issue.deptId}-${issue.item.itemId}`
      const qty = Number(issue.quantityIssued || 0)
      const dateStr = (issue.issueDate || issue.createdAt || new Date()).toISOString()
      const authorizer = issue.authoriser?.fullName || 'Authorized Staff'
      let existing = holdingsMap.get(key)
      if (!existing) {
        existing = {
          itemId: issue.item.itemId,
          itemCode: issue.item.itemCode,
          itemName: issue.item.itemName,
          category: issue.item.category,
          subCategory: issue.item.subCategory,
          unit: issue.unit || issue.item.unit || 'nos',
          deptId: issue.department.deptId,
          deptName: issue.department.deptName,
          deptCode: issue.department.deptCode,
          totalIssued: 0,
          firstIssuedAt: dateStr,
          lastIssuedAt: dateStr,
          records: [],
        }
        holdingsMap.set(key, existing)
      }

      existing.totalIssued += qty
      if (new Date(dateStr) > new Date(existing.lastIssuedAt || 0)) {
        existing.lastIssuedAt = dateStr
      }
      if (new Date(dateStr) < new Date(existing.firstIssuedAt || dateStr)) {
        existing.firstIssuedAt = dateStr
      }

      existing.records.push({
        type: 'STOCK_ISSUE',
        referenceNumber: issue.issueNumber,
        quantity: qty,
        date: dateStr,
        authorizedBy: authorizer,
        purpose: String(issue.purpose || 'Direct Stock Issue'),
        notes: issue.notes || undefined,
      })
    }

    // Convert to array and filter
    let holdings = Array.from(holdingsMap.values())

    if (categoryFilter !== 'ALL') {
      holdings = holdings.filter((h) => h.category.toUpperCase() === categoryFilter.toUpperCase())
    }

    if (q) {
      holdings = holdings.filter(
        (h) =>
          h.itemName.toLowerCase().includes(q) ||
          h.itemCode.toLowerCase().includes(q) ||
          h.deptName.toLowerCase().includes(q) ||
          h.deptCode.toLowerCase().includes(q)
      )
    }

    // Sort by last issued date descending
    holdings.sort((a, b) => new Date(b.lastIssuedAt || 0).getTime() - new Date(a.lastIssuedAt || 0).getTime())

    // Timeline of all individual allocations
    const timeline = []
    for (const h of holdings) {
      for (const rec of h.records) {
        timeline.push({
          ...rec,
          itemId: h.itemId,
          itemCode: h.itemCode,
          itemName: h.itemName,
          category: h.category,
          unit: h.unit,
          deptId: h.deptId,
          deptName: h.deptName,
          deptCode: h.deptCode,
        })
      }
    }
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // KPI Metrics
    const capexHoldings = holdings.filter((h) => h.category === 'CAPEX')
    const opexHoldings = holdings.filter((h) => h.category === 'OPEX')

    const kpi = {
      totalHoldingsCount: holdings.length,
      capexHoldingsCount: capexHoldings.length,
      capexTotalUnits: capexHoldings.reduce((acc, h) => acc + h.totalIssued, 0),
      opexHoldingsCount: opexHoldings.length,
      opexTotalUnits: opexHoldings.reduce((acc, h) => acc + h.totalIssued, 0),
      totalDispatchesCount: timeline.length,
    }

    return noStoreJson({
      departments,
      selectedDeptId: effectiveDeptId,
      kpi,
      holdings,
      timeline: timeline.slice(0, 150),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/department-issues error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await apiGuard(['super_admin', 'admin', 'hod'])
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const body = await req.json()
    const {
      itemCode,
      deptId: requestedDeptId,
      quantity,
      purpose,
      notes,
    } = body

    const qty = Number(quantity || 0)
    if (!itemCode || !Number.isFinite(qty) || qty <= 0) {
      return noStoreJson({ error: 'Valid itemCode and quantity (>0) are required' }, { status: 400 })
    }

    const item = await prisma.item.findUnique({
      where: { itemCode },
      select: { itemId: true, itemCode: true, itemName: true, unit: true, category: true },
    })
    if (!item) {
      return noStoreJson({ error: 'Item not found' }, { status: 404 })
    }

    let targetDeptId = Number(requestedDeptId)
    if (auth.user.role === 'hod') {
      if (!auth.user.deptId) {
        return noStoreJson({ error: 'No department assigned to this HOD' }, { status: 403 })
      }
      targetDeptId = auth.user.deptId
    }

    const dept = await prisma.department.findUnique({
      where: { deptId: targetDeptId },
      select: { deptId: true, deptName: true, deptCode: true },
    })
    if (!dept) {
      return noStoreJson({ error: 'Target department not found' }, { status: 404 })
    }

    // Check if batch exists with available stock
    const batch = await prisma.itemBatch.findFirst({
      where: { itemId: item.itemId, quantityAvailable: { gte: qty } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    })

    if (!batch) {
      const anyBatch = await prisma.itemBatch.findFirst({
        where: { itemId: item.itemId },
        orderBy: { createdAt: 'desc' },
      })
      if (!anyBatch) {
        return noStoreJson(
          { error: `No stock batch found for ${item.itemName} (${item.itemCode}). Inward stock via GRN first.` },
          { status: 400 }
        )
      }
      return noStoreJson(
        { error: `Insufficient stock for ${item.itemName}. Available in batch: ${anyBatch.quantityAvailable} ${item.unit || 'nos'}, Requested: ${qty}` },
        { status: 409 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const batchQtyBefore = Number(batch.quantityAvailable || 0)
      const batchQtyAfter = batchQtyBefore - qty

      await tx.itemBatch.update({
        where: { batchId: batch.batchId },
        data: { quantityAvailable: batchQtyAfter },
      })

      const seqRes = await tx.$queryRaw<{ issue_id: number | bigint }[]>`SELECT nextval('stock_issues_issue_id_seq') as issue_id`
      const issueId = Number(seqRes[0]?.issue_id ?? 0)
      const issueNumber = `ISSUE-${new Date().getFullYear()}-${issueId.toString().padStart(4, '0')}`

      const issue = await tx.stockIssue.create({
        data: {
          issueId,
          issueNumber,
          itemId: item.itemId,
          batchId: batch.batchId,
          deptId: targetDeptId,
          quantityIssued: qty,
          unit: item.unit || 'nos',
          specificLocation: `${dept.deptName}`,
          authorisedBy: auth.user.userId,
          issuedBy: auth.user.userId,
          purpose: IssuePurpose.dept_restock,
          stockBefore: batchQtyBefore,
          stockAfter: batchQtyAfter,
          batchQtyBefore,
          batchQtyAfter,
          notes: notes || `Direct internal allocation to ${dept.deptName}: ${purpose || 'Department use'}`,
        },
      })

      return issue
    })

    invalidateCache('dashboard', 'registry', 'capex', 'opex', 'items', 'issue')

    await writeAudit({
      tableName: 'stock_issues',
      recordId: result.issueId,
      action: AuditAction.CREATE,
      changedBy: auth.user.userId,
      newValues: { issueNumber: result.issueNumber, deptId: targetDeptId, qty },
      notes: `Direct internal issuance to department ${dept.deptCode}`,
    })

    return noStoreJson({ ok: true, issue: result, message: `Successfully issued ${qty} ${item.unit || 'nos'} to ${dept.deptName}` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/department-issues error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
