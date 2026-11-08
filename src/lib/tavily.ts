import { getCache } from '@vercel/functions';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { hashCacheKey } from '@/lib/lookup-cache';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const MAX_RESULTS = 20; // The same cost as fewer, and stores' album pages often rank below their other pages
const REQUEST_TIMEOUT = 5000;

// The free plan has 1,000 credits a month and each search costs one, so a daily cap
// of 30 aims to keep even a 31-day month to 930. It's a best effort: Runtime Cache
// has no atomic increment and can lose entries, so instances can overspend between
// them. A daily count limits what that can cost, and Tavily refuses searches at the
// plan limit anyway. Its usage figures can't do this job: they read 0 after 64 searches.
const DAILY_CREDITS = 30;
const VISITOR_CREDITS = 15; // A share of the day's budget, so that one visitor can't use it all up
const CACHE_CHECK_KEY = 'working';
const BUDGET_TTL = 2 * 24 * 60 * 60; // 2 days: outlives its day whatever time it was first written

export interface SiteResult {
  title: string;
  url: string;
}

// This instance's own counts. They stop a failed cache read from resetting the day's
// total, and are updated before any await, so concurrent requests on an instance can't
// all read the same number. Visitors only live here, so no IP address is ever stored.
let instanceSpend = { day: '', spent: 0, visitors: new Map<string, number>() };

type BudgetCache = ReturnType<typeof getCache>;

/**
 * A failed read looks just like an empty one, which would make a spent budget look
 * unused. So an empty read only counts once we've seen the cache hold a value.
 */
async function cacheIsWorking(cache: BudgetCache): Promise<boolean> {
  if (await cache.get(CACHE_CHECK_KEY)) return true;

  await cache.set(CACHE_CHECK_KEY, true, { ttl: BUDGET_TTL });
  return Boolean(await cache.get(CACHE_CHECK_KEY));
}

/** Take credits from today's budget, and from this visitor's share of it if we know who they are */
async function reserveCredits(count: number, visitor: string | undefined): Promise<boolean> {
  const cache = getCache({ namespace: 'tavily-budget', keyHashFunction: hashCacheKey });
  const today = new Date().toISOString().slice(0, 10);

  if (instanceSpend.day !== today) instanceSpend = { day: today, spent: 0, visitors: new Map() };

  const { visitors } = instanceSpend;
  const visitorSpend = (visitor && visitors.get(visitor)) || 0;
  if (visitorSpend + count > VISITOR_CREDITS) return false;

  const spentBefore = instanceSpend.spent;
  instanceSpend.spent += count;
  if (visitor) visitors.set(visitor, visitorSpend + count);

  const refuse = () => {
    instanceSpend.spent -= count;
    if (visitor) visitors.set(visitor, (visitors.get(visitor) ?? count) - count);
    return false;
  };

  try {
    const stored = await cache.get(today) as number | null | undefined;
    if (stored == null && !await cacheIsWorking(cache)) {
      console.error('Tavily budget unavailable: can\'t read the cache');
      return refuse();
    }

    const spent = Math.max(stored ?? 0, spentBefore);
    if (spent + count > DAILY_CREDITS) {
      console.error('Tavily daily budget reached:', spent);
      return refuse();
    }

    await cache.set(today, spent + count, { ttl: BUDGET_TTL });
    return true;
  } catch (error) {
    console.error('Tavily budget error:', error);
    return refuse();
  }
}

async function searchDomains(apiKey: string, query: string, domains: string[]): Promise<SiteResult[] | null> {
  try {
    const response = await fetchWithTimeout(
      TAVILY_API_URL,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, include_domains: domains, max_results: MAX_RESULTS, search_depth: 'basic' }),
      },
      REQUEST_TIMEOUT
    );

    if (!response.ok) {
      console.error('Tavily API error:', response.status);
      return null;
    }

    const data = await response.json() as { results?: Partial<SiteResult>[] };
    return (data.results ?? []).map(({ title, url }) => ({ title: title ?? '', url: url ?? '' }));
  } catch (error) {
    console.error('Tavily fetch error:', error);
    return null;
  }
}

/**
 * Run one search of each group of domains, which include their subdomains, and
 * only ever those: the open web returned fake shops. Each search costs one credit
 * however many domains it covers, but they compete for its results, so only
 * group domains that don't crowd each other out. Credits are reserved for the
 * whole batch first, as parallel reservations would all read the same count.
 *
 * Returns null if nothing could be searched. Otherwise there's one entry per
 * group, which is null if that search failed.
 */
export async function searchSites(
  query: string,
  searches: string[][],
  visitor?: string
): Promise<(SiteResult[] | null)[] | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !await reserveCredits(searches.length, visitor)) {
    return null;
  }

  return Promise.all(searches.map((domains) => searchDomains(apiKey, query, domains)));
}
