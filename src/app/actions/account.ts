'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth/guards';
import {
  destroySession,
  getCurrentSessionId,
  getSessionUser,
  revokeUserSessions,
} from '@/lib/auth/session';
import { hashPassword, passwordPolicyError, verifyPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/auth/audit';
import { AuditAction } from '@/generated/prisma/client';

export interface ChangePasswordState {
  error: string | null;
  success: boolean;
}

function clientIp(headerStore: Headers): string {
  const forwarded = headerStore.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headerStore.get('x-real-ip')?.trim() || 'local';
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();

  if (user) {
    const sessionId = await getCurrentSessionId();
    const headerStore = await headers();
    await writeAudit({
      tableName: 'users',
      recordId: user.userId,
      action: AuditAction.LOGOUT,
      changedBy: user.userId,
      sessionId,
      ipAddress: clientIp(headerStore),
      notes: 'User signed out',
    });
  }

  await destroySession();
  redirect('/login');
}

export async function changePasswordAction(
  _previous: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUser();
  const currentPassword =
    typeof formData.get('currentPassword') === 'string' ? String(formData.get('currentPassword')) : '';
  const newPassword =
    typeof formData.get('newPassword') === 'string' ? String(formData.get('newPassword')) : '';
  const confirmPassword =
    typeof formData.get('confirmPassword') === 'string' ? String(formData.get('confirmPassword')) : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Complete all password fields.', success: false };
  }

  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    return { error: policyError, success: false };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New password and confirmation do not match.', success: false };
  }

  if (newPassword === currentPassword) {
    return { error: 'New password must be different from your current password.', success: false };
  }

  const dbUser = await prisma.user.findUnique({
    where: { userId: user.userId },
    select: { passwordHash: true },
  });

  if (!dbUser || !(await verifyPassword(currentPassword, dbUser.passwordHash))) {
    return { error: 'Current password is incorrect.', success: false };
  }

  const newHash = await hashPassword(newPassword);
  const sessionId = await getCurrentSessionId();

  await prisma.user.update({
    where: { userId: user.userId },
    data: { passwordHash: newHash },
  });

  await revokeUserSessions(user.userId, sessionId);

  const headerStore = await headers();
  await writeAudit({
    tableName: 'users',
    recordId: user.userId,
    action: AuditAction.UPDATE,
    changedBy: user.userId,
    sessionId,
    ipAddress: clientIp(headerStore),
    notes: 'Password changed by user',
  });

  return { error: null, success: true };
}
