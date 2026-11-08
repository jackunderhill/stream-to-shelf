/**
 * Image Proxy Utilities
 *
 * Hosts listed here and in next.config.ts load directly from their CDN, which is
 * fastest. Other hosts go through /api/image-proxy, which only serves album art
 * from the same three services' other CDN hosts.
 */

/** Domains that are whitelisted for direct CDN access (fastest) */
const WHITELISTED_DOMAINS = new Set([
  // Deezer
  'e-cdns-images.dzcdn.net',
  'cdns-images.dzcdn.net',
  'cdn-images.dzcdn.net',

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

    // Otherwise, proxy through our endpoint
    return `/api/image-proxy?url=${encodeURIComponent(externalUrl)}`;
  } catch {
    console.warn(`Invalid image URL: ${externalUrl}`);
    return undefined;
  }
}
