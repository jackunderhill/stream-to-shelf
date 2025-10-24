import { NextRequest, NextResponse } from 'next/server';
import { SearchResult, SonglinkResponse, PlatformLink, Region } from '@/types';

const SONGLINK_API_URL = 'https://api.song.link/v1-alpha.1/links';
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const API_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Platform display names and categories
// Digital downloads vs physical media
const PLATFORM_CONFIG: Record<string, { name: string; category: 'download' | 'physical' }> = {
  itunes: { name: 'iTunes', category: 'download' },
  amazonStore: { name: 'Amazon Music', category: 'download' },
  bandcamp: { name: 'Bandcamp', category: 'download' },
  googleStore: { name: 'Google Play', category: 'download' },
};

/**
 * Search Discogs API to get the best matching release
 */
async function getDiscogsRelease(artist: string, album: string): Promise<string | null> {
  if (!DISCOGS_TOKEN) {
    console.log('Discogs token not configured');
    return null;
  }

  try {
    // Use a simpler query - just search for both artist and album name
    const query = `${artist} ${album}`;
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&artist=${encodeURIComponent(artist)}&per_page=5`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': 'StreamToShelf/1.0'
      }
    });

    if (!response.ok) {
      console.error('Discogs API error:', response.status);
      return null;
    }

    const data = await response.json();

    // Get the first result (most relevant)
    if (data.results && data.results.length > 0) {
      const firstResult = data.results[0];
      return `https://www.discogs.com${firstResult.uri}`;
    }

    return null;
  } catch (error) {
    console.error('Discogs search error:', error);
    return null;
  }
}

/**
 * Query Songlink API with a URL to get all platform links
 */
async function getSonglinkData(url: string, region: Region = 'US'): Promise<SonglinkResponse | null> {
  try {
    const songlinkUrl = `${SONGLINK_API_URL}?url=${encodeURIComponent(url)}&userCountry=${region}`;

    const response = await fetchWithTimeout(songlinkUrl);
    if (!response.ok) {
      console.error('Songlink API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Songlink fetch error:', error);
    return null;
  }
}

// Map regions to Amazon domains
const AMAZON_DOMAINS: Record<Region, string> = {
  'US': 'amazon.com',
  'GB': 'amazon.co.uk',
  'CA': 'amazon.ca',
  'AU': 'amazon.com.au',
  'DE': 'amazon.de',
  'FR': 'amazon.fr',
  'JP': 'amazon.co.jp',
};

/**
 * Convert Songlink response to our PlatformLink format
 * Only returns purchase/buy links, filtering out streaming services
 * Also adds physical media stores
 */
async function convertToPlatformLinks(songlink: SonglinkResponse, region: Region, artist?: string, album?: string): Promise<PlatformLink[]> {
  const links: PlatformLink[] = [];

  // Get metadata from Songlink for physical store searches
  const firstEntity = Object.values(songlink.entitiesByUniqueId)[0];
  const artistName = artist || firstEntity?.artistName || '';
  const albumName = album || firstEntity?.title || '';

  // Add digital purchase platforms from Songlink
  for (const [platform, linkData] of Object.entries(songlink.linksByPlatform)) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) continue; // Skip platforms we don't show (streaming services, etc.)

    // Skip Amazon if it's an affiliate link that might 404
    // We'll use a direct search link instead
    if (platform === 'amazonStore') continue;

    links.push({
      platform,
      displayName: config.name,
      url: linkData.url,
      category: config.category,
    });
  }

  // Add Amazon Music search link (digital downloads - more reliable than affiliate links)
  // Use region-specific Amazon domain
  if (artistName && albumName) {
    const amazonQuery = `${artistName} ${albumName}`;
    const amazonDomain = AMAZON_DOMAINS[region] || 'amazon.com';
    links.push({
      platform: 'amazonDigital',
      displayName: 'Amazon Music',
      url: `https://www.${amazonDomain}/s?k=${encodeURIComponent(amazonQuery)}&i=digital-music`,
      category: 'download',
    });
  }

  // Add physical media stores - always add these if we have artist/album info
  if (artistName && albumName) {
    // Amazon physical media (CDs, vinyl, cassettes)
    const amazonQuery = `${artistName} ${albumName}`;
    const amazonDomain = AMAZON_DOMAINS[region] || 'amazon.com';
    links.push({
      platform: 'amazonPhysical',
      displayName: 'Amazon',
      url: `https://www.${amazonDomain}/s?k=${encodeURIComponent(amazonQuery)}&i=popular`,
      category: 'physical',
    });

    // Use Discogs API to get the best matching release
    const discogsUrl = await getDiscogsRelease(artistName, albumName);
    if (discogsUrl) {
      links.push({
        platform: 'discogs',
        displayName: 'Discogs',
        url: discogsUrl,
        category: 'physical',
      });
    }

    // Add HDtracks search link (hi-res digital downloads)
    const searchQuery = `${artistName} ${albumName}`;
    links.push({
      platform: 'hdtracks',
      displayName: 'HDtracks',
      url: `https://www.hdtracks.com/#/search?q=${encodeURIComponent(searchQuery)}`,
      category: 'download',
    });
  }

  // Sort by category first (download, then physical), then alphabetically within each category
  links.sort((a, b) => {
    if (a.category === b.category) {
      return a.displayName.localeCompare(b.displayName);
    }
    return a.category === 'download' ? -1 : 1;
  });

  return links;
}

// Disable caching for this API route to prevent stale data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const region = (searchParams.get('region') as Region) || 'US';
  const artist = searchParams.get('artist');
  const album = searchParams.get('album');

  // Validation
  if (!url || url.trim().length === 0) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400 }
    );
  }

  // Validate region
  const validRegions: Region[] = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP'];
  if (!validRegions.includes(region)) {
    return NextResponse.json(
      { error: 'Invalid region parameter' },
      { status: 400 }
    );
  }

  try {
    // Get all platform links from Songlink
    const songlinkData = await getSonglinkData(url, region);

    if (!songlinkData) {
      return NextResponse.json<SearchResult>({
        artist: artist || undefined,
        album: album || undefined,
        links: [],
        metadata: undefined,
      });
    }

    // Convert to our format (including physical stores)
    const links = await convertToPlatformLinks(songlinkData, region, artist || undefined, album || undefined);

    // Extract metadata from the first entity
    const firstEntity = Object.values(songlinkData.entitiesByUniqueId)[0];
    const metadata = firstEntity ? {
      title: firstEntity.title || 'Unknown',
      artistName: firstEntity.artistName || artist || 'Unknown',
      artwork: firstEntity.thumbnailUrl,
    } : undefined;

    const result: SearchResult = {
      artist: artist || undefined,
      album: album || undefined,
      songlink: songlinkData,
      links,
      metadata,
    };

    const response = NextResponse.json<SearchResult>(result);
    // Prevent caching at the browser/CDN level
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;

  } catch (error) {
    console.error('Songlink API error:', error);

    // Check if it's an abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
