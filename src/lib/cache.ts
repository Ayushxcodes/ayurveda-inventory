/**
 * High-performance In-Memory Server Cache with TTL, Stampede Protection, and Tag Invalidation
 * Ideal for cross-region serverless databases (like AWS us-east-1 Neon queried from India).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  tags?: string[];
}

declare global {
  var __ayurServerCache: Map<string, CacheEntry<unknown>> | undefined;
  var __ayurInFlightPromises: Map<string, Promise<unknown>> | undefined;
}

const memoryCache = globalThis.__ayurServerCache ?? new Map<string, CacheEntry<unknown>>();
const inFlight = globalThis.__ayurInFlightPromises ?? new Map<string, Promise<unknown>>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ayurServerCache = memoryCache;
  globalThis.__ayurInFlightPromises = inFlight;
}

export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 30,
  tags: string[] = []
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  // Stampede protection: if a fetch for this key is already running, wait for it
  const existingPromise = inFlight.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      memoryCache.set(key, {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000,
        tags,
      });
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function invalidateCache(...tagsOrKeys: string[]): void {
  if (tagsOrKeys.length === 0) {
    memoryCache.clear();
    return;
  }

  const keysToDelete: string[] = [];

  for (const [key, entry] of memoryCache.entries()) {
    const matchesKey = tagsOrKeys.some((pattern) => key.includes(pattern));
    const matchesTag = entry.tags?.some((t) => tagsOrKeys.includes(t));
    if (matchesKey || matchesTag) {
      keysToDelete.push(key);
    }
  }

  for (const k of keysToDelete) {
    memoryCache.delete(k);
  }
}
