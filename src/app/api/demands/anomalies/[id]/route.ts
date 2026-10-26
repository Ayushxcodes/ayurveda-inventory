import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { DEMAND_REVIEW_ROLES } from '@/lib/auth/roles'
import { writeAudit } from '@/lib/auth/audit'
import { AlertStatus, AlertType, AuditAction } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(DEMAND_REVIEW_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const { id } = await params
    const alertId = Number(id)
    if (!Number.isInteger(alertId) || alertId <= 0) {
      return noStoreJson({ error: 'Invalid anomaly id' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (body?.action !== 'acknowledge') {
      return noStoreJson({ error: 'Invalid action' }, { status: 400 })
    }

    const isHod = auth.user.role === 'hod'
    const deptId = isHod ? auth.user.deptId : null
    if (isHod && !deptId) {
      return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
    }

    const existing = await prisma.alert.findFirst({
      where: {
        alertId,
        alertType: AlertType.anomaly,
        demandRequestId: { not: null },
        ...(deptId ? { deptId } : {}),
      },
      select: {
        alertId: true,
        status: true,
        demandRequest: { select: { requestNumber: true, requestedBy: true } },
      },
    })

    if (!existing) {
      return noStoreJson({ error: 'Anomaly not found' }, { status: 404 })
    }
    if (existing.status !== AlertStatus.active) {
      return noStoreJson({ error: 'This anomaly has already been handled' }, { status: 409 })
    }
    if (isHod && existing.demandRequest?.requestedBy === auth.user.userId) {
      return noStoreJson(
        { error: 'You cannot acknowledge an anomaly on your own request' },
        { status: 403 }
      )
    }

    const updated = await prisma.alert.updateMany({
      where: {
        alertId,
        alertType: AlertType.anomaly,
        status: AlertStatus.active,
        ...(deptId ? { deptId } : {}),
      },
      data: {
        status: AlertStatus.acknowledged,
        acknowledgedBy: auth.user.userId,
        acknowledgedAt: new Date(),
      },
    })

    if (updated.count === 0) {
      return noStoreJson({ error: 'This anomaly has already been handled' }, { status: 409 })
    }

    await writeAudit({
      tableName: 'alerts',
      recordId: alertId,
      action: AuditAction.UPDATE,
      changedBy: auth.user.userId,
      oldValues: { status: AlertStatus.active },
      newValues: { status: AlertStatus.acknowledged },
      notes: existing.demandRequest
        ? `Demand anomaly acknowledged for ${existing.demandRequest.requestNumber}`
        : 'Demand anomaly acknowledged',
    })

    return noStoreJson({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('PATCH /api/demands/anomalies/[id] error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
