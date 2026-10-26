import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import {
  DEMAND_FULFIL_ROLES,
  DEMAND_REVIEW_ROLES,
  DEMAND_ROLES,
} from '@/lib/auth/roles'
import { writeAudit } from '@/lib/auth/audit'
import { demandInclude, demandVisibilityWhere, serializeDemand } from '@/lib/demand'
import { AuditAction, type Prisma } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const ACTIONS = ['approve', 'reject', 'fulfil', 'cancel'] as const
type DemandAction = (typeof ACTIONS)[number]

const ACTION_LABELS: Record<DemandAction, string> = {
  approve: 'approved',
  reject: 'rejected',
  fulfil: 'fulfilled',
  cancel: 'cancelled',
}

class DemandHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(DEMAND_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const { id } = await params
    const requestId = Number(id)
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return noStoreJson({ error: 'Invalid request id' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const action = typeof body?.action === 'string' ? body.action : ''
    if (!(ACTIONS as readonly string[]).includes(action)) {
      return noStoreJson({ error: 'Invalid action' }, { status: 400 })
    }
    const demandAction = action as DemandAction

    const notes = typeof body?.notes === 'string' ? body.notes.trim() : ''
    if (notes.length > 1000) {
      return noStoreJson({ error: 'Notes must be 1000 characters or fewer' }, { status: 400 })
    }
    if (demandAction === 'reject' && !notes) {
      return noStoreJson({ error: 'A reason is required when rejecting a request' }, { status: 400 })
    }

    const scope = demandVisibilityWhere(auth.user)
    if (!scope) {
      return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
    }

    const existing = await prisma.demandRequest.findFirst({
      where: { requestId, ...scope },
      select: {
        requestId: true,
        requestNumber: true,
        status: true,
        deptId: true,
        requestedBy: true,
      },
    })
    if (!existing) {
      return noStoreJson({ error: 'Demand request not found' }, { status: 404 })
    }

    if (demandAction === 'approve' || demandAction === 'reject') {
      if (!DEMAND_REVIEW_ROLES.includes(auth.user.role)) {
        return noStoreJson({ error: 'Forbidden' }, { status: 403 })
      }
      if (auth.user.role === 'hod' && existing.requestedBy === auth.user.userId) {
        return noStoreJson({ error: 'You cannot review your own demand request' }, { status: 403 })
      }
      if (existing.status !== 'pending') {
        return noStoreJson({ error: 'Only pending requests can be reviewed' }, { status: 409 })
      }
    } else if (demandAction === 'fulfil') {
      if (!DEMAND_FULFIL_ROLES.includes(auth.user.role)) {
        return noStoreJson({ error: 'Forbidden' }, { status: 403 })
      }
      if (existing.status !== 'approved') {
        return noStoreJson({ error: 'Only approved requests can be fulfilled' }, { status: 409 })
      }
    } else {
      const isOwner = existing.requestedBy === auth.user.userId
      const isOversight = auth.user.role === 'admin' || auth.user.role === 'super_admin'
      if (!isOwner && !isOversight) {
        return noStoreJson({ error: 'Forbidden' }, { status: 403 })
      }
      if (existing.status !== 'pending') {
        return noStoreJson({ error: 'Only pending requests can be cancelled' }, { status: 409 })
      }
    }

    const now = new Date()
    const data: Prisma.DemandRequestUncheckedUpdateManyInput = {}

    if (demandAction === 'approve') {
      data.status = 'approved'
      data.reviewedBy = auth.user.userId
      data.reviewedAt = now
      data.reviewNotes = notes || null
    } else if (demandAction === 'reject') {
      data.status = 'rejected'
      data.reviewedBy = auth.user.userId
      data.reviewedAt = now
      data.reviewNotes = notes
    } else if (demandAction === 'fulfil') {
      data.status = 'fulfilled'
      data.fulfilledBy = auth.user.userId
      data.fulfilledAt = now
    } else {
      data.status = 'cancelled'
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.demandRequest.updateMany({
        where: { requestId, status: existing.status },
        data,
      })
      if (result.count !== 1) {
        throw new DemandHttpError('Request was updated by someone else. Reload and try again.', 409)
      }
      return tx.demandRequest.findUniqueOrThrow({
        where: { requestId },
        include: demandInclude,
      })
    })

    await writeAudit({
      tableName: 'demand_requests',
      recordId: requestId,
      action: AuditAction.UPDATE,
      changedBy: auth.user.userId,
      oldValues: { status: existing.status },
      newValues: { status: updated.status, notes: notes || undefined },
      notes: `Demand request ${ACTION_LABELS[demandAction]}`,
    })

    return noStoreJson({ request: serializeDemand(updated) })
  } catch (err: unknown) {
    if (err instanceof DemandHttpError) {
      return noStoreJson({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('PATCH /api/demands/[id] error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
