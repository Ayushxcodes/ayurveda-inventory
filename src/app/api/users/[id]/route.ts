import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { getCurrentSessionId, revokeUserSessions } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { parseUpdateUserInput } from '@/lib/auth/validation'
import { writeAudit } from '@/lib/auth/audit'
import { USER_ADMIN_ROLES, type Role } from '@/lib/auth/roles'
import { AuditAction } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const userSelect = {
  userId: true,
  employeeId: true,
  fullName: true,
  username: true,
  role: true,
  deptId: true,
  department: { select: { deptCode: true, deptName: true } },
  email: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const

type UserUpdate = {
  fullName?: string
  email?: string | null
  phone?: string | null
  role?: Role
  deptId?: number | null
  isActive?: boolean
  passwordHash?: string
}

class UserHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function clientIp(headerStore: Headers): string {
  const forwarded = headerStore.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headerStore.get('x-real-ip')?.trim() || 'local'
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(USER_ADMIN_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const { id } = await params
    const targetId = Number(id)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return noStoreJson({ error: 'Invalid user id' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = parseUpdateUserInput(body)
    if (!parsed.ok) {
      return noStoreJson(
        { error: 'Please fix the highlighted fields', fields: parsed.errors },
        { status: 400 }
      )
    }

    const target = await prisma.user.findUnique({
      where: { userId: targetId },
      select: {
        userId: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        deptId: true,
        isActive: true,
      },
    })
    if (!target) {
      return noStoreJson({ error: 'User not found' }, { status: 404 })
    }

    const update: UserUpdate = {}
    if (parsed.data.fullName !== undefined) update.fullName = parsed.data.fullName
    if (parsed.data.email !== undefined) update.email = parsed.data.email
    if (parsed.data.phone !== undefined) update.phone = parsed.data.phone
    if (parsed.data.role !== undefined) update.role = parsed.data.role
    if (parsed.data.deptId !== undefined) update.deptId = parsed.data.deptId
    if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive
    if (parsed.data.newPassword !== undefined) update.passwordHash = await hashPassword(parsed.data.newPassword)

    const nextRole = update.role ?? target.role
    const nextDeptId = update.deptId !== undefined ? update.deptId : target.deptId
    const nextActive = update.isActive !== undefined ? update.isActive : target.isActive

    if (nextRole === 'hod' && !nextDeptId) {
      return noStoreJson(
        {
          error: 'A Head of Department must be assigned to a department',
          fields: { deptId: 'Select a department for this HOD' },
        },
        { status: 400 }
      )
    }

    if (update.deptId) {
      const dept = await prisma.department.findFirst({
        where: { deptId: update.deptId, isActive: true },
        select: { deptId: true },
      })
      if (!dept) {
        return noStoreJson(
          { error: 'Department not found or inactive', fields: { deptId: 'Select an active department' } },
          { status: 400 }
        )
      }
    }

    if (targetId === auth.user.userId && nextActive === false) {
      return noStoreJson({ error: 'You cannot deactivate your own account' }, { status: 400 })
    }

    const removesActiveSuperAdmin =
      target.role === 'super_admin' &&
      target.isActive &&
      (nextRole !== 'super_admin' || !nextActive)

    const updated = await prisma.$transaction(async (tx) => {
      if (removesActiveSuperAdmin) {
        const activeAdmins = await tx.$queryRaw<{ user_id: number | bigint }[]>`
          SELECT user_id FROM users
          WHERE role = 'super_admin' AND is_active = true
          FOR UPDATE
        `
        const remaining = activeAdmins.filter((row) => Number(row.user_id) !== targetId)
        if (remaining.length === 0) {
          throw new UserHttpError('At least one active Super Admin is required', 409)
        }
      }

      return tx.user.update({
        where: { userId: targetId },
        data: update,
        select: userSelect,
      })
    })

    if (update.passwordHash || update.isActive === false) {
      const currentSessionId = await getCurrentSessionId()
      await revokeUserSessions(
        targetId,
        targetId === auth.user.userId ? currentSessionId : null
      )
    }

    const sessionId = await getCurrentSessionId()
    const headerStore = await headers()
    await writeAudit({
      tableName: 'users',
      recordId: targetId,
      action: AuditAction.UPDATE,
      changedBy: auth.user.userId,
      sessionId,
      ipAddress: clientIp(headerStore),
      oldValues: {
        fullName: target.fullName,
        email: target.email,
        phone: target.phone,
        role: target.role,
        deptId: target.deptId,
        isActive: target.isActive,
      },
      newValues: {
        ...update,
        ...(update.passwordHash ? { passwordHash: '[redacted]' } : {}),
      },
      notes: update.passwordHash
        ? 'Password reset by Super Admin'
        : update.isActive === false
          ? 'Account deactivated'
          : update.isActive === true && !target.isActive
            ? 'Account reactivated'
            : 'Account updated',
    })

    return noStoreJson({ user: updated })
  } catch (err: unknown) {
    if (err instanceof UserHttpError) {
      return noStoreJson({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('PATCH /api/users/[id] error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
