import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';

const CACHE_VERSION = 'v1';
const COMPLETE_TTL = 14 * 24 * 60 * 60; // 14 days: store links rarely change
const INCOMPLETE_TTL = 5 * 60; // 5 minutes: back off a struggling API, then try again

/**
 * Cache key hash. The default is 32-bit with no check on reads, so a request can be
 * crafted to collide with another album's key and fill its slot with the wrong thing.
 */
export const hashCacheKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** A lookup's value, and whether every upstream call needed for it succeeded */
export interface Lookup<T> {
  value: T;
  complete: boolean;
}

// Lookups running on this instance, so that people arriving together share one
// rather than each paying for it, which matters most for store searches' credits
const running = new Map<string, Promise<unknown>>();

/**
 * Run a lookup through the Runtime Cache. Results from a failed upstream call
 * are kept briefly so that we don't hammer it or remember the gap for weeks.
 * The cache is an optimisation, so its own failures never fail the lookup.
 */
export function cachedLookup<T>(
  key: string,
  lookup: () => Promise<Lookup<T>>,
  completeTtl = COMPLETE_TTL
): Promise<T> {
  const existing = running.get(key);
  if (existing) return existing as Promise<T>;

  const result = readThrough(key, lookup, completeTtl).finally(() => running.delete(key));
  running.set(key, result);
  return result;
}

async function readThrough<T>(key: string, lookup: () => Promise<Lookup<T>>, completeTtl: number): Promise<T> {
  const cache = getCache({ namespace: `store-links:${CACHE_VERSION}`, keyHashFunction: hashCacheKey });

  try {
    // Values are wrapped so that a cached "not found" (null) is distinct from a miss
    const cached = await cache.get(key) as { value: T } | null | undefined;
    if (cached) {
      return cached.value;
    }
  } catch (error) {
    console.error('Lookup cache read error:', error);
  }

  const { value, complete } = await lookup();

  try {
    await cache.set(key, { value }, {
      ttl: complete ? completeTtl : INCOMPLETE_TTL,
    });
  } catch (error) {
    console.error('Lookup cache write error:', error);
  }

  return value;
}
