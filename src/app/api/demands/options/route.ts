import prisma from '@/lib/prisma'
import { apiGuard, noStoreJson } from '@/lib/auth/guards'
import { DEMAND_CREATE_ROLES } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await apiGuard(DEMAND_CREATE_ROLES)
  if (auth.response) return auth.response

  const lockedDeptId =
    auth.user.role === 'hod' || auth.user.role === 'requester' ? auth.user.deptId : null

  if (auth.user.role === 'hod' && !lockedDeptId) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const [departments, items] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true, ...(lockedDeptId ? { deptId: lockedDeptId } : {}) },
        orderBy: { deptName: 'asc' },
        select: { deptId: true, deptCode: true, deptName: true },
      }),
      prisma.item.findMany({
        where: { isActive: true },
        orderBy: { itemName: 'asc' },
        take: 500,
        select: { itemId: true, itemCode: true, itemName: true, unit: true, category: true },
      }),
    ])

    return noStoreJson({
      departments,
      items,
      defaultDeptId: lockedDeptId,
      canChooseDepartment: !lockedDeptId,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/demands/options error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
