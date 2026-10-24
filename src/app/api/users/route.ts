import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { getCurrentSessionId } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { parseCreateUserInput } from '@/lib/auth/validation'
import { writeAudit } from '@/lib/auth/audit'
import { USER_ADMIN_ROLES } from '@/lib/auth/roles'
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

function uniqueConflictField(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  if ((err as { code?: string }).code !== 'P2002') return null
  const target = (err as { meta?: { target?: unknown } }).meta?.target
  const raw = Array.isArray(target) ? target[0] : target
  const map: Record<string, string> = {
    username: 'username',
    employee_id: 'employeeId',
    employeeId: 'employeeId',
    email: 'email',
  }
  return typeof raw === 'string' ? map[raw] ?? null : null
}

function conflictResponse(field: string | null) {
  const label =
    field === 'employeeId' ? 'Employee ID' : field === 'email' ? 'Email' : field === 'username' ? 'Username' : 'Account'
  return noStoreJson(
    {
      error: `${label} is already in use`,
      fields: field ? { [field]: 'Already in use' } : undefined,
    },
    { status: 409 }
  )
}

function clientIp(headerStore: Headers): string {
  const forwarded = headerStore.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headerStore.get('x-real-ip')?.trim() || 'local'
}

export async function GET(req: Request) {
  const auth = await apiGuard(USER_ADMIN_ROLES)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20))

    const where = q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { username: { contains: q, mode: 'insensitive' as const } },
            { employeeId: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: userSelect,
      }),
      prisma.user.count({ where }),
    ])

    return noStoreJson({ users, total, page, pageSize })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/users error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await apiGuard(USER_ADMIN_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const body = await req.json()
    const parsed = parseCreateUserInput(body)
    if (!parsed.ok) {
      return noStoreJson(
        { error: 'Please fix the highlighted fields', fields: parsed.errors },
        { status: 400 }
      )
    }

    const { password, ...data } = parsed.data

    if (data.deptId) {
      const dept = await prisma.department.findFirst({
        where: { deptId: data.deptId, isActive: true },
        select: { deptId: true },
      })
      if (!dept) {
        return noStoreJson(
          { error: 'Department not found or inactive', fields: { deptId: 'Select an active department' } },
          { status: 400 }
        )
      }
    }

    const passwordHash = await hashPassword(password)

    let created
    try {
      created = await prisma.user.create({
        data: { ...data, passwordHash },
        select: userSelect,
      })
    } catch (err: unknown) {
      const field = uniqueConflictField(err)
      if (field) return conflictResponse(field)
      throw err
    }

    const sessionId = await getCurrentSessionId()
    const headerStore = await headers()
    await writeAudit({
      tableName: 'users',
      recordId: created.userId,
      action: AuditAction.CREATE,
      changedBy: auth.user.userId,
      sessionId,
      ipAddress: clientIp(headerStore),
      newValues: {
        username: created.username,
        employeeId: created.employeeId,
        fullName: created.fullName,
        role: created.role,
        deptId: created.deptId,
        isActive: created.isActive,
      },
      notes: 'User account created',
    })

    return noStoreJson({ user: created }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/users error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
