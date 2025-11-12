/**
 * Image Proxy Utilities - Hybrid Approach
 *
 * This implements a hybrid strategy:
 * - Fast platforms (Spotify, Apple Music, Discogs) use direct CDN access
 * - All other platforms automatically proxy through /api/image-proxy
 *
 * Benefits:
 * - Maximum performance for most common sources
 * - Zero configuration for new platforms
 * - Automatic SSRF protection and security for everything else
 */

/** Domains that are whitelisted for direct CDN access (fastest) */
const WHITELISTED_DOMAINS = new Set([
  // Spotify
  'i.scdn.co',
  'mosaic.scdn.co',
  'image-cdn-ak.spotifycdn.com',
  'image-cdn-fa.spotifycdn.com',

  // Apple Music
  'is1-ssl.mzstatic.com',
  'a1.mzstatic.com',
  'is2-ssl.mzstatic.com',
  'is3-ssl.mzstatic.com',
  'is4-ssl.mzstatic.com',
  'is5-ssl.mzstatic.com',

  // Discogs
  'img.discogs.com',
  'i.discogs.com',
  'a.discogs.com',
  'st.discogs.com',
]);

/**
 * Determine the optimal image URL strategy
 *
 * @param externalUrl - The original image URL from an external service
 * @returns The URL to use (either original for whitelisted, or proxied for others)
 *
 * @example
 * // Spotify image - uses direct CDN (fast)
 * getOptimalImageUrl('https://i.scdn.co/image/abc123.jpg')
 * // Returns: 'https://i.scdn.co/image/abc123.jpg'
 *
 * @example
 * // Pandora image - uses proxy (automatic)
 * getOptimalImageUrl('https://content-images.p-cdn.com/image.jpg')
 * // Returns: '/api/image-proxy?url=https%3A%2F%2Fcontent-images.p-cdn.com%2Fimage.jpg'
 */
export function getOptimalImageUrl(externalUrl: string | undefined): string | undefined {
  if (!externalUrl) {
    return undefined;
  }

  try {
    const urlObj = new URL(externalUrl);
    const hostname = urlObj.hostname;

    // If domain is whitelisted, use direct CDN access (fastest)
    if (WHITELISTED_DOMAINS.has(hostname)) {
      return externalUrl;
    }

    // Otherwise, proxy through our endpoint (automatic, secure)
    return `/api/image-proxy?url=${encodeURIComponent(externalUrl)}`;
  } catch {
    console.warn(`Invalid image URL: ${externalUrl}`);
    return undefined;
  }
}

/**
 * Check if a URL should be served directly (whitelisted)
 *
 * @param url - The image URL to check
 * @returns true if the URL is whitelisted for direct CDN access
 */
export function isWhitelistedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return WHITELISTED_DOMAINS.has(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * Check if a URL will be proxied
 *
 * @param url - The image URL to check
 * @returns true if the URL will go through the proxy
 */
export function willBeProxied(url: string): boolean {
  return !isWhitelistedDomain(url);
}
