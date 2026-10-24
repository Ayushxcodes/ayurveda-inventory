import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getSessionUser } from './session';
import type { Role, SessionUser } from './roles';

export async function requireUser(nextPath = '/'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireRole(roles: readonly Role[], nextPath = '/'): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!roles.includes(user.role)) redirect('/');
  return user;
}

export type ApiAuth = { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse };

export async function apiGuard(allowed: readonly Role[]): Promise<ApiAuth> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!allowed.includes(user.role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return null;

  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return null;
}

export function noStoreJson(data: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(data, { ...init, headers });
}
