"use client";

/**
 * Lightweight client-side cache with Stale-While-Revalidate (SWR) support.
 * Keeps data across tab switches so the UI renders instantly with zero skeleton flicker,
 * and seamlessly revalidates in the background.
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const clientCache = new Map<string, CacheItem<unknown>>();
const activeFetches = new Map<string, Promise<unknown>>();

function redirectToLogin() {
  clearClientCache();
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  if (response.status === 401) {
    redirectToLogin();
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    throw response;
  }
  return response.json();
}

export async function fetchWithCache<T>(
  url: string,
  ttlMs = 30000,
  onBackgroundUpdate?: (freshData: T) => void
): Promise<T> {
  const cached = clientCache.get(url);
  const now = Date.now();

  // If we have fresh cached data, return it immediately
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // If we have stale data, return it immediately and revalidate in background
  if (cached) {
    // Background revalidate if not already fetching
    if (!activeFetches.has(url)) {
      const bgPromise = fetch(url)
        .then((res) => readJsonResponse(res))
        .then((fresh) => {
          clientCache.set(url, { data: fresh, timestamp: Date.now() });
          activeFetches.delete(url);
          if (onBackgroundUpdate) {
            onBackgroundUpdate(fresh as T);
          }
        })
        .catch(() => {
          activeFetches.delete(url);
        });
      activeFetches.set(url, bgPromise);
    }
    return cached.data as T;
  }

  // If not in cache, check if already in flight
  if (activeFetches.has(url)) {
    return activeFetches.get(url)! as Promise<T>;
  }

  // First-time fetch
  const fetchPromise = fetch(url)
    .then((res) => readJsonResponse(res))
    .then((data) => {
      clientCache.set(url, { data, timestamp: Date.now() });
      activeFetches.delete(url);
      return data as T;
    })
    .catch((err) => {
      activeFetches.delete(url);
      throw err;
    });

  activeFetches.set(url, fetchPromise);
  return fetchPromise;
}

export function clearClientCache(urlPattern?: string) {
  if (!urlPattern) {
    clientCache.clear();
    return;
  }
  for (const key of clientCache.keys()) {
    if (key.includes(urlPattern)) {
      clientCache.delete(key);
    }
  }
}
