import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { Lookup } from '@/lib/lookup-cache';
import { albumKey, matchKey } from '@/lib/music-text';

const MAX_RELEASES_TO_CHECK = 3;
const MAX_BARCODES_TO_CHECK = 2;
const REQUEST_TIMEOUT = 5000;
const LOOKUP_BUDGET = 8000; // Several requests can run in a row, and people are waiting

const DISCOGS_API_URL = 'https://api.discogs.com';

// Get Discogs token at runtime to support test environment setup
const getDiscogsToken = () => process.env.DISCOGS_TOKEN;

interface DiscogsResult {
  title?: string;
  uri?: string;
  master_id?: number;
}

type DiscogsGet = (path: string) => Promise<Response>;

/**
 * Find an album by the barcode of one of its physical releases. The master page
 * lists every pressing, so it suits people choosing a format better than any one
 * release does. Barcodes do get reused, so check that it's the same artist.
 */
async function findByBarcode(barcodes: string[], artist: string, discogsGet: DiscogsGet): Promise<Lookup<string | null>> {
  for (const barcode of barcodes.slice(0, MAX_BARCODES_TO_CHECK)) {
    try {
      const response = await discogsGet(`/database/search?barcode=${encodeURIComponent(barcode)}&type=release&per_page=5`);
      if (!response.ok) {
        console.error('Discogs barcode search error:', response.status);
        return { value: null, complete: false };
      }

      const data = await response.json() as { results?: DiscogsResult[] };
      const match = data.results?.find((result) => matchKey(result.title ?? '').includes(matchKey(artist)));
      if (match?.master_id) return { value: `https://www.discogs.com/master/${match.master_id}`, complete: true };
      if (match?.uri) return { value: `https://www.discogs.com${match.uri}`, complete: true };
    } catch (error) {
      console.error('Discogs barcode search error:', error);
      return { value: null, complete: false };
    }
  }

  return { value: null, complete: true };
}

/**
 * Find the first of these release links that still exists on Discogs.
 * If Discogs can't tell us, the link is more likely to work than not, so keep it.
 */
async function findLiveRelease(urls: string[], discogsGet: DiscogsGet): Promise<Lookup<string | null>> {
  for (const url of urls.slice(0, MAX_RELEASES_TO_CHECK)) {
    const releaseId = url.match(/\/release\/(\d+)/)?.[1];
    if (!releaseId) return { value: url, complete: true };

    try {
      const response = await discogsGet(`/releases/${releaseId}`);
      if (response.ok) return { value: url, complete: true };
      if (response.status !== 404) {
        console.error('Discogs release check error:', response.status);
        return { value: url, complete: false };
      }
    } catch (error) {
      console.error('Discogs release check error:', error);
      return { value: url, complete: false };
    }
  }

  return { value: null, complete: true };
}

/** Search by name. Discogs always ranks something first, so check that it's this album. */
async function searchReleases(artist: string, album: string, discogsGet: DiscogsGet): Promise<Lookup<string | null>> {
  try {
    const query = encodeURIComponent(`${artist} ${album}`);
    const response = await discogsGet(`/database/search?q=${query}&type=release&artist=${encodeURIComponent(artist)}&per_page=5`);
    if (!response.ok) {
      console.error('Discogs API error:', response.status);
      return { value: null, complete: false };
    }

    const data = await response.json() as { results?: DiscogsResult[] };
    const match = data.results?.find(({ title = '' }) =>
      matchKey(title).includes(matchKey(artist)) && matchKey(title).includes(albumKey(album))
    );
    return { value: match?.uri ? `https://www.discogs.com${match.uri}` : null, complete: true };
  } catch (error) {
    console.error('Discogs search error:', error);
    return { value: null, complete: false };
  }
}

/**
 * Get a Discogs link for an album, preferring its master page, then known releases,
 * then a text search. Searches are made with our token, so they're only made for
 * names from a catalog: text that people type is theirs to search for themselves.
 */
export async function findDiscogsUrl(
  barcodes: string[],
  releaseUrls: string[],
  artist: string,
  album: string,
  canSearchByName: boolean
): Promise<Lookup<string | null>> {
  const token = getDiscogsToken();
  // Without a token nothing can be checked, so try again soon in case one gets added
  if (!token) return { value: releaseUrls[0] ?? null, complete: false };

  const deadline = Date.now() + LOOKUP_BUDGET;
  const discogsGet: DiscogsGet = (path) => fetchWithTimeout(
    `${DISCOGS_API_URL}${path}`,
    { headers: { 'Authorization': `Discogs token=${token}`, 'User-Agent': 'StreamToShelf/1.0' } },
    Math.min(REQUEST_TIMEOUT, deadline - Date.now())
  );

  const master = await findByBarcode(barcodes, artist, discogsGet);
  if (master.value) return master;

  const live = await findLiveRelease(releaseUrls, discogsGet);
  if (live.value) return { value: live.value, complete: live.complete && master.complete };

  if (!canSearchByName) return { value: null, complete: master.complete && live.complete };

  const searched = await searchReleases(artist, album, discogsGet);
  return { value: searched.value, complete: master.complete && live.complete && searched.complete };
}
