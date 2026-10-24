import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE, SESSION_TTL_MS } from './constants';
import type { Role, SessionUser } from './roles';

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: number,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {}
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const sessionId = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      sessionId,
      userId,
      expiresAt,
      ipAddress: meta.ipAddress?.slice(0, 45) ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return sessionId;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { sessionId },
    select: {
      expiresAt: true,
      user: {
        select: {
          userId: true,
          fullName: true,
          username: true,
          role: true,
          isActive: true,
          deptId: true,
          department: { select: { deptCode: true, deptName: true } },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
    await prisma.session.deleteMany({ where: { sessionId } }).catch(() => undefined);
    return null;
  }

  const user = session.user;
  return {
    userId: user.userId,
    fullName: user.fullName,
    username: user.username,
    role: user.role as Role,
    deptId: user.deptId,
    deptCode: user.department?.deptCode ?? null,
    deptName: user.department?.deptName ?? null,
  };
});

export async function getCurrentSessionId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? hashSessionToken(token) : null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionId: hashSessionToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function revokeUserSessions(userId: number, exceptSessionId?: string | null): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
    },
  });
}
