import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { albumKey, findByArtist, isSameArtist, matchKey } from '@/lib/music-text';

const DEEZER_API_URL = 'https://api.deezer.com';
const MAX_COLLABORATION_CHECKS = 3;
const PROFILE_SEARCH_PAGES = 3;
const PROFILE_PAGE_SIZE = 100;
const MAX_OTHER_PROFILES = 5;
const ARTIST_SEARCH_SIZE = 25;
const MAX_FANS_BEHIND = 100;

const searchTerm = (text: string) => text.replace(/"/g, '');

export interface DeezerAlbum {
  id: number;
  title: string;
  link: string;
  cover_xl: string;
  cover_big: string;
  release_date?: string;
  record_type: string;
  nb_tracks?: number;
  upc?: string;
  artist?: {
    id: number;
    name: string;
  };
  /** Only on full album details, and not on search results */
  contributors?: {
    id: number;
    name: string;
    role: string;
  }[];
}

interface DeezerArtist {
  id: number;
  name: string;
  nb_fan?: number;
}

/**
 * Everyone an album is credited to. A collaboration has one artist in `artist`,
 * and the rest only in `contributors`, which also lists featured guests.
 */
export function mainArtists({ artist, contributors }: Pick<DeezerAlbum, 'artist' | 'contributors'>) {
  const others = contributors?.filter((contributor) => contributor.role === 'Main') ?? [];
  return artist ? [artist, ...others.filter(({ id }) => id !== artist.id)] : others;
}

export async function deezerGet<T>(path: string, timeout?: number): Promise<T> {
  const response = await fetchWithTimeout(`${DEEZER_API_URL}${path}`, {}, timeout);
  if (!response.ok) throw new Error(`Deezer request failed: ${response.status}`);

  const data = await response.json();
  // Deezer reports quota limits and missing items as HTTP 200 with an error body
  if (data.error) throw new Error(`Deezer error: ${data.error.message ?? data.error.type}`);
  return data;
}

async function runSearch(query: string): Promise<DeezerAlbum[]> {
  const data = await deezerGet<{ data?: DeezerAlbum[] }>(`/search/album?q=${encodeURIComponent(query)}&limit=50`);
  return data.data ?? [];
}

function matchesArtist(item: DeezerAlbum, artist: string): boolean {
  const itemArtist = matchKey(item.artist?.name ?? '');
  const artistKey = matchKey(artist);
  return itemArtist.includes(artistKey) || artistKey.includes(itemArtist);
}

/** Keep albums whose title contains the requested album name */
export function filterByTitle(albums: DeezerAlbum[], album: string): DeezerAlbum[] {
  const albumName = matchKey(album);
  const lowerCaseName = album.toLowerCase();
  // Keys drop punctuation, so a title made of symbols like "÷" needs the plain comparison too
  return albums.filter((item) =>
    matchKey(item.title).includes(albumName) || item.title.toLowerCase().includes(lowerCaseName)
  );
}

/** Fetch full discography by artist ID — includes singles, EPs, live albums, and release dates */
export async function fetchArtistAlbums(artistId: string, artistName: string): Promise<DeezerAlbum[]> {
  const data = await deezerGet<{ data?: DeezerAlbum[] }>(`/artist/${artistId}/albums?limit=100`);
  return (data.data ?? []).map((album) => ({
    ...album,
    artist: { id: Number(artistId), name: artistName },
  }));
}

/**
 * Find the artist with exactly this name, ignoring case and punctuation. Several
 * profiles can share a name, and Deezer's order doesn't put the best known first.
 *
 * Returns null if the name looks like part of a better known one: someone is
 * called Fleetwood, but a search for that means Fleetwood Mac. Real names stay
 * well inside the limit (James, against James Blunt, is 19x behind) and partial
 * ones are far outside it (Pink, against Pink Floyd, is 438x behind).
 */
export async function findArtistByName(name: string): Promise<DeezerArtist | null> {
  const { data = [] } = await deezerGet<{ data?: DeezerArtist[] }>(
    `/search/artist?q=${encodeURIComponent(name)}&limit=${ARTIST_SEARCH_SIZE}`
  );
  const fans = (artist: DeezerArtist) => artist.nb_fan ?? 0;

  const match = data
    .filter((artist) => matchKey(artist.name) === matchKey(name))
    .sort((a, b) => fans(b) - fans(a))[0];
  if (!match) return null;

  const mostFans = Math.max(...data.map(fans));
  return mostFans > fans(match) * MAX_FANS_BEHIND ? null : match;
}

/**
 * Find other profiles with exactly this artist's name, using the name that Deezer
 * has for them. They may be the same artist split up, or someone else entirely,
 * so callers have to check. Album search is how we find them because artist
 * search misses some: it never returns Apollo Brown's largest profile.
 */
export async function findProfilesWithSameName(artistId: string): Promise<{ name: string; profileIds: string[] }> {
  const { name } = await deezerGet<{ name: string }>(`/artist/${artistId}`);
  const query = encodeURIComponent(`artist:"${searchTerm(name)}"`);
  const profileIds = new Set<string>();

  for (let page = 0; page < PROFILE_SEARCH_PAGES; page++) {
    const index = page * PROFILE_PAGE_SIZE;
    const { data = [], total = 0 } = await deezerGet<{ data?: DeezerAlbum[]; total?: number }>(
      `/search/album?q=${query}&limit=${PROFILE_PAGE_SIZE}&index=${index}`
    );

    for (const { artist } of data) {
      if (artist && matchKey(artist.name) === matchKey(name) && String(artist.id) !== artistId) {
        profileIds.add(String(artist.id));
      }
    }

    if (index + PROFILE_PAGE_SIZE >= total) break;
  }

  return { name, profileIds: [...profileIds].slice(0, MAX_OTHER_PROFILES) };
}

/** The albums that match, and what the fielded query found before filtering, which includes collaborations */
async function runAlbumSearches(artist: string, album?: string) {
  const toMatches = (albums: DeezerAlbum[]) => {
    const byArtist = albums.filter((item) => matchesArtist(item, artist));
    return album ? filterByTitle(byArtist, album) : byArtist;
  };

  const artistTerm = searchTerm(artist);
  const albumTerm = album && searchTerm(album);

  const fieldedQuery = albumTerm ? `artist:"${artistTerm}" album:"${albumTerm}"` : `artist:"${artistTerm}"`;
  const fieldedResults = await runSearch(fieldedQuery);
  const fieldedMatches = toMatches(fieldedResults);
  if (fieldedMatches.length > 0) return { matches: fieldedMatches, fieldedResults };

  // Deezer's fielded search returns nothing for some albums that it does have
  return { matches: toMatches(await runSearch(albumTerm ? `${artistTerm} ${albumTerm}` : artistTerm)), fieldedResults };
}

/** Text search for when no artist ID is available */
export async function searchAlbums(artist: string, album?: string): Promise<DeezerAlbum[]> {
  return (await runAlbumSearches(artist, album)).matches;
}

/**
 * Find an album by an artist who isn't its main artist. Search results don't say
 * who else is credited, so the candidates' full details have to be checked.
 */
async function findCollaboration(results: DeezerAlbum[], artist: string, album: string): Promise<DeezerAlbum | null> {
  const candidates = results.filter((item) => albumKey(item.title) === albumKey(album)).slice(0, MAX_COLLABORATION_CHECKS);

  for (const candidate of candidates) {
    const details = await fetchAlbum(String(candidate.id));
    if (mainArtists(details).some(({ name }) => isSameArtist(name, artist))) return details;
  }
  return null;
}

/** Extract the album ID from a Deezer album link */
export function deezerAlbumId(url: string): string | null {
  return url.match(/^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?album\/0*(\d+)/)?.[1] ?? null;
}

/** Fetch full album details, which unlike search results include the UPC */
export async function fetchAlbum(albumId: string): Promise<DeezerAlbum> {
  return deezerGet<DeezerAlbum>(`/album/${albumId}`);
}

/** Find this exact album by name, for when we weren't given its link */
export async function findAlbum(artist: string, album: string): Promise<DeezerAlbum | null> {
  const { matches, fieldedResults } = await runAlbumSearches(artist, album);
  const sameTitle = matches.filter((item) => albumKey(item.title) === albumKey(album));
  const artistOf = (item: DeezerAlbum) => item.artist?.name;
  // Albums often share their name with a single from them
  const match = findByArtist(sameTitle.filter((item) => item.record_type === 'album'), artist, artistOf)
    ?? findByArtist(sameTitle, artist, artistOf);
  return match ? fetchAlbum(String(match.id)) : findCollaboration(fieldedResults, artist, album);
}
