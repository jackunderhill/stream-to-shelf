const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch with timeout. The timer keeps running after the headers arrive, as otherwise
 * a stalled body would never time out. Aborting a finished request does nothing.
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);

  return fetch(url, { ...options, signal: controller.signal });
}
