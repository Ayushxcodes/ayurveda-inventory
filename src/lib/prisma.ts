import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is not set in environment');
}

// Global scope declaration for Next.js hot-reloading preservation
declare global {
  var __ayurPrisma: PrismaClient | undefined;
  var __ayurPgPool: Pool | undefined;
}

const pool =
  globalThis.__ayurPgPool ??
  new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
  });

// Handle idle connection drops gracefully (prevents unhandled errors when Neon disconnects idle sockets)
pool.on('error', (err) => {
  // Ignore backend terminations of idle connections; new connections are created on demand
  console.warn('[Postgres Pool] Idle client error:', err.message);
});

const adapter = new PrismaPg(pool);

// Invalidate stale in-memory cached client if schema has been updated
if (globalThis.__ayurPrisma && !('demandActivityLog' in globalThis.__ayurPrisma)) {
  console.log('[Prisma] Invalidate stale client to pick up updated Prisma schema.');
  globalThis.__ayurPrisma = undefined;
}

export const prisma: PrismaClient =
  globalThis.__ayurPrisma ??
  new PrismaClient({
    adapter,
  } as unknown as ConstructorParameters<typeof PrismaClient>[0]);

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ayurPrisma = prisma;
  globalThis.__ayurPgPool = pool;
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        i < retries &&
        (msg.includes('Connection terminated') ||
          msg.includes('connection timeout') ||
          msg.includes('ECONNRESET') ||
          msg.includes('closed unexpectedly'))
      ) {
        console.warn(`[DB Retry] Retrying query after connection error (attempt ${i + 1}/${retries})...`);
        await new Promise((res) => setTimeout(res, 400 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export { pool };
export default prisma;
