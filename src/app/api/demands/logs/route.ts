import prisma from '@/lib/prisma'
import { apiGuard, noStoreJson } from '@/lib/auth/guards'
import type { Prisma } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const LOG_ACCESS_ROLES = ['super_admin', 'admin', 'hod'] as const

export async function GET(req: Request) {
  const auth = await apiGuard(LOG_ACCESS_ROLES)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
    const actionFilter = url.searchParams.get('action') ?? ''

    const where: Prisma.DemandActivityLogWhereInput = {}

    // HOD is strictly department-scoped
    if (auth.user.role === 'hod') {
      if (!auth.user.deptId) {
        return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
      }
      where.request = { deptId: auth.user.deptId }
    }

    if (actionFilter) {
      where.action = actionFilter
    }

    if (q) {
      where.OR = [
        { actorName: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { request: { requestNumber: { contains: q, mode: 'insensitive' } } },
        { request: { department: { deptName: { contains: q, mode: 'insensitive' } } } },
      ]
    }

    const logs = await prisma.demandActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: {
        request: {
          select: {
            requestId: true,
            requestNumber: true,
            status: true,
            department: { select: { deptCode: true, deptName: true } },
            requester: { select: { fullName: true } },
          },
        },
      },
    })

    return noStoreJson({
      logs: logs.map((l) => ({
        logId: l.logId,
        requestId: l.requestId,
        requestNumber: l.request.requestNumber,
        departmentName: l.request.department.deptName,
        departmentCode: l.request.department.deptCode,
        requesterName: l.request.requester.fullName,
        currentRequestStatus: l.request.status,
        actorId: l.actorId,
        actorName: l.actorName,
        actorRole: l.actorRole,
        action: l.action,
        fromStatus: l.fromStatus,
        toStatus: l.toStatus,
        notes: l.notes,
        outOfStock: l.outOfStock,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/demands/logs error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
