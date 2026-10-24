'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import {
  checkLoginThrottle,
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
} from '@/lib/auth/login-rate-limit';
import { normalizeUsername } from '@/lib/auth/validation';
import { writeAudit } from '@/lib/auth/audit';
import { AuditAction } from '@/generated/prisma/client';

export interface LoginState {
  error: string | null;
}

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

function clientIp(headerStore: Headers): string {
  const forwarded = headerStore.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headerStore.get('x-real-ip')?.trim() || 'local';
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = normalizeUsername(formData.get('username'));
  const password = typeof formData.get('password') === 'string' ? String(formData.get('password')) : '';
  const next = safeNext(formData.get('next'));
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const attemptKey = loginAttemptKey(ip, username || '(blank)');

  const throttle = checkLoginThrottle(attemptKey);
  if (throttle.blocked) {
    const minutes = Math.max(1, Math.ceil(throttle.retryAfterSeconds / 60));
    return {
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  if (!username || !password) {
    return { error: 'Enter your username and password.' };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { userId: true, passwordHash: true, isActive: true },
  });

  // Always run one scrypt verification so unknown usernames take comparable time.
  const passwordMatches = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, DUMMY_PASSWORD_HASH), false);

  if (!user || !passwordMatches) {
    recordLoginFailure(attemptKey);
    return { error: 'Invalid username or password.' };
  }

  if (!user.isActive) {
    recordLoginFailure(attemptKey);
    return { error: 'This account is inactive. Contact your Super Admin.' };
  }

  clearLoginFailures(attemptKey);

  const sessionId = await createSession(user.userId, {
    ipAddress: ip,
    userAgent: headerStore.get('user-agent'),
  });

  try {
    await prisma.user.update({
      where: { userId: user.userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    console.error('Failed to update last login time:', error);
  }

  await writeAudit({
    tableName: 'users',
    recordId: user.userId,
    action: AuditAction.LOGIN,
    changedBy: user.userId,
    sessionId,
    ipAddress: ip,
    notes: 'User signed in',
  });

  redirect(next);
}
