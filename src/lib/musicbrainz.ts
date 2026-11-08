import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { Lookup } from '@/lib/lookup-cache';
import { albumKey, isSameArtist, matchKey, nameKeys, normaliseBarcode, plainQuotes, stripEdition } from '@/lib/music-text';

const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'StreamToShelf/1.0 (https://streamtoshelf.com)';

const MIN_REQUEST_GAP = 1100; // MusicBrainz allows about one request per second per IP
const MAX_ATTEMPTS = 3;
const RETRY_DELAY = 1500; // MusicBrainz often answers 503 under load, and recovers within seconds
const REQUEST_TIMEOUT = 9000; // Cold searches can take 8s, and giving up on one just leaves the next one cold too
const LOOKUP_BUDGET = 12000; // After this we show search links rather than keep people waiting. A cold search can take 8s.
const MAX_ARTISTS_WITH_SAME_NAME = 3;
const DISCOGRAPHY_SIZE = 100; // Plenty to show that two lists are the same artist's

/** Direct store links that MusicBrainz's community has recorded for an album */
export interface MusicBrainzLinks {
  bandcamp?: string;
  /** Best first. These can outlive the release on Discogs, so check them before use. */
  discogs: string[];
  hdtracks?: string;
  qobuz?: string;
  sevendigital: string[];
  amazonDigital: string[];
  amazonPhysical: string[];
  /** Barcodes of physical releases. Deezer's UPC is for the digital release, so it doesn't identify these. */
  barcodes: string[];
  /** The artist's official websites */
  homepages: string[];
  /** The hostnames of the artist's Bandcamp accounts */
  bandcampAccounts: string[];
  /** False if a request failed, in which case anything missing here may still exist */
  complete: boolean;
}

interface ArtistCredit {
  name: string;
  artist?: { id: string };
}

interface SearchedRelease {
  title: string;
  'artist-credit'?: ArtistCredit[];
  'release-group'?: { id: string };
}

interface SearchedReleaseGroup {
  id: string;
  title: string;
  'artist-credit'?: ArtistCredit[];
}

interface UrlRelation {
  type: string;
  ended?: boolean;
  url?: { resource: string };
}

interface Release {
  barcode?: string | null;
  media?: { format?: string | null }[];
  relations?: UrlRelation[];
}

interface ArtistDetails {
  relations?: UrlRelation[];
}

const emptyLinks = (): MusicBrainzLinks => ({
  discogs: [],
  sevendigital: [],
  amazonDigital: [],
  amazonPhysical: [],
  barcodes: [],
  homepages: [],
  bandcampAccounts: [],
  complete: true,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Space out this instance's requests. Instances can't see each other, so the
// lookup cache is what keeps our total request rate down.
let nextRequestSlot = 0;

/** Wait for our turn to send a request. Returns false if it wouldn't come before the deadline. */
async function waitForRequestSlot(deadline: number): Promise<boolean> {
  const now = Date.now();
  const slot = Math.max(now, nextRequestSlot);
  if (slot >= deadline) return false;

  nextRequestSlot = slot + MIN_REQUEST_GAP;
  if (slot > now) await sleep(slot - now);
  return true;
}

/** GET from MusicBrainz, returning null if it fails within the time left */
async function musicBrainzGet<T>(path: string, deadline: number): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (!await waitForRequestSlot(deadline)) return null;

      const response = await fetchWithTimeout(
        `${MUSICBRAINZ_API_URL}/${path}`,
        { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
        Math.min(REQUEST_TIMEOUT, deadline - Date.now())
      );

      if (response.ok) return await response.json();
      if (response.status !== 503 && response.status !== 429) {
        console.error('MusicBrainz API error:', response.status);
        return null;
      }
      console.error('MusicBrainz busy, attempt', attempt, 'status', response.status);
    } catch (error) {
      console.error('MusicBrainz fetch error:', error);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY);
  }

  return null;
}

