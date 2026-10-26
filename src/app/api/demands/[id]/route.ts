import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import {
  DEMAND_FULFIL_ROLES,
  DEMAND_ROLES,
} from '@/lib/auth/roles'
import { writeAudit } from '@/lib/auth/audit'
import { demandInclude, demandVisibilityWhere, serializeDemand } from '@/lib/demand'
import { AuditAction, type Prisma } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const ACTIONS = [
  'approve',
  'reject',
  'hod_approve',
  'hod_reject',
  'admin_approve',
  'admin_reject',
  'fulfil',
  'cancel',
] as const

type DemandAction = (typeof ACTIONS)[number]

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

    const isOutOfStock = Boolean(body?.outOfStock)

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
        stage: true,
        deptId: true,
        requestedBy: true,
      },
    })
    if (!existing) {
      return noStoreJson({ error: 'Demand request not found' }, { status: 404 })
    }

    const now = new Date()
    const data: Prisma.DemandRequestUncheckedUpdateManyInput = {}
    let logAction = ''
    let nextStatus = ''

    // Determine resolved action based on action string and current status
    let effectiveAction = demandAction
    if (demandAction === 'approve') {
      if (existing.status === 'pending_hod') effectiveAction = 'hod_approve'
      else if (existing.status === 'pending_admin' || existing.status === 'pending') effectiveAction = 'admin_approve'
    } else if (demandAction === 'reject') {
      if (existing.status === 'pending_hod') effectiveAction = 'hod_reject'
      else if (existing.status === 'pending_admin' || existing.status === 'pending') effectiveAction = 'admin_reject'
    }

    if (effectiveAction === 'hod_approve') {
      const isSuperAdmin = auth.user.role === 'super_admin'
      const isDeptHod = auth.user.role === 'hod' && auth.user.deptId === existing.deptId
      if (!isDeptHod && !isSuperAdmin) {
        return noStoreJson({ error: 'Only the Department Head can provide Stage 1 approval' }, { status: 403 })
      }
      if (auth.user.role === 'hod' && existing.requestedBy === auth.user.userId && !isSuperAdmin) {
        return noStoreJson({ error: 'You cannot approve your own demand request' }, { status: 403 })
      }
      if (existing.status !== 'pending_hod' && existing.status !== 'pending') {
        return noStoreJson({ error: 'Request is not waiting for HOD approval' }, { status: 409 })
      }

      nextStatus = 'pending_admin'
      logAction = 'HOD_APPROVED'
      data.status = 'pending_admin'
      data.stage = 'admin'
      data.hodApprovedBy = auth.user.userId
      data.hodApprovedAt = now
      data.hodNotes = notes || null
      data.reviewedBy = auth.user.userId
      data.reviewedAt = now
      data.reviewNotes = notes || null
    } else if (effectiveAction === 'hod_reject') {
      const isSuperAdmin = auth.user.role === 'super_admin'
      const isDeptHod = auth.user.role === 'hod' && auth.user.deptId === existing.deptId
      if (!isDeptHod && !isSuperAdmin) {
        return noStoreJson({ error: 'Only the Department Head can reject at Stage 1' }, { status: 403 })
      }
      if (!notes) {
        return noStoreJson({ error: 'A reason is required when rejecting a request' }, { status: 400 })
      }
      if (existing.status !== 'pending_hod' && existing.status !== 'pending') {
        return noStoreJson({ error: 'Request is not pending HOD review' }, { status: 409 })
      }

      nextStatus = 'rejected'
      logAction = 'HOD_REJECTED'
      data.status = 'rejected'
      data.stage = 'rejected'
      data.rejectedBy = auth.user.userId
      data.rejectedAt = now
      data.rejectionStage = 'hod'
      data.rejectionReason = notes
      data.reviewedBy = auth.user.userId
      data.reviewedAt = now
      data.reviewNotes = notes
    } else if (effectiveAction === 'admin_approve') {
      const isAdmin = auth.user.role === 'admin' || auth.user.role === 'super_admin'
      if (!isAdmin) {
        return noStoreJson({ error: 'Only Admin can perform inventory stock verification and final approval' }, { status: 403 })
      }
      if (existing.status !== 'pending_admin' && existing.status !== 'pending') {
        return noStoreJson({ error: 'Request is not waiting for Admin approval' }, { status: 409 })
      }

      nextStatus = 'approved'
      logAction = 'ADMIN_APPROVED'
      data.status = 'approved'
      data.stage = 'completed'
      data.adminApprovedBy = auth.user.userId
      data.adminApprovedAt = now
      data.adminNotes = notes || null
      data.reviewedBy = auth.user.userId
      data.reviewedAt = now
      data.reviewNotes = notes || null
    } else if (effectiveAction === 'admin_reject') {
      const isAdmin = auth.user.role === 'admin' || auth.user.role === 'super_admin'
      if (!isAdmin) {
        return noStoreJson({ error: 'Only Admin can reject at Stage 2' }, { status: 403 })
      }
      const reason = notes || (isOutOfStock ? 'Item is currently out of stock in central inventory.' : '')
      if (!reason) {
        return noStoreJson({ error: 'A reason is required when rejecting a request' }, { status: 400 })
      }
      if (existing.status !== 'pending_admin' && existing.status !== 'pending') {
        return noStoreJson({ error: 'Request is not waiting for Admin review' }, { status: 409 })
      }

      nextStatus = 'rejected'
      logAction = 'ADMIN_REJECTED'
      data.status = 'rejected'
      data.stage = 'rejected'
      data.outOfStock = isOutOfStock
      data.rejectedBy = auth.user.userId
      data.rejectedAt = now
      data.rejectionStage = 'admin'
      data.rejectionReason = reason
      data.reviewedBy = auth.user.userId
      data.reviewedAt = now
      data.reviewNotes = reason
    } else if (effectiveAction === 'fulfil') {
      if (!DEMAND_FULFIL_ROLES.includes(auth.user.role)) {
        return noStoreJson({ error: 'Forbidden' }, { status: 403 })
      }
      if (existing.status !== 'approved') {
        return noStoreJson({ error: 'Only approved requests can be fulfilled' }, { status: 409 })
      }

      nextStatus = 'fulfilled'
      logAction = 'STOCK_ISSUED'
      data.status = 'fulfilled'
      data.stage = 'completed'
      data.fulfilledBy = auth.user.userId
      data.fulfilledAt = now
    } else if (effectiveAction === 'cancel') {
      const isOwner = existing.requestedBy === auth.user.userId
      const isOversight = auth.user.role === 'admin' || auth.user.role === 'super_admin'
      if (!isOwner && !isOversight) {
        return noStoreJson({ error: 'Forbidden' }, { status: 403 })
      }
      if (existing.status !== 'pending_hod' && existing.status !== 'pending_admin' && existing.status !== 'pending') {
        return noStoreJson({ error: 'Only pending requests can be cancelled' }, { status: 409 })
      }

      nextStatus = 'cancelled'
      logAction = 'CANCELLED'
      data.status = 'cancelled'
      data.stage = 'cancelled'
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.demandRequest.updateMany({
        where: { requestId, status: existing.status },
        data,
      })
      if (result.count !== 1) {
        throw new DemandHttpError('Request was updated by someone else. Reload and try again.', 409)
      }

      await tx.demandActivityLog.create({
        data: {
          requestId,
          actorId: auth.user.userId,
          actorName: auth.user.fullName,
          actorRole: auth.user.role,
          action: logAction,
          fromStatus: existing.status,
          toStatus: nextStatus,
          notes: notes || (isOutOfStock ? 'Item is out of stock in inventory' : null),
          outOfStock: isOutOfStock,
        },
      })

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
      notes: `Demand request ${logAction}`,
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
