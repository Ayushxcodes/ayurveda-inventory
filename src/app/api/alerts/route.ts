import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { getSessionUser } from '@/lib/auth/session'
import { canSendAlerts, canAccessTab } from '@/lib/auth/roles'

export async function GET(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canAccessTab(user.role, 'ALERTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'all'
    const severity = searchParams.get('severity') || 'all'
    const search = searchParams.get('q')?.trim().toLowerCase() || ''

    // 1. Fetch Role Notifications
    // Build where clause based on user role and permissions
    const whereConditions: Prisma.RoleNotificationWhereInput = {
      status: 'active',
    }

    if (severity !== 'all') {
      whereConditions.severity = severity
    }

    // Role-based visibility filtering
    const isSuperOrAdmin = user.role === 'super_admin' || user.role === 'admin'
    const userRole = user.role
    const userDeptId = user.deptId

    if (!isSuperOrAdmin) {
      if (userRole === 'hod') {
        // HOD sees: broadcasts to all, hod-targeted alerts, alerts sent by self, and alerts targeted to their department
        whereConditions.OR = [
          { targetRole: 'all' },
          { targetRole: 'hod' },
          { createdBy: user.userId },
          {
            AND: [
              { targetDeptId: userDeptId ?? -1 },
              { targetRole: { in: ['all', 'hod', 'requester'] } },
            ],
          },
        ]
      } else {
        // Requesters / Procurement / Others
        whereConditions.OR = [
          { targetRole: 'all' },
          { targetRole: userRole },
          ...(userDeptId
            ? [
                {
                  AND: [
                    { targetDeptId: userDeptId },
                    { targetRole: { in: ['all', userRole] } },
                  ],
                },
              ]
            : []),
        ]
      }
    }

    // Tab-specific filters
    if (tab === 'my_role') {
      whereConditions.targetRole = userRole
    } else if (tab === 'broadcasts') {
      whereConditions.targetRole = 'all'
    } else if (tab === 'sent_by_me') {
      whereConditions.createdBy = user.userId
    } else if (tab === 'hod') {
      whereConditions.targetRole = 'hod'
    } else if (tab === 'requester') {
      whereConditions.targetRole = 'requester'
    } else if (tab === 'procurement') {
      whereConditions.targetRole = 'procurement_officer'
    } else if (tab === 'admin') {
      whereConditions.targetRole = 'admin'
    }

    const rawNotifications = await prisma.roleNotification.findMany({
      where: whereConditions,
      include: {
        targetDept: {
          select: {
            deptId: true,
            deptCode: true,
            deptName: true,
          },
        },
        creator: {
          select: {
            userId: true,
            fullName: true,
            role: true,
            department: {
              select: {
                deptCode: true,
                deptName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Filter by search query if present
    const notifications = search
      ? rawNotifications.filter(
          (n) =>
            n.title.toLowerCase().includes(search) ||
            n.message.toLowerCase().includes(search) ||
            n.senderName.toLowerCase().includes(search) ||
            (n.targetDept?.deptName && n.targetDept.deptName.toLowerCase().includes(search))
        )
      : rawNotifications

    // 2. Fetch System Inventory Alerts from the alerts table
    const systemAlertWhere: Prisma.AlertWhereInput = {
      status: 'active',
      isVisible: true,
    }

    if (user.role === 'hod' && userDeptId) {
      systemAlertWhere.item = {
        primaryDeptId: userDeptId,
      }
    }

    const rawSystemAlerts = await prisma.alert.findMany({
      where: systemAlertWhere,
      include: {
        item: {
          select: {
            itemId: true,
            itemCode: true,
            itemName: true,
            category: true,
            unit: true,
            primaryDept: {
              select: {
                deptCode: true,
                deptName: true,
              },
            },
          },
        },
        batch: {
          select: {
            batchId: true,
            batchNumber: true,
            expiryDate: true,
            quantityAvailable: true,
          },
        },
      },
      orderBy: [
        { triggeredAt: 'desc' },
      ],
      take: 50,
    })

    const systemAlerts = rawSystemAlerts.map((a) => ({
      alertId: a.alertId,
      alertType: a.alertType,
      severity: a.severity,
      title: a.alertTitle,
      message: a.alertMessage,
      daysRemaining: a.daysRemaining,
      thresholdValue: a.thresholdValue ? Number(a.thresholdValue) : null,
      status: a.status,
      triggeredAt: a.triggeredAt.toISOString(),
      item: a.item,
      batch: a.batch,
    }))

    // 3. Departments list for target selector
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: { deptId: true, deptCode: true, deptName: true },
      orderBy: { deptName: 'asc' },
    })

    // 4. Summary counts
    const criticalNotifications = notifications.filter((n) => n.severity === 'critical').length
    const myRoleNotifications = notifications.filter(
      (n) => n.targetRole === userRole || n.targetRole === 'all'
    ).length

    const summary = {
      totalRoleNotifications: notifications.length,
      criticalCount: criticalNotifications,
      myRoleCount: myRoleNotifications,
      systemAlertsCount: systemAlerts.length,
      canSend: canSendAlerts(user.role),
    }

    return NextResponse.json({
      notifications,
      systemAlerts,
      departments,
      summary,
      currentUser: {
        userId: user.userId,
        role: user.role,
        fullName: user.fullName,
        deptId: user.deptId,
        deptName: user.deptName,
      },
    })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canSendAlerts(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Administrators and Heads of Department can broadcast alerts.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, message, severity, targetRole, targetDeptId, isPinned } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Alert title is required.' }, { status: 400 })
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Alert message content is required.' }, { status: 400 })
    }

    const validSeverities = ['critical', 'high', 'medium', 'info']
    const safeSeverity = validSeverities.includes(severity) ? severity : 'info'

    const validRoles = ['all', 'hod', 'requester', 'procurement_officer', 'admin']
    const safeTargetRole = validRoles.includes(targetRole) ? targetRole : 'all'

    // If HOD is creating the alert, scope the target department to their own department if not hospital-wide
    let finalDeptId: number | null = null
    if (user.role === 'hod') {
      finalDeptId = user.deptId ?? null
    } else if (targetDeptId && targetDeptId !== 'all') {
      finalDeptId = Number(targetDeptId)
    }

    const newNotification = await prisma.roleNotification.create({
      data: {
        title: title.trim(),
        message: message.trim(),
        severity: safeSeverity,
        targetRole: safeTargetRole,
        targetDeptId: finalDeptId,
        createdBy: user.userId,
        senderRole: user.role,
        senderName: user.fullName,
        isPinned: Boolean(isPinned),
        status: 'active',
      },
      include: {
        targetDept: {
          select: {
            deptId: true,
            deptCode: true,
            deptName: true,
          },
        },
      },
    })

    return NextResponse.json({ notification: newNotification, success: true }, { status: 201 })
  } catch (error) {
    console.error('Error creating role notification:', error)
    return NextResponse.json({ error: 'Failed to broadcast alert.' }, { status: 500 })
  }
}