function creditedToArtist(credits: ArtistCredit[] | undefined, artist: string): boolean {
  return (credits ?? []).some((credit) => isSameArtist(credit.name, artist));
}

function creditedArtistId(credits: ArtistCredit[] | undefined, artist: string): string | undefined {
  return credits?.find((credit) => isSameArtist(credit.name, artist))?.artist?.id;
}

/** Barcodes are stored with varying zero padding, so search with and without it */
function barcodeQuery(upc: string): string {
  const unpadded = normaliseBarcode(upc);
  return unpadded === upc ? `barcode:${upc}` : `barcode:${upc} OR barcode:${unpadded}`;
}

/** Prepare text to quote in a MusicBrainz search, whose syntax treats quotes and backslashes as special */
const searchTerm = (text: string) => plainQuotes(text).replace(/["\\]/g, '');

async function findByBarcode(upc: string, artist: string, album: string, deadline: number) {
  const query = encodeURIComponent(barcodeQuery(upc));
  const data = await musicBrainzGet<{ releases?: SearchedRelease[] }>(`release/?query=${query}&fmt=json&limit=5`, deadline);
  if (!data) return null;

  // Barcodes do get reused, so make sure that this is plausibly the same album
  const match = data.releases?.find(
    (release) => albumKey(release.title) === albumKey(album) || creditedToArtist(release['artist-credit'], artist)
  );
  return { releaseGroupId: match?.['release-group']?.id, artistId: creditedArtistId(match?.['artist-credit'], artist) };
}

async function findByTitle(artist: string, album: string, deadline: number) {
  const query = encodeURIComponent(`releasegroup:"${searchTerm(stripEdition(album))}" AND artist:"${searchTerm(artist)}"`);
  const data = await musicBrainzGet<{ 'release-groups'?: SearchedReleaseGroup[] }>(
    `release-group/?query=${query}&fmt=json&limit=5`,
    deadline
  );
  if (!data) return null;

  const match = data['release-groups']?.find(
    (group) => albumKey(group.title) === albumKey(album) && creditedToArtist(group['artist-credit'], artist)
  );
  return { releaseGroupId: match?.id, artistId: creditedArtistId(match?.['artist-credit'], artist) };
}

type ArtistLinks = Pick<MusicBrainzLinks, 'homepages' | 'bandcampAccounts'>;

async function findArtistLinks(artistId: string, deadline: number): Promise<ArtistLinks | null> {
  const data = await musicBrainzGet<ArtistDetails>(`artist/${artistId}?inc=url-rels&fmt=json`, deadline);
  if (!data) return null;

  const resourcesOfType = (type: string) => (data.relations ?? []).flatMap((relation) =>
    relation.type === type && !relation.ended && relation.url ? [relation.url.resource] : []
  );

  return {
    homepages: resourcesOfType('official homepage'),
    bandcampAccounts: resourcesOfType('bandcamp').flatMap((resource) => {
      try {
        return [new URL(resource).hostname.toLowerCase()];
      } catch {
        return [];
      }
    }),
  };
}

const isOnHost = (hostname: string, host: string) => hostname === host || hostname.endsWith(`.${host}`);

function isPhysical(release: Release): boolean {
  return (release.media ?? []).some((medium) => medium.format && medium.format !== 'Digital Media');
}

/** Prefer the page for the standard album over a deluxe or hi-res edition's page */
function bestBandcampUrl(urls: string[], album: string): string | undefined {
  const titles = nameKeys(stripEdition(album));
  const isExact = (url: string) => titles.includes(matchKey(url.split('/').pop() ?? ''));
  return urls.find(isExact) ?? urls[0];
}

function collectLinks(releases: Release[], album: string): MusicBrainzLinks {
  const links = emptyLinks();
  const bandcamp: string[] = [];
  const physicalDiscogs: string[] = [];
  const digitalDiscogs: string[] = [];

  for (const release of releases) {
    const physical = isPhysical(release);
    if (physical && release.barcode && !links.barcodes.includes(release.barcode)) {
      links.barcodes.push(release.barcode);
    }

    for (const relation of release.relations ?? []) {
      const resource = relation.url?.resource;
      if (!resource || relation.ended) continue;

      let url: URL;
      try {
        url = new URL(resource);
      } catch {
        continue;
      }
      // These links are community edited, and a change of protocol does nothing to other schemes
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      url.protocol = 'https:';
      const hostname = url.hostname.toLowerCase();
      const href = url.toString();

      if (hostname.endsWith('.bandcamp.com') && /^\/(album|track)\//.test(url.pathname)) {
        bandcamp.push(href);
      } else if (relation.type === 'discogs' && isOnHost(hostname, 'discogs.com')) {
        (physical ? physicalDiscogs : digitalDiscogs).push(href);
      } else if (relation.type === 'amazon asin') {
        (physical ? links.amazonPhysical : links.amazonDigital).push(href);
      } else if (relation.type === 'purchase for download') {
        if (hostname === 'www.qobuz.com') links.qobuz ??= href;
        else if (isOnHost(hostname, 'hdtracks.com') || isOnHost(hostname, 'hdtracks.co.uk')) links.hdtracks ??= href;
        else if (hostname.endsWith('.7digital.com')) links.sevendigital.push(href);
      }
    }
  }

  links.bandcamp = bestBandcampUrl(bandcamp, album);
  // Discogs is listed with our physical stores, so prefer physical pressings
  links.discogs = [...physicalDiscogs, ...digitalDiscogs];
  return links;
}

/** List the release titles of each artist with exactly this name, as several artists can share one */
export async function findDiscographies(artist: string): Promise<Lookup<string[][]>> {
  const deadline = Date.now() + LOOKUP_BUDGET;
  const query = encodeURIComponent(`artist:"${searchTerm(artist)}"`);

  const found = await musicBrainzGet<{ artists?: { id: string; name: string }[] }>(
    `artist/?query=${query}&fmt=json&limit=5`,
    deadline
  );
  if (!found) return { value: [], complete: false };

  const artists = (found.artists ?? []).filter(({ name }) => matchKey(name) === matchKey(artist));
  const discographies: string[][] = [];

  for (const { id } of artists.slice(0, MAX_ARTISTS_WITH_SAME_NAME)) {
    const data = await musicBrainzGet<{ 'release-groups'?: { title: string }[] }>(
      `release-group?artist=${id}&fmt=json&limit=${DISCOGRAPHY_SIZE}`,
      deadline
    );
    if (!data) return { value: discographies, complete: false };
    discographies.push((data['release-groups'] ?? []).map(({ title }) => title));
  }

  return { value: discographies, complete: true };
}

/**
 * Find an album's direct store links. Matches by barcode where possible, as
 * that identifies the album exactly, and otherwise by exact artist and title.
 */
export async function findMusicBrainzLinks(
  upc: string | undefined,
  artist: string,
  album: string
): Promise<Lookup<MusicBrainzLinks>> {
  const deadline = Date.now() + LOOKUP_BUDGET;

  let found = upc ? await findByBarcode(upc, artist, album, deadline) : null;
  let complete = !upc || found !== null;

  if (!found?.releaseGroupId) {
    const byTitle = await findByTitle(artist, album, deadline);
    if (byTitle?.releaseGroupId) {
      found = byTitle;
    }
    complete = complete && byTitle !== null;
  }

  if (!found?.releaseGroupId) {
    return { value: { ...emptyLinks(), complete }, complete };
  }

  const data = await musicBrainzGet<{ releases?: Release[] }>(
    `release?release-group=${found.releaseGroupId}&inc=url-rels+media&limit=100&fmt=json`,
    deadline
  );
  if (!data) return { value: { ...emptyLinks(), complete: false }, complete: false };

  const artistLinks = found.artistId ? await findArtistLinks(found.artistId, deadline) : null;
  complete = complete && (artistLinks !== null || !found.artistId);

  return { value: { ...collectLinks(data.releases ?? [], album), ...artistLinks, complete }, complete };
}
