import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from './constants';

interface AttemptRecord {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

// In-memory only: sufficient for this single-instance deployment. Restarting the
// server resets the counters; a multi-instance deployment would need shared state.
declare global {
  var __ayurLoginAttempts: Map<string, AttemptRecord> | undefined;
}

const attempts = globalThis.__ayurLoginAttempts ?? new Map<string, AttemptRecord>();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__ayurLoginAttempts = attempts;
}

export function loginAttemptKey(ip: string, username: string): string {
  return `${ip}|${username.trim().toLowerCase()}`;
}

export function checkLoginThrottle(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record) return { blocked: false, retryAfterSeconds: 0 };

  if (record.blockedUntil > now) {
    return { blocked: true, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  if (now - record.firstAt > LOGIN_WINDOW_MS) {
    attempts.delete(key);
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > LOGIN_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  record.count += 1;
  if (record.count >= LOGIN_MAX_FAILURES) {
    record.blockedUntil = now + LOGIN_WINDOW_MS;
  }
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
