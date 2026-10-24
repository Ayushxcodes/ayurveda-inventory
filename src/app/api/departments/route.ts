import prisma from '@/lib/prisma'
import { apiGuard, noStoreJson } from '@/lib/auth/guards'
import { DEPARTMENT_ROLES } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await apiGuard(DEPARTMENT_ROLES)
  if (auth.response) return auth.response

  const { user } = auth
  const ownOnly = user.role === 'hod'
  if (ownOnly && !user.deptId) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const [departments, hods] = await Promise.all([
      prisma.department.findMany({
        where: ownOnly ? { deptId: user.deptId as number, isActive: true } : { isActive: true },
        orderBy: { deptName: 'asc' },
        select: { deptId: true, deptCode: true, deptName: true },
      }),
      prisma.user.findMany({
        where: ownOnly
          ? { userId: user.userId }
          : { role: 'hod', isActive: true, deptId: { not: null } },
        orderBy: { fullName: 'asc' },
        select: { userId: true, fullName: true, deptId: true },
      }),
    ])

    return noStoreJson({
      departments,
      hods: hods.map((h) => ({
        userId: h.userId,
        fullName: h.fullName,
        deptId: h.deptId,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/departments error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
