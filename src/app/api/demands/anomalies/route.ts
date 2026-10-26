import prisma from '@/lib/prisma'
import { apiGuard, noStoreJson } from '@/lib/auth/guards'
import { DEMAND_REVIEW_ROLES } from '@/lib/auth/roles'
import { demandInclude, serializeDemand } from '@/lib/demand'
import { AlertStatus, AlertType } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await apiGuard(DEMAND_REVIEW_ROLES)
  if (auth.response) return auth.response

  const isHod = auth.user.role === 'hod'
  const deptId = isHod ? auth.user.deptId : null
  if (isHod && !deptId) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const alerts = await prisma.alert.findMany({
      where: {
        alertType: AlertType.anomaly,
        status: AlertStatus.active,
        isVisible: true,
        demandRequestId: { not: null },
        ...(deptId ? { deptId } : {}),
      },
      orderBy: [{ severity: 'asc' }, { triggeredAt: 'desc' }],
      take: 50,
      include: {
        department: { select: { deptId: true, deptCode: true, deptName: true } },
        item: { select: { itemId: true, itemCode: true, itemName: true } },
        demandRequest: { include: demandInclude },
        relatedRequest: {
          select: {
            requestId: true,
            requestNumber: true,
            status: true,
            createdAt: true,
            requester: { select: { fullName: true } },
          },
        },
      },
    })

    return noStoreJson({
      anomalies: alerts.map((alert) => ({
        alertId: alert.alertId,
        severity: alert.severity,
        title: alert.alertTitle,
        message: alert.alertMessage,
        triggeredAt: alert.triggeredAt.toISOString(),
        department: alert.department,
        item: alert.item,
        request: alert.demandRequest ? serializeDemand(alert.demandRequest) : null,
        relatedRequest: alert.relatedRequest
          ? {
              requestId: alert.relatedRequest.requestId,
              requestNumber: alert.relatedRequest.requestNumber,
              status: alert.relatedRequest.status,
              createdAt: alert.relatedRequest.createdAt.toISOString(),
              requesterName: alert.relatedRequest.requester.fullName,
            }
          : null,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/demands/anomalies error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
