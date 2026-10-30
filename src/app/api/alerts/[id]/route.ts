import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { getSessionUser } from '@/lib/auth/session'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const notifId = parseInt(id, 10)
    if (isNaN(notifId)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 })
    }

    const body = await request.json()
    const { status, isPinned } = body

    const dataToUpdate: Prisma.RoleNotificationUpdateInput = {}
    if (status) dataToUpdate.status = status
    if (typeof isPinned === 'boolean') dataToUpdate.isPinned = isPinned

    const updated = await prisma.roleNotification.update({
      where: { id: notifId },
      data: dataToUpdate,
    })

    return NextResponse.json({ notification: updated, success: true })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const notifId = parseInt(id, 10)
    if (isNaN(notifId)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 })
    }

    const notif = await prisma.roleNotification.findUnique({
      where: { id: notifId },
    })

    if (!notif) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Only the author or super_admin / admin can delete
    const isSuperOrAdmin = user.role === 'super_admin' || user.role === 'admin'
    if (notif.createdBy !== user.userId && !isSuperOrAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete this alert.' },
        { status: 403 }
      )
    }

    await prisma.roleNotification.delete({
      where: { id: notifId },
    })

    return NextResponse.json({ success: true, message: 'Notification deleted' })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
