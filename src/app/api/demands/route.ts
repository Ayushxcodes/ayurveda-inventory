import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { DEMAND_CREATE_ROLES, DEMAND_ROLES } from '@/lib/auth/roles'
import { writeAudit } from '@/lib/auth/audit'
import {
  demandInclude,
  demandVisibilityWhere,
  parseDemandInput,
  serializeDemand,
} from '@/lib/demand'
import { AuditAction, type Prisma } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'] as const

export async function GET(req: Request) {
  const auth = await apiGuard(DEMAND_ROLES)
  if (auth.response) return auth.response

  const scope = demandVisibilityWhere(auth.user)
  if (!scope) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
    const statusParam = url.searchParams.get('status') ?? ''

    const where: Prisma.DemandRequestWhereInput = { ...scope }
    if ((STATUSES as readonly string[]).includes(statusParam)) {
      where.status = statusParam as (typeof STATUSES)[number]
    }
    if (q) {
      where.OR = [
        { requestNumber: { contains: q, mode: 'insensitive' } },
        { justification: { contains: q, mode: 'insensitive' } },
        { requester: { fullName: { contains: q, mode: 'insensitive' } } },
        { department: { deptName: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const rows = await prisma.demandRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: demandInclude,
    })

    return noStoreJson({ requests: rows.map(serializeDemand) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/demands error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await apiGuard(DEMAND_CREATE_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const body = await req.json().catch(() => null)
    const parsed = parseDemandInput(body)
    if (!parsed.ok) {
      return noStoreJson(
        { error: 'Please fix the highlighted fields', fields: parsed.errors },
        { status: 400 }
      )
    }

    let targetDeptId: number
    if (auth.user.role === 'hod' || auth.user.role === 'requester') {
      if (auth.user.deptId) {
        targetDeptId = auth.user.deptId
      } else if (auth.user.role === 'hod') {
        return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
      } else if (parsed.data.deptId) {
        targetDeptId = parsed.data.deptId
      } else {
        return noStoreJson(
          { error: 'Select a department for this request', fields: { deptId: 'Department is required.' } },
          { status: 400 }
        )
      }
    } else if (parsed.data.deptId) {
      targetDeptId = parsed.data.deptId
    } else {
      return noStoreJson(
        { error: 'Select a department for this request', fields: { deptId: 'Department is required.' } },
        { status: 400 }
      )
    }

    const dept = await prisma.department.findFirst({
      where: { deptId: targetDeptId, isActive: true },
      select: { deptId: true },
    })
    if (!dept) {
      return noStoreJson(
        { error: 'Department not found or inactive', fields: { deptId: 'Select an active department.' } },
        { status: 400 }
      )
    }

    const itemIds = parsed.data.items.map((line) => line.itemId)
    const itemRows = await prisma.item.findMany({
      where: { itemId: { in: itemIds }, isActive: true },
      select: { itemId: true, unit: true },
    })
    if (itemRows.length !== itemIds.length) {
      return noStoreJson(
        { error: 'One or more selected items are unavailable', fields: { items: 'Remove unavailable items.' } },
        { status: 400 }
      )
    }
    const units = new Map(itemRows.map((item) => [item.itemId, item.unit]))

    const created = await prisma.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ request_id: number | bigint }[]>`
        SELECT nextval(pg_get_serial_sequence('demand_requests', 'request_id')) AS request_id
      `
      const requestId = Number(seq[0]?.request_id ?? 0)
      if (!requestId) throw new Error('Failed to allocate demand request id')

      return tx.demandRequest.create({
        data: {
          requestId,
          requestNumber: `DEMAND-${new Date().getFullYear()}-${String(requestId).padStart(4, '0')}`,
          deptId: targetDeptId,
          requestedBy: auth.user.userId,
          neededBy: parsed.data.neededBy ? new Date(`${parsed.data.neededBy}T00:00:00.000Z`) : null,
          justification: parsed.data.justification,
          items: {
            create: parsed.data.items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              unit: units.get(line.itemId) ?? '',
              notes: line.notes,
            })),
          },
        },
        include: demandInclude,
      })
    })

    await writeAudit({
      tableName: 'demand_requests',
      recordId: created.requestId,
      action: AuditAction.CREATE,
      changedBy: auth.user.userId,
      newValues: {
        requestNumber: created.requestNumber,
        deptId: created.deptId,
        status: created.status,
        neededBy: created.neededBy,
        items: created.items.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity.toString(),
        })),
      },
      notes: 'Demand request raised',
    })

    return noStoreJson({ request: serializeDemand(created) }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/demands error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
