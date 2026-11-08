/**
 * @jest-environment node
 */

// Set environment variables BEFORE importing the route
const DISCOGS_TOKEN = 'test_discogs_token';
process.env.DISCOGS_TOKEN = DISCOGS_TOKEN;

import { GET } from '@/app/api/buy-links/route';
import { settleWithTimers } from '@/test-utils/settle-with-timers';
import { NextRequest } from 'next/server';
import { PlatformLink } from '@/types';

const mockCache = new Map<string, unknown>();
const mockCacheSet = jest.fn();

jest.mock('@vercel/functions', () => ({
  ipAddress: jest.requireActual('@vercel/functions').ipAddress,
  getCache: () => ({
    get: async (key: string) => mockCache.get(key) ?? null,
    set: async (key: string, value: unknown, options: unknown) => {
      mockCacheSet(key, value, options);
      mockCache.set(key, value);
    },
  }),
}));

global.fetch = jest.fn();

type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };

const ok = (body: unknown): Reply => ({ ok: true, status: 200, json: async () => body });
const failure = (status: number): Reply => ({ ok: false, status, json: async () => ({}) });

const relation = (type: string, resource: string, ended = false) => ({ type, ended, url: { resource } });

// The same shapes as real responses for Mae Muller - Sorry I’m Late
const DEEZER_ALBUM = {
  id: 491149505,
  title: 'Sorry I’m Late',
  link: 'https://www.deezer.com/album/491149505',
  record_type: 'album',
  upc: '602455821812',
  cover_big: 'https://cdn-images.dzcdn.net/cover.jpg',
  cover_xl: 'https://cdn-images.dzcdn.net/cover-xl.jpg',
  artist: { id: 13432195, name: 'Mae Muller' },
};

const BARCODE_MATCH = {
  releases: [{
    title: 'Sorry I’m Late',
    barcode: '00602455821812',
    'artist-credit': [{ name: 'Mae Muller' }],
    'release-group': { id: 'release-group-id' },
  }],
};

const RELEASES_WITHOUT_STORES = {
  releases: [
    {
      media: [{ format: 'Digital Media' }],
      relations: [relation('streaming', 'https://tidal.com/album/317669235')],
    },
    {
      media: [{ format: 'CD' }],
      relations: [relation('discogs', 'https://www.discogs.com/release/28535932')],
    },
  ],
};

const ITUNES_ALBUM = {
  resultCount: 1,
  results: [{
    wrapperType: 'collection',
    collectionName: 'Sorry I’m Late',
    artistName: 'Mae Muller',
    collectionViewUrl: 'https://music.apple.com/gb/album/sorry-im-late/1688585521?uo=4',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/100x100bb.jpg',
  }],
};

type Api =
  | 'deezerAlbum' | 'deezerSearch' | 'barcodeSearch' | 'titleSearch' | 'releases' | 'artist'
  | 'itunesLookup' | 'itunesSearch' | 'discogs' | 'discogsRelease' | 'tavily';

type ReplyTo<Result> = (options?: RequestInit, url?: string) => Result;

const DEFAULT_REPLIES: Record<Api, ReplyTo<Reply>> = {
  deezerAlbum: () => ok(DEEZER_ALBUM),
  deezerSearch: () => ok({ data: [DEEZER_ALBUM] }),
  barcodeSearch: () => ok(BARCODE_MATCH),
  titleSearch: () => ok({ 'release-groups': [] }),
  releases: () => ok(RELEASES_WITHOUT_STORES),
  artist: () => ok({ relations: [] }),
  tavily: () => ok({ results: [] }),
  itunesLookup: () => ok(ITUNES_ALBUM),
  itunesSearch: () => ok({ results: [] }),
  discogs: () => ok({ results: [{ title: 'Mae Muller - Sorry I’m Late', uri: '/release/12345' }] }),
  discogsRelease: () => ok({ title: 'Sorry I’m Late' }),
};

// Lookups catch their own errors, so throwing from a mock wouldn't fail the test. afterEach checks this instead.
const unexpectedFetches: string[] = [];

function apiFor(url: string): Api | null {
  if (url.includes('api.deezer.com/album/')) return 'deezerAlbum';
  if (url.includes('api.deezer.com/search')) return 'deezerSearch';
  if (url.includes('musicbrainz.org/ws/2/release/?')) return 'barcodeSearch';
  if (url.includes('musicbrainz.org/ws/2/release-group/')) return 'titleSearch';
  if (url.includes('musicbrainz.org/ws/2/release?')) return 'releases';
  if (url.includes('musicbrainz.org/ws/2/artist/')) return 'artist';
  if (url === 'https://api.tavily.com/search') return 'tavily';
  if (url.includes('itunes.apple.com/lookup')) return 'itunesLookup';
  if (url.includes('itunes.apple.com/search')) return 'itunesSearch';
  if (url.includes('api.discogs.com/releases/')) return 'discogsRelease';
  if (url.includes('api.discogs.com')) return 'discogs';
  return null;
}

function defaultReply(url: string): Reply {
  const api = apiFor(url);
  if (api) return DEFAULT_REPLIES[api]();

  unexpectedFetches.push(url);
  return failure(599);
}

function mockApis(replies: Partial<Record<Api, ReplyTo<Reply | Promise<Reply>>>> = {}) {
  (global.fetch as jest.Mock).mockImplementation(async (url: string, options?: RequestInit) => {
    const api = apiFor(url);
    const reply = api && replies[api];
    return reply ? reply(options, url) : defaultReply(url);
  });
}

const fetchedUrls = () => (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
const countCalls = (api: Api) => fetchedUrls().filter((url) => apiFor(url) === api).length;

/** Call the route, running the timers behind its rate limiting and retries */
async function getBuyLinks(query: string, headers?: Record<string, string>) {
  const response = await settleWithTimers(GET(new NextRequest(`http://localhost:3000/api/buy-links?${query}`, { headers })));
  const data = await response.json();
  const link = (platform: string): PlatformLink | undefined =>
    data.links?.find((item: PlatformLink) => item.platform === platform);
  return { status: response.status, data, link };
}

const MAE_MULLER = `artist=Mae%20Muller&album=${encodeURIComponent('Sorry I’m Late')}`;
const MAE_MULLER_GB = `${MAE_MULLER}&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/491149505')}`;

/** Fill in MusicBrainz's answer for an album, as its rate limit would otherwise stagger simultaneous requests */
const seedMusicBrainz = (upc: string | number) => mockCache.set(`musicbrainz:${upc}`, {
  value: {
    discogs: [], sevendigital: [], amazonDigital: [], amazonPhysical: [], barcodes: [],
    homepages: ['https://www.maemuller.com/'], bandcampAccounts: [], complete: true,
  },
});

const releasesWith = (...relations: ReturnType<typeof relation>[]) =>
  () => ok({ releases: [{ media: [{ format: 'Digital Media' }], relations }] });

describe('/api/buy-links', () => {
  // The rate limiter remembers when it last sent a request, so time can't go backwards between tests
  // Each test also gets its own day, as the budget counts spending per day. Noon keeps them from crossing midnight.
  let clock = Date.UTC(2026, 0, 1, 12);

  beforeEach(() => {
    clock += 24 * 60 * 60 * 1000;
    jest.useFakeTimers({ now: clock, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    mockCache.clear();
    unexpectedFetches.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env.DISCOGS_TOKEN = DISCOGS_TOKEN;
    expect(unexpectedFetches).toEqual([]);
  });

  describe('Input Validation', () => {
    it('should return 400 if artist is missing', async () => {
      const { status, data } = await getBuyLinks('album=OK%20Computer');

      expect(status).toBe(400);
      expect(data.error).toBe('Artist and album parameters are required');
    });

    it('should return 400 if album is missing', async () => {
      const { status } = await getBuyLinks('artist=Radiohead');

      expect(status).toBe(400);
    });

    it('should return 400 for invalid region', async () => {
      const { status, data } = await getBuyLinks('artist=Radiohead&album=OK%20Computer&region=INVALID');

      expect(status).toBe(400);
      expect(data.error).toBe('Invalid region parameter');
    });

    it('should accept valid regions', async () => {
      mockApis();

      for (const region of ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP']) {
        const { status } = await getBuyLinks(`${MAE_MULLER}&region=${region}`);
        expect(status).toBe(200);
      }
    });

    it('should only use a Deezer link to look up an album', async () => {
      mockApis();

      await getBuyLinks(`${MAE_MULLER}&url=${encodeURIComponent('https://example.com/album/123')}`);

      // apiFor throws on any other host, and the album was found by name instead
      expect(countCalls('deezerSearch')).toBeGreaterThan(0);
    });
  });

  describe('When sources are unavailable', () => {
    const allDown = () => {
      throw new Error('Network error');
    };

    it('should still list every store if all sources are down', async () => {
      mockApis({
        deezerAlbum: allDown, deezerSearch: allDown, barcodeSearch: allDown, titleSearch: allDown,
        releases: allDown, itunesLookup: allDown, itunesSearch: allDown, discogs: allDown,
      });

      const { status, data } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(data.links.map((l: PlatformLink) => l.platform).sort()).toEqual([
        'amazonDigital', 'amazonPhysical', 'bandcamp', 'banquet', 'discogs', 'hdtracks',
        'itunes', 'musicmagpie', 'qobuz', 'sevendigital', 'worldofbooks',
      ]);
      expect(data.links.every((l: PlatformLink) => l.isSearch)).toBe(true);
    });

    it('should show the album details if all sources are down', async () => {
      mockApis({ deezerAlbum: allDown, barcodeSearch: allDown, titleSearch: allDown, itunesLookup: allDown });

      const { data } = await getBuyLinks(MAE_MULLER_GB);

      expect(data.metadata).toEqual({ title: 'Sorry I’m Late', artistName: 'Mae Muller' });
    });

    it('should keep direct links from other sources if MusicBrainz is down', async () => {
      mockApis({
        barcodeSearch: () => failure(503),
        titleSearch: () => failure(503),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.isSearch).toBeUndefined();
      expect(link('bandcamp')?.isSearch).toBe(true);
    });

    it('should keep direct links from other sources if iTunes is down', async () => {
      mockApis({
        itunesLookup: () => failure(403),
        itunesSearch: () => failure(403),
        releases: releasesWith(relation('purchase for download', 'https://artist.bandcamp.com/album/sorry-im-late')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.url).toBe('https://artist.bandcamp.com/album/sorry-im-late');
      expect(link('itunes')?.isSearch).toBe(true);
    });

    it('should report Deezer errors sent with HTTP 200 as failed, not as no album', async () => {
      mockApis({ deezerAlbum: () => ok({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }) });

      await getBuyLinks(MAE_MULLER_GB);

      const deezerEntry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('deezer:'));
      expect(deezerEntry?.[2]).toEqual({ ttl: 300 });
    });
  });

  describe('Finding albums', () => {
    it('should find an album by name when it was opened from a shared link', async () => {
      mockApis();

      const { data, link } = await getBuyLinks(`${MAE_MULLER}&region=GB`);

      expect(countCalls('deezerSearch')).toBeGreaterThan(0);
      expect(fetchedUrls().some((url) => url.includes('barcode%3A602455821812'))).toBe(true);
      expect(link('itunes')?.isSearch).toBeUndefined();
      expect(data.metadata.artwork).toBe('https://cdn-images.dzcdn.net/cover.jpg');
    });

    it('should return the artist ID from the album', async () => {
      mockApis();

      const { data } = await getBuyLinks(MAE_MULLER_GB);

      expect(data.metadata.artistId).toBe('13432195');
    });

    it('should prefer the album over a single with the same name', async () => {
      const release = (id: number, record_type: string) => ({ ...DEEZER_ALBUM, id, record_type, title: 'SOURCE', artist: { id: 1, name: 'Nubya Garcia' } });
      mockApis({
        deezerSearch: () => ok({ data: [release(111, 'single'), release(222, 'album')] }),
      });

      await getBuyLinks('artist=Nubya%20Garcia&album=SOURCE&region=GB');

      const albumLookup = fetchedUrls().find((url) => apiFor(url) === 'deezerAlbum');
      expect(albumLookup).toContain('/album/222');
    });

    it('should still give links for an album that Deezer does not have', async () => {
      mockApis({ deezerSearch: () => ok({ data: [] }) });

      const { status, data } = await getBuyLinks('artist=Unknown&album=Unsigned%20Demo');

      expect(status).toBe(200);
      expect(data.links.length).toBeGreaterThan(0);
      expect(countCalls('barcodeSearch')).toBe(0);
      expect(countCalls('titleSearch')).toBeGreaterThan(0);
    });

    it('should search barcodes with and without zero padding', async () => {
      mockApis({ deezerAlbum: () => ok({ ...DEEZER_ALBUM, upc: '0634904074067' }) });

      await getBuyLinks(MAE_MULLER_GB);

      const url = fetchedUrls().find((item) => apiFor(item) === 'barcodeSearch');
      expect(decodeURIComponent(url ?? '')).toContain('barcode:0634904074067 OR barcode:634904074067');
    });

    it('should not trust a reused barcode on an unrelated album', async () => {
      mockApis({
        barcodeSearch: () => ok({
          releases: [{
            title: 'Something Else',
            'artist-credit': [{ name: 'Another Artist' }],
            'release-group': { id: 'wrong-group' },
          }],
        }),
        itunesLookup: () => ok({
          results: [{
            wrapperType: 'collection',
            collectionName: 'Something Else',
            artistName: 'Another Artist',
            collectionViewUrl: 'https://music.apple.com/gb/album/wrong/1',
          }],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(fetchedUrls().some((url) => url.includes('wrong-group'))).toBe(false);
      expect(link('itunes')?.isSearch).toBe(true);
    });

    it('should only accept a title match by the same artist', async () => {
      mockApis({
        barcodeSearch: () => ok({ releases: [] }),
        titleSearch: () => ok({
          'release-groups': [
            { id: 'cover-version', title: 'Sorry I’m Late', 'artist-credit': [{ name: 'Someone Else' }] },
            { id: 'right-group', title: 'Sorry I’m Late', 'artist-credit': [{ name: 'Mae Muller' }] },
          ],
        }),
      });

      await getBuyLinks(MAE_MULLER_GB);

      expect(fetchedUrls().some((url) => url.includes('right-group'))).toBe(true);
      expect(fetchedUrls().some((url) => url.includes('cover-version'))).toBe(false);
    });

    it('should ignore edition markers when matching titles', async () => {
      mockApis({
        barcodeSearch: () => ok({ releases: [] }),
        titleSearch: () => ok({
          'release-groups': [{ id: 'right-group', title: 'Blue Rev', 'artist-credit': [{ name: 'Alvvays' }] }],
        }),
      });

      await getBuyLinks(`artist=Alvvays&album=${encodeURIComponent('Blue Rev (Deluxe Edition)')}&url=${encodeURIComponent('https://www.deezer.com/album/1')}`);

      const titleSearch = fetchedUrls().find((url) => apiFor(url) === 'titleSearch');
      expect(decodeURIComponent(titleSearch ?? '')).toContain('releasegroup:"Blue Rev"');
      expect(fetchedUrls().some((url) => url.includes('right-group'))).toBe(true);
    });
  });

  describe('Album links', () => {
    it('should treat zeros in front of an album ID as the same album', async () => {
      mockApis();

      await getBuyLinks(`${MAE_MULLER}&url=${encodeURIComponent('https://www.deezer.com/album/000491149505')}`);

      expect(fetchedUrls()).toContain('https://api.deezer.com/album/491149505');
    });
  });

  describe('Names that start with another artist', () => {
    const BELLE_AND_SEBASTIAN = `artist=${encodeURIComponent('Belle and Sebastian')}&album=Tigermilk`;
    const byArtist = (id: number, name: string) => ({ ...DEEZER_ALBUM, id, title: 'Tigermilk', artist: { id, name } });
    const itunesAlbum = (artistName: string, path: string) => ({
      ...ITUNES_ALBUM.results[0],
      artistName,
      collectionName: 'Tigermilk',
      collectionViewUrl: `https://music.apple.com/gb/album/${path}`,
    });

    it('should prefer the whole name on Deezer', async () => {
      mockApis({ deezerSearch: () => ok({ data: [byArtist(1, 'Belle'), byArtist(2, 'Belle and Sebastian')] }) });

      await getBuyLinks(BELLE_AND_SEBASTIAN);

      expect(fetchedUrls()).toContain('https://api.deezer.com/album/2');
    });

    it('should prefer the whole name on iTunes', async () => {
      mockApis({
        deezerSearch: () => ok({ data: [] }),
        itunesSearch: () => ok({ results: [itunesAlbum('Belle', 'belle/1'), itunesAlbum('Belle and Sebastian', 'tigermilk/2')] }),
      });

      const { link } = await getBuyLinks(BELLE_AND_SEBASTIAN);

      expect(link('itunes')?.url).toBe('https://music.apple.com/gb/album/tigermilk/2');
    });

    it('should still accept the first of a list of artists', async () => {
      mockApis({ deezerSearch: () => ok({ data: [] }), itunesSearch: () => ok({ results: [itunesAlbum('Belle', 'belle/1')] }) });

      const { link } = await getBuyLinks(`artist=${encodeURIComponent('Belle, Sebastian')}&album=Tigermilk`);

      expect(link('itunes')?.url).toBe('https://music.apple.com/gb/album/belle/1');
    });
  });

  describe('Bandcamp', () => {
    it('should use a direct link from MusicBrainz', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://nubyagarcia.bandcamp.com/album/source')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')).toEqual({
        platform: 'bandcamp',
        displayName: 'Bandcamp',
        category: 'download',
        url: 'https://nubyagarcia.bandcamp.com/album/source',
      });
    });

    it('should fall back to a labelled search when MusicBrainz has no link', async () => {
      mockApis();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.isSearch).toBe(true);
      expect(link('bandcamp')?.url).toBe("https://bandcamp.com/search?q=Mae%20Muller%20Sorry%20I'm%20Late&item_type=a");
    });

    it('should never call Bandcamp itself', async () => {
      mockApis();

      await getBuyLinks(MAE_MULLER_GB);

      expect(fetchedUrls().some((url) => url.includes('bandcamp.com'))).toBe(false);
    });

    it('should prefer the standard album page over other editions', async () => {
      mockApis({
        releases: releasesWith(
          relation('purchase for download', 'https://band.bandcamp.com/album/sorry-im-late-deluxe'),
          relation('purchase for download', 'https://band.bandcamp.com/album/sorry-im-late')
        ),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.url).toBe('https://band.bandcamp.com/album/sorry-im-late');
    });

    it('should recognise the standard album when its title has an ampersand, which slugs drop', async () => {
      mockApis({
        deezerAlbum: () => ok({ ...DEEZER_ALBUM, title: 'Carrie & Lowell' }),
        releases: releasesWith(
          relation('purchase for download', 'https://band.bandcamp.com/album/carrie-lowell-10th-anniversary-edition'),
          relation('purchase for download', 'https://band.bandcamp.com/album/carrie-lowell')
        ),
      });

      const { link } = await getBuyLinks(
        `artist=Mae%20Muller&album=Carrie%20%26%20Lowell&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/491149505')}`
      );

      expect(link('bandcamp')?.url).toBe('https://band.bandcamp.com/album/carrie-lowell');
    });

    it('should skip links marked as ended', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://band.bandcamp.com/album/sorry-im-late', true)),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.isSearch).toBe(true);
    });

    it('should ignore links to an artist page rather than an album', async () => {
      mockApis({ releases: releasesWith(relation('purchase for download', 'https://band.bandcamp.com/')) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.isSearch).toBe(true);
    });

    it('should upgrade http links', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'http://band.bandcamp.com/album/sorry-im-late')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.url).toBe('https://band.bandcamp.com/album/sorry-im-late');
    });
  });

  describe('Store links', () => {
    it('should strip tracking from the iTunes link', async () => {
      mockApis();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.url).toBe('https://music.apple.com/gb/album/sorry-im-late/1688585521');
    });

    it('should pick the right album when a UPC returns several of the artist\'s releases', async () => {
      const result = (collectionName: string, id: number) => ({
        ...ITUNES_ALBUM.results[0],
        collectionName,
        collectionViewUrl: `https://music.apple.com/gb/album/x/${id}`,
      });
      mockApis({ itunesLookup: () => ok({ results: [result('Sorry I’m Late (B Sides)', 1), result('Sorry I’m Late', 2)] }) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.url).toBe('https://music.apple.com/gb/album/x/2');
    });

    it('should not use a UPC result with a different title', async () => {
      mockApis({ itunesLookup: () => ok({ results: [{ ...ITUNES_ALBUM.results[0], collectionName: 'Sorry I’m Late (B Sides)' }] }) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.isSearch).toBe(true);
    });

    it('should search iTunes by name when the UPC is not found', async () => {
      mockApis({ itunesLookup: () => ok({ results: [] }), itunesSearch: () => ok(ITUNES_ALBUM) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.isSearch).toBeUndefined();
    });

    it('should use the iTunes store for the region', async () => {
      mockApis();

      await getBuyLinks(`${MAE_MULLER}&region=DE&url=${encodeURIComponent('https://www.deezer.com/album/491149505')}`);

      expect(fetchedUrls().some((url) => url.includes('lookup?upc=602455821812&country=DE'))).toBe(true);
    });

    it('should use a direct Amazon link when it matches the region', async () => {
      mockApis({
        releases: () => ok({
          releases: [{
            media: [{ format: 'CD' }],
            relations: [relation('amazon asin', 'https://www.amazon.co.uk/gp/product/B085RVQ9XV')],
          }],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('amazonPhysical')?.url).toBe('https://www.amazon.co.uk/gp/product/B085RVQ9XV');
      expect(link('amazonPhysical')?.category).toBe('physical');
      expect(link('amazonDigital')?.isSearch).toBe(true);
    });

    it('should fall back to search when an Amazon link is for a different region', async () => {
      mockApis({
        releases: () => ok({
          releases: [{
            media: [{ format: 'CD' }],
            relations: [relation('amazon asin', 'https://www.amazon.com/gp/product/B085RVQ9XV')],
          }],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('amazonPhysical')?.url).toContain('amazon.co.uk/s?k=');
      expect(link('amazonPhysical')?.isSearch).toBe(true);
    });

    it('should file a digital Amazon link under Amazon Music', async () => {
      mockApis({
        releases: releasesWith(relation('amazon asin', 'https://www.amazon.co.uk/dp/B0DIGITAL')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('amazonDigital')?.url).toBe('https://www.amazon.co.uk/dp/B0DIGITAL');
    });

    it('should move Qobuz links to the region locale', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://www.qobuz.com/us-en/album/source/q3f0go2f3evvc')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('qobuz')?.url).toBe('https://www.qobuz.com/gb-en/album/source/q3f0go2f3evvc');
    });

    it('should add the region locale to Qobuz links without one', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://www.qobuz.com/album/migration-bonobo/5054429005721')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('qobuz')?.url).toBe('https://www.qobuz.com/gb-en/album/migration-bonobo/5054429005721');
    });

    it('should use a 7digital link for the region', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://uk.7digital.com/artist/x/release/y')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('sevendigital')?.url).toBe('https://uk.7digital.com/artist/x/release/y');
      expect(link('sevendigital')?.isSearch).toBeUndefined();
    });

    it('should use an HDtracks link', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://www.hdtracks.com/album/1')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('hdtracks')?.url).toBe('https://www.hdtracks.com/album/1');
    });

    it('should only use 7digital links for the region', async () => {
      mockApis({
        releases: releasesWith(relation('purchase for download', 'https://us.7digital.com/artist/x/release/y')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('sevendigital')?.url).toContain('uk.7digital.com/search');
    });

    it('should use the Discogs link from MusicBrainz without searching Discogs', async () => {
      mockApis();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('discogs')?.url).toBe('https://www.discogs.com/release/28535932');
      expect(countCalls('discogs')).toBe(0);
    });

    it('should prefer a physical pressing on Discogs', async () => {
      mockApis({
        releases: () => ok({
          releases: [
            { media: [{ format: 'Digital Media' }], relations: [relation('discogs', 'https://www.discogs.com/release/1')] },
            { media: [{ format: '12" Vinyl' }], relations: [relation('discogs', 'https://www.discogs.com/release/2')] },
          ],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('discogs')?.url).toBe('https://www.discogs.com/release/2');
    });

    describe('with Discogs links that may be out of date', () => {
      const pressings = () => ok({
        releases: [
          { media: [{ format: 'CD' }], relations: [relation('discogs', 'https://www.discogs.com/release/111')] },
          { media: [{ format: 'CD' }], relations: [relation('discogs', 'https://www.discogs.com/release/222')] },
        ],
      });

      it('should skip a release that no longer exists', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
          if (url.includes('/releases/111')) return failure(404);
          return apiFor(url) === 'releases' ? pressings() : defaultReply(url);
        });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/222');
        expect(countCalls('discogs')).toBe(0);
      });

      it('should search Discogs if none of the releases exist', async () => {
        mockApis({ releases: pressings, discogsRelease: () => failure(404) });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/12345');
      });

      it('should keep the link if Discogs is unavailable to check it', async () => {
        mockApis({ releases: pressings, discogsRelease: () => failure(429) });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/111');
        const entry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('discogs:'));
        expect(entry?.[2]).toEqual({ ttl: 300 });
      });

      it('should keep the link if there is no token to check it with', async () => {
        delete process.env.DISCOGS_TOKEN;
        mockApis({ releases: pressings });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/111');
        expect(countCalls('discogsRelease')).toBe(0);
      });
    });

    it('should search Discogs when MusicBrainz has no link', async () => {
      mockApis({ releases: () => ok({ releases: [] }) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('discogs')?.url).toBe('https://www.discogs.com/release/12345');
    });

    it('should link to a Discogs search if the Discogs API fails', async () => {
      mockApis({ releases: () => ok({ releases: [] }), discogs: () => failure(500) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('discogs')?.url).toContain('discogs.com/search');
      expect(link('discogs')?.isSearch).toBe(true);
    });

    it('should not cut a band name short in search links', async () => {
      mockApis();

      const { link } = await getBuyLinks(`artist=${encodeURIComponent('Simon & Garfunkel')}&album=Bookends`);

      expect(link('banquet')?.url).toContain('q=Simon%20%26%20Garfunkel%20Bookends');
    });

    it('should sort downloads before physical media, then by name', async () => {
      mockApis();

      const { data } = await getBuyLinks(MAE_MULLER_GB);

      expect(data.links.map((l: PlatformLink) => l.displayName)).toEqual([
        '7digital', 'Amazon Music', 'Bandcamp', 'HDtracks', 'iTunes', 'Qobuz',
        'Amazon', 'Banquet Records', 'Discogs', 'musicMagpie', 'World of Books',
      ]);
    });

    describe('World of Books regions', () => {
      const WOB_RESULT = { title: 'Blue Rev', url: 'https://www.worldofbooks.com/en-au/products/blue-rev-cd-5400863087845' };
      const mockPage = () => {
        process.env.TAVILY_API_KEY = 'test_tavily_key';
        mockApis({
          releases: () => ok({
            releases: [{ barcode: '5400863087845', media: [{ format: 'CD' }], relations: [] }],
          }),
          tavily: (options) => ok({
            results: JSON.parse(String(options?.body)).include_domains.includes('worldofbooks.com') ? [WOB_RESULT] : [],
          }),
        });
      };
      const viewFrom = (region: string) => getBuyLinks(MAE_MULLER_GB.replace('region=GB', `region=${region}`));

      afterEach(() => {
        delete process.env.TAVILY_API_KEY;
      });

      it.each([
        ['GB', 'en-gb/'],
        ['AU', 'en-au/'],
        ['US', ''],
        ['CA', ''],
        ['DE', ''],
        ['FR', ''],
        ['JP', ''],
      ])('should link %s to a store that exists', async (region, path) => {
        mockPage();

        const { link } = await viewFrom(region);

        expect(link('worldofbooks')?.url).toBe(`https://www.worldofbooks.com/${path}products/blue-rev-cd-5400863087845`);
      });

      it.each([
        ['GB', 'en-gb/'],
        ['AU', 'en-au/'],
        ['US', ''],
        ['DE', ''],
      ])('should search a store that exists for %s', async (region, path) => {
        mockApis();

        const { link } = await viewFrom(region);

        expect(link('worldofbooks')?.url).toContain(`https://www.worldofbooks.com/${path}search?q=`);
        expect(link('worldofbooks')?.url).toContain('hierarchicalCategories.lvl0%5D%5B0%5D=Music');
      });
    });

    it('should use a direct musicMagpie link for UK visitors', async () => {
      process.env.TAVILY_API_KEY = 'test_tavily_key';
      const url = 'https://www.musicmagpie.co.uk/store/products/mullermaesorryimlat';
      mockApis({
        tavily: (options) => ok({
          results: JSON.parse(String(options?.body)).include_domains.includes('musicmagpie.co.uk')
            ? [{ title: "Mae Muller - Sorry I'm Late CD / Album - musicMagpie Store", url }]
            : [],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);
      delete process.env.TAVILY_API_KEY;

      expect(link('musicmagpie')?.url).toBe(url);
      expect(link('musicmagpie')?.isSearch).toBeUndefined();
    });

    describe('Discogs master pages', () => {
      const physicalRelease = () => ok({
        releases: [{
          barcode: '602455732767',
          media: [{ format: 'CD' }],
          relations: [relation('discogs', 'https://www.discogs.com/release/111')],
        }],
      });
      const barcodeResults = (...results: unknown[]) => () => ok({ results });
      const cdWith = (barcode: string, ...relations: ReturnType<typeof relation>[]) =>
        ({ barcode, media: [{ format: 'CD' }], relations });

      it('should only try the first two barcodes', async () => {
        mockApis({
          releases: () => ok({ releases: ['111111111111', '222222222222', '333333333333'].map((barcode) => cdWith(barcode)) }),
          discogs: barcodeResults(),
        });

        await getBuyLinks(MAE_MULLER_GB);

        expect(fetchedUrls().filter((url) => url.includes('barcode='))).toHaveLength(2);
      });

      it('should only check the first three releases', async () => {
        const dead = [1, 2, 3, 4].map((id) => relation('discogs', `https://www.discogs.com/release/${id}`));
        mockApis({
          releases: () => ok({ releases: [cdWith('', ...dead)] }),
          discogs: barcodeResults(),
          discogsRelease: () => failure(404),
        });

        await getBuyLinks(MAE_MULLER_GB);

        expect(countCalls('discogsRelease')).toBe(3);
      });

      it('should try again soon if the barcode search failed, even if a name search worked', async () => {
        mockApis({
          releases: () => ok({ releases: [cdWith('111111111111')] }),
          discogs: (_options, url) => url?.includes('barcode=')
            ? failure(500)
            : ok({ results: [{ title: 'Mae Muller - Sorry I’m Late', uri: '/release/12345' }] }),
        });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/12345');
        const entry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('discogs:'));
        expect(entry?.[2]).toEqual({ ttl: 300 });
      });

      it('should link to the master page found by a physical barcode', async () => {
        mockApis({
          releases: physicalRelease,
          discogs: barcodeResults({ title: "Mae Muller - Sorry I'm Late", uri: '/release/222', master_id: 3256204 }),
        });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/master/3256204');
        expect(fetchedUrls().some((url) => url.includes('barcode=602455732767'))).toBe(true);
      });

      it('should use the release if it has no master', async () => {
        mockApis({
          releases: physicalRelease,
          discogs: barcodeResults({ title: "Mae Muller - Sorry I'm Late", uri: '/release/222', master_id: 0 }),
        });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/222');
      });

      it('should not trust a reused barcode on another artist', async () => {
        mockApis({
          releases: physicalRelease,
          discogs: barcodeResults({ title: 'Someone Else - Something', uri: '/release/222', master_id: 999 }),
        });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/111');
      });

      it('should fall back to known releases if the barcode search fails, and retry soon', async () => {
        mockApis({ releases: physicalRelease, discogs: () => failure(429) });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('discogs')?.url).toBe('https://www.discogs.com/release/111');
        const entry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('discogs:'));
        expect(entry?.[2]).toEqual({ ttl: 300 });
      });

      it('should only collect barcodes from physical releases', async () => {
        mockApis({
          releases: () => ok({ releases: [{ barcode: '602455821812', media: [{ format: 'Digital Media' }], relations: [] }] }),
        });

        await getBuyLinks(MAE_MULLER_GB);

        expect(fetchedUrls().some((url) => url.includes('barcode=602455821812'))).toBe(false);
      });
    });

    it('should search musicMagpie for UK visitors', async () => {
      mockApis();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('musicmagpie')).toEqual({
        platform: 'musicmagpie',
        displayName: 'musicMagpie',
        category: 'physical',
        url: "https://www.musicmagpie.co.uk/store/category/?keyword=Mae%20Muller%20Sorry%20I'm%20Late",
        isSearch: true,
      });
    });

    it.each(['US', 'CA', 'AU', 'DE', 'FR', 'JP'])('should not offer musicMagpie in %s, as it only delivers within the UK', async (region) => {
      mockApis();

      const { link } = await getBuyLinks(MAE_MULLER_GB.replace('region=GB', `region=${region}`));

      expect(link('musicmagpie')).toBeUndefined();
    });
  });

  describe('Searching store websites', () => {
    const BANDCAMP_PAGE = 'https://maemuller.bandcamp.com/album/sorry-im-late';
    const BANQUET_PAGE = 'https://www.banquetrecords.com/mae-muller/sorry-i%27m-late/EMICD2097';
    const STORE_PAGE = 'https://shop.maemuller.com/products/sorry-im-late-standard-vinyl';

    const SITE_RESULTS: Record<string, { title: string; url: string }[]> = {
      'bandcamp.com': [{ title: "Sorry I'm Late | Mae Muller", url: BANDCAMP_PAGE }],
      'banquetrecords.com': [{ title: "Mae Muller - Sorry I'm Late", url: BANQUET_PAGE }],
      'maemuller.com': [{ title: "Sorry I'm Late - Standard Vinyl - Mae Muller", url: STORE_PAGE }],
    };

    const searchedDomain = (options?: RequestInit) => JSON.parse(String(options?.body)).include_domains[0] as string;
    const searchSite = (options?: RequestInit) => ok({ results: SITE_RESULTS[searchedDomain(options)] ?? [] });

    const tavilyCalls = () => (global.fetch as jest.Mock).mock.calls.filter(([url]) => apiFor(url) === 'tavily');
    const searchedDomains = () => tavilyCalls().map(([, options]) => searchedDomain(options)).sort();

    const CREDITED_MATCH = () => ok({
      releases: [{
        ...BARCODE_MATCH.releases[0],
        'artist-credit': [{ name: 'Mae Muller', artist: { id: 'artist-id' } }],
      }],
    });
    const OFFICIAL_SITE = () => ok({ relations: [relation('official homepage', 'https://www.maemuller.com/')] });

    const mockSearches = (replies: Parameters<typeof mockApis>[0] = {}) =>
      mockApis({ tavily: searchSite, barcodeSearch: CREDITED_MATCH, artist: OFFICIAL_SITE, ...replies });

    beforeEach(() => {
      process.env.TAVILY_API_KEY = 'test_tavily_key';
    });

    afterEach(() => {
      delete process.env.TAVILY_API_KEY;
    });

    it('should use direct links found on store websites', async () => {
      mockSearches();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')).toEqual({ platform: 'bandcamp', displayName: 'Bandcamp', category: 'download', url: BANDCAMP_PAGE });
      expect(link('banquet')?.url).toBe(BANQUET_PAGE);
      expect(link('banquet')?.isSearch).toBeUndefined();
    });

    it('should show the artist store without calling it a place to buy', async () => {
      mockSearches();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('artistStore')).toEqual({ platform: 'artistStore', displayName: "Artist's store", category: 'physical', url: STORE_PAGE });
    });

    it('should use the Tavily search API correctly', async () => {
      mockSearches();

      await getBuyLinks(MAE_MULLER_GB);

      const [, options] = tavilyCalls()[0];
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer test_tavily_key');
      expect(JSON.parse(options.body)).toMatchObject({ query: "Mae Muller Sorry I'm Late", max_results: 20, search_depth: 'basic' });
    });

    it('should only ever search chosen sites, never the open web', async () => {
      mockSearches();

      await getBuyLinks(MAE_MULLER_GB);

      const searched = tavilyCalls().map(([, options]) => JSON.parse(options.body).include_domains).sort();
      expect(searched).toEqual([
        ['bandcamp.com'],
        ['banquetrecords.com'],
        ['maemuller.com'],
        ['musicmagpie.co.uk', 'worldofbooks.com'],
        ['qobuz.com'],
      ]);
    });

    it('should never make requests to the stores themselves', async () => {
      mockSearches();

      await getBuyLinks(MAE_MULLER_GB);

      for (const site of ['bandcamp.com', 'qobuz.com', 'banquetrecords.com', '7digital.com', 'maemuller.com']) {
        expect(fetchedUrls().some((url) => url.includes(site))).toBe(false);
      }
    });

    it('should not search for what MusicBrainz already has', async () => {
      mockSearches({
        releases: releasesWith(
          relation('purchase for download', 'https://band.bandcamp.com/album/sorry-im-late'),
          relation('purchase for download', 'https://www.qobuz.com/us-en/album/sorry-im-late/abc')
        ),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(searchedDomains()).toEqual(['banquetrecords.com', 'maemuller.com', 'musicmagpie.co.uk']);
      expect(link('bandcamp')?.url).toBe('https://band.bandcamp.com/album/sorry-im-late');
    });

    describe('Qobuz locales', () => {
      const QOBUZ_PAGE = (locale: string, id: string) => `https://www.qobuz.com/${locale}/album/sorry-im-late-mae-muller/${id}`;
      const qobuzResults = (...urls: string[]) => (options?: RequestInit) =>
        searchedDomain(options) === 'qobuz.com'
          ? ok({ results: urls.map((url) => ({ title: "Sorry I'm Late, Mae Muller", url })) })
          : ok({ results: [] });

      it('should prefer the ID listed for the region', async () => {
        mockSearches({ tavily: qobuzResults(QOBUZ_PAGE('us-en', 'usid'), QOBUZ_PAGE('gb-en', 'gbid')) });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('qobuz')?.url).toBe(QOBUZ_PAGE('gb-en', 'gbid'));
      });

      it('should move another locale to the region if that is all there is', async () => {
        mockSearches({ tavily: qobuzResults(QOBUZ_PAGE('nl-nl', 'nlid')) });

        const { link } = await getBuyLinks(MAE_MULLER_GB);

        expect(link('qobuz')?.url).toBe(QOBUZ_PAGE('gb-en', 'nlid'));
      });
    });

    describe('Regional artist stores', () => {
      const STORES = {
        main: 'https://shop.maemuller.com/products/sorry-im-late-cd',
        us: 'https://shopus.maemuller.com/products/sorry-im-late-cd',
        eu: 'https://eustore.maemuller.com/products/sorry-im-late-cd',
      };
      const storeResults = (...urls: string[]) => (options?: RequestInit) =>
        searchedDomain(options) === 'maemuller.com'
          ? ok({ results: urls.map((url) => ({ title: "Sorry I'm Late CD", url })) })
          : ok({ results: [] });
      const viewFrom = (region: string) => getBuyLinks(MAE_MULLER_GB.replace('region=GB', `region=${region}`));

      it('should use the shop for the region', async () => {
        mockSearches({ tavily: storeResults(STORES.main, STORES.us, STORES.eu) });

        expect((await viewFrom('US')).link('artistStore')?.url).toBe(STORES.us);
        expect((await viewFrom('DE')).link('artistStore')?.url).toBe(STORES.eu);
      });

      it('should use the main shop for regions without their own', async () => {
        mockSearches({ tavily: storeResults(STORES.us, STORES.main) });

        expect((await viewFrom('GB')).link('artistStore')?.url).toBe(STORES.main);
      });

      it('should use a shop for another region if that is all there is', async () => {
        mockSearches({ tavily: storeResults(STORES.us) });

        expect((await viewFrom('GB')).link('artistStore')?.url).toBe(STORES.us);
      });
    });

    it('should show the official site when it has no product page', async () => {
      mockSearches({
        tavily: (options) => ok({
          results: searchedDomain(options) === 'maemuller.com' ? [{ title: 'Tour dates', url: 'https://www.maemuller.com/tour' }] : [],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('artistStore')).toBeUndefined();
      expect(link('officialSite')).toEqual({
        platform: 'officialSite',
        displayName: 'Official site',
        category: 'physical',
        url: 'https://www.maemuller.com/',
      });
    });

    it('should leave out both cards if there is no homepage', async () => {
      mockSearches({ artist: () => ok({ relations: [] }) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('artistStore')).toBeUndefined();
      expect(link('officialSite')).toBeUndefined();
      expect(searchedDomains()).toEqual(['bandcamp.com', 'banquetrecords.com', 'musicmagpie.co.uk', 'qobuz.com']);
    });

    it('should keep every search link if there is no API key', async () => {
      delete process.env.TAVILY_API_KEY;
      mockSearches();

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(tavilyCalls()).toHaveLength(0);
      expect(link('bandcamp')?.isSearch).toBe(true);
    });

    it.each([[429], [432], [433], [500]])('should keep search links if Tavily answers %i', async (status) => {
      mockSearches({ tavily: () => failure(status) });

      const { status: responseStatus, link } = await getBuyLinks(MAE_MULLER_GB);

      expect(responseStatus).toBe(200);
      expect(link('bandcamp')?.isSearch).toBe(true);
      expect(link('banquet')?.isSearch).toBe(true);
    });

    it('should keep search links if Tavily is unreachable', async () => {
      mockSearches({ tavily: () => { throw new Error('Network error'); } });

      const { status, link } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(link('bandcamp')?.isSearch).toBe(true);
    });

    it('should not wait long for a slow search', async () => {
      (global.fetch as jest.Mock).mockImplementation(async (url: string, options: RequestInit) => {
        if (apiFor(url) === 'tavily') {
          return new Promise((_, reject) => {
            options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          });
        }
        return defaultReply(url);
      });

      const started = Date.now();
      const { status } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(Date.now() - started).toBeLessThan(10000);
    });

    it('should only search homepages that are current, and are homepages', async () => {
      mockSearches({
        artist: () => ok({
          relations: [
            relation('official homepage', 'https://www.oldsite.com/', true),
            relation('social network', 'https://www.socialsite.com/'),
          ],
        }),
      });

      await getBuyLinks(MAE_MULLER_GB);

      expect(searchedDomains()).toEqual(['bandcamp.com', 'banquetrecords.com', 'musicmagpie.co.uk', 'qobuz.com']);
    });

    it('should not search for albums that Deezer does not have', async () => {
      mockSearches({ deezerSearch: () => ok({ data: [] }) });

      await getBuyLinks('artist=Unknown&album=Unsigned%20Demo');

      expect(tavilyCalls()).toHaveLength(0);
    });

    it.each([
      ['artist', `artist=Radiohead&album=${encodeURIComponent('Sorry I’m Late')}`],
      ['album', 'artist=Mae%20Muller&album=Kid%20A'],
    ])('should not store results under an album whose link has a different %s', async (_field, names) => {
      mockSearches();

      await getBuyLinks(`${names}&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/491149505')}`);

      expect(tavilyCalls()).toHaveLength(0);
    });

    describe('Collaborations', () => {
      // The same shape as the real album, which Deezer lists under Apollo Brown
      const LUXURY_TAX = {
        ...DEEZER_ALBUM,
        id: 1079516982,
        title: 'Luxury Tax',
        upc: '3663729465955',
        artist: { id: 301841121, name: 'Apollo Brown' },
        contributors: [
          { id: 301841121, name: 'Apollo Brown', role: 'Main' },
          { id: 115834, name: 'Skyzoo', role: 'Main' },
        ],
      };
      const FROM_SKYZOO_ALBUMS = `artist=Skyzoo&album=Luxury%20Tax&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/1079516982')}`;
      const DIRECT_VISIT = 'artist=Skyzoo&album=Luxury%20Tax&region=GB';
      const BANDCAMP = 'https://apollobrown.bandcamp.com/album/luxury-tax';

      const mockLuxuryTax = (album: Record<string, unknown> = LUXURY_TAX) => mockApis({
        barcodeSearch: () => ok({ releases: [] }),
        deezerAlbum: () => ok(album),
        deezerSearch: () => ok({ data: [album] }),
        tavily: (options) => ok({
          results: searchedDomain(options) === 'bandcamp.com'
            ? [{ title: 'Luxury Tax | Apollo Brown, Skyzoo', url: BANDCAMP }]
            : [],
        }),
      });


      it('should not repeat a Deezer search on a direct visit', async () => {
        mockLuxuryTax();

        await getBuyLinks(DIRECT_VISIT);

        const searches = fetchedUrls().filter((url) => url.includes('api.deezer.com/search'));
        expect(searches.length).toBeGreaterThan(0);
        expect(new Set(searches).size).toBe(searches.length);
      });

      it('should find store pages for an artist who is not listed first', async () => {
        mockLuxuryTax();

        const { link } = await getBuyLinks(FROM_SKYZOO_ALBUMS);

        expect(link('bandcamp')?.url).toBe(BANDCAMP);
        expect(link('bandcamp')?.isSearch).toBeUndefined();
      });

      it('should find the album on a direct visit, with its artwork', async () => {
        mockLuxuryTax();

        const { data, link } = await getBuyLinks(DIRECT_VISIT);

        expect(data.metadata.artwork).toBe(LUXURY_TAX.cover_big);
        expect(link('bandcamp')?.url).toBe(BANDCAMP);
      });

      it('should link back to the albums of the artist that was asked for', async () => {
        mockLuxuryTax();

        const { data } = await getBuyLinks(FROM_SKYZOO_ALBUMS);

        expect(data.metadata.artistId).toBe('115834');
      });

      it('should not treat a featured guest as the album artist', async () => {
        const guestAlbum = {
          ...LUXURY_TAX,
          contributors: [
            { id: 301841121, name: 'Apollo Brown', role: 'Main' },
            { id: 115834, name: 'Skyzoo', role: 'Featured' },
          ],
        };
        mockLuxuryTax(guestAlbum);

        await getBuyLinks(FROM_SKYZOO_ALBUMS);
        await getBuyLinks(DIRECT_VISIT);

        expect(tavilyCalls()).toHaveLength(0);
      });
    });

    it('should not search for compilations, which the artist can not tell apart', async () => {
      mockSearches({
        deezerAlbum: () => ok({ ...DEEZER_ALBUM, title: 'Summer Hits', artist: { id: 5080, name: 'Various Artists' } }),
        deezerSearch: () => ok({ data: [] }),
      });

      await getBuyLinks(`artist=Various%20Artists&album=Summer%20Hits&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/1')}`);

      expect(tavilyCalls()).toHaveLength(0);
    });

    it('should trust a Bandcamp account that MusicBrainz lists for the artist', async () => {
      const url = 'https://mmuller.bandcamp.com/album/sorry-im-late';
      mockSearches({
        artist: () => ok({ relations: [relation('bandcamp', 'https://mmuller.bandcamp.com/')] }),
        tavily: (options) => ok({
          results: searchedDomain(options) === 'bandcamp.com' ? [{ title: "Sorry I'm Late", url }] : [],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.url).toBe(url);
    });

    it('should wait for the artist details from MusicBrainz too', async () => {
      mockSearches({ artist: () => failure(503) });

      await getBuyLinks(MAE_MULLER_GB);

      expect(tavilyCalls()).toHaveLength(0);
      const entry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('musicbrainz:'));
      expect(entry?.[2]).toEqual({ ttl: 300 });
    });

    it('should wait for MusicBrainz before searching, as its gaps may not be real', async () => {
      mockSearches({ releases: () => failure(503) });

      await getBuyLinks(MAE_MULLER_GB);

      expect(tavilyCalls()).toHaveLength(0);
      expect(mockCacheSet.mock.calls.some(([key]) => String(key).startsWith('store-pages:'))).toBe(false);
    });

    describe('Caching', () => {
      const storePagesEntry = () => mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('store-pages:'));

      it('should keep store pages for less time than other lookups', async () => {
        mockSearches();

        await getBuyLinks(MAE_MULLER_GB);

        expect(storePagesEntry()?.[2]).toEqual({ ttl: 7 * 24 * 60 * 60 });
      });

      it('should share results across regions rather than spending credits again', async () => {
        mockSearches();

        await getBuyLinks(MAE_MULLER_GB);
        const creditsForFirstView = tavilyCalls().length;
        await getBuyLinks(MAE_MULLER_GB.replace('region=GB', 'region=DE'));

        expect(tavilyCalls()).toHaveLength(creditsForFirstView);
      });

      it('should share one search between people viewing a new album together', async () => {
        mockSearches();
        seedMusicBrainz(DEEZER_ALBUM.upc);

        await Promise.all([getBuyLinks(MAE_MULLER_GB), getBuyLinks(MAE_MULLER_GB.replace('region=GB', 'region=DE'))]);

        expect(tavilyCalls()).toHaveLength(5);
      });

      it('should search again once a shared lookup has finished', async () => {
        mockSearches({ tavily: () => failure(500) });
        await getBuyLinks(MAE_MULLER_GB);
        const firstCalls = tavilyCalls().length;
        mockCache.clear();

        await getBuyLinks(MAE_MULLER_GB);

        expect(tavilyCalls()).toHaveLength(firstCalls * 2);
      });

      it('should retry soon if a search failed', async () => {
        mockSearches({ tavily: () => failure(500) });

        await getBuyLinks(MAE_MULLER_GB);

        expect(storePagesEntry()?.[2]).toEqual({ ttl: 300 });
      });

      it('should retry soon if there is no API key, so that adding one takes effect', async () => {
        delete process.env.TAVILY_API_KEY;
        mockSearches();

        await getBuyLinks(MAE_MULLER_GB);

        expect(storePagesEntry()?.[2]).toEqual({ ttl: 300 });
      });
    });

    describe('Credit budget', () => {
      // A new album costs 5 credits here, and each view below is of a "new" album
      const viewNewAlbum = async (visitor?: string) => {
        mockCache.forEach((_, key) => {
          if (key.startsWith('store-pages:')) mockCache.delete(key);
        });
        return getBuyLinks(MAE_MULLER_GB, visitor ? { 'x-real-ip': visitor } : undefined);
      };

      const viewManyAlbums = (headers?: Record<string, string>) => {
        mockSearches({ deezerAlbum: (_options, url) => ok({ ...DEEZER_ALBUM, upc: url?.match(/\d+$/)?.[0] }) });

        return Promise.all(Array.from({ length: 20 }, (_, index) => {
          const id = index + 1;
          seedMusicBrainz(id);
          return getBuyLinks(`${MAE_MULLER}&region=GB&url=${encodeURIComponent(`https://www.deezer.com/album/${id}`)}`, headers);
        }));
      };

      it('should stop for the day before overspending', async () => {
        mockSearches();

        for (let view = 0; view < 6; view++) await viewNewAlbum();
        expect(tavilyCalls()).toHaveLength(30);

        const { status, link } = await viewNewAlbum();

        expect(tavilyCalls()).toHaveLength(30);
        expect(status).toBe(200);
        expect(link('bandcamp')?.isSearch).toBe(true);
      });

      it('should count every search in a batch', async () => {
        mockSearches();

        await viewNewAlbum();

        const budget = mockCacheSet.mock.calls.find(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(String(key)));
        expect(budget?.[1]).toBe(5);
        expect(budget?.[2]).toEqual({ ttl: 2 * 24 * 60 * 60 });
      });

      it('should keep a whole month under the free allowance', async () => {
        mockSearches();
        let longestMonth = 0;

        for (let day = 0; day < 31; day++) {
          const before = tavilyCalls().length;
          for (let view = 0; view < 10; view++) await viewNewAlbum();
          longestMonth += tavilyCalls().length - before;
          await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
        }

        expect(longestMonth).toBe(930);
      });

      it('should hold when simultaneous requests all read the same count', async () => {
        await viewManyAlbums();

        expect(tavilyCalls()).toHaveLength(30);
      });

      it('should limit each visitor to a share of the day, leaving the rest for others', async () => {
        mockSearches();

        for (let view = 0; view < 5; view++) await viewNewAlbum('203.0.113.1');
        expect(tavilyCalls()).toHaveLength(15);

        await viewNewAlbum('203.0.113.2');
        expect(tavilyCalls()).toHaveLength(20);
      });

      it('should hold the visitor limit when their requests arrive together', async () => {
        await viewManyAlbums({ 'x-real-ip': '203.0.113.1' });

        expect(tavilyCalls()).toHaveLength(15);
      });

      it("should not count a refused search against a visitor's share", async () => {
        mockSearches();
        const today = new Date().toISOString().slice(0, 10);
        mockCache.set(today, 30);

        await viewNewAlbum('203.0.113.1');
        expect(tavilyCalls()).toHaveLength(0);

        mockCache.set(today, 0);
        for (let view = 0; view < 3; view++) await viewNewAlbum('203.0.113.1');
        expect(tavilyCalls()).toHaveLength(15);
      });

      it('should not spend if the cache is down, which looks like an empty budget', async () => {
        mockSearches();
        jest.spyOn(mockCache, 'get').mockReturnValue(undefined);

        const { status, link } = await getBuyLinks(MAE_MULLER_GB);

        expect(tavilyCalls()).toHaveLength(0);
        expect(status).toBe(200);
        expect(link('bandcamp')?.isSearch).toBe(true);
      });

      it('should not let a failed read wipe the count', async () => {
        mockSearches();
        const realGet = mockCache.get.bind(mockCache);
        jest.spyOn(mockCache, 'get').mockImplementation((key: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(key) ? undefined : realGet(key)
        );

        for (let view = 0; view < 8; view++) await viewNewAlbum();

        expect(tavilyCalls()).toHaveLength(30);
      });

      it('should not spend if the budget cannot be read', async () => {
        mockSearches();
        const realGet = mockCache.get.bind(mockCache);
        jest.spyOn(mockCache, 'get').mockImplementation((key: string) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Cache unavailable');
          return realGet(key);
        });

        const { status, link } = await getBuyLinks(MAE_MULLER_GB);

        expect(tavilyCalls()).toHaveLength(0);
        expect(status).toBe(200);
        expect(link('bandcamp')?.isSearch).toBe(true);
      });
    });
  });

  describe('Requests that disagree with the album they link to', () => {
    const OTHER_ALBUM = `artist=Radiohead&album=Kid%20A&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/491149505')}`;
    const keysStored = () => mockCacheSet.mock.calls.map(([key]) => String(key));

    it("should store nothing under that album's UPC", async () => {
      mockApis();

      await getBuyLinks(OTHER_ALBUM);

      expect(keysStored().filter((key) => key.includes('602455821812'))).toEqual([]);
    });

    it("should not look the other name up by that album's barcode", async () => {
      mockApis();

      await getBuyLinks(OTHER_ALBUM);

      expect(countCalls('barcodeSearch')).toBe(0);
      expect(countCalls('itunesLookup')).toBe(0);
    });

    it("should leave that album's links intact for everyone else", async () => {
      mockApis({ releases: releasesWith(relation('purchase for download', 'https://band.bandcamp.com/album/sorry-im-late')) });
      await getBuyLinks(OTHER_ALBUM);

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('bandcamp')?.url).toBe('https://band.bandcamp.com/album/sorry-im-late');
    });

    it("should look up the names that Deezer has, not the request's spelling", async () => {
      mockApis({ barcodeSearch: () => ok({ releases: [] }) });

      await getBuyLinks(`artist=${encodeURIComponent('Mae\u200bMuller')}&album=${encodeURIComponent('Sorry I’m Late')}&url=${encodeURIComponent('https://www.deezer.com/album/491149505')}`);

      const titleSearch = fetchedUrls().find((url) => apiFor(url) === 'titleSearch');
      expect(decodeURIComponent(titleSearch ?? '')).toContain('artist:"Mae Muller"');
    });

    it('should keep titles that only differ in symbols apart', async () => {
      mockApis({ deezerSearch: () => ok({ data: [] }) });

      await getBuyLinks(`artist=Ed%20Sheeran&album=${encodeURIComponent('÷ (Deluxe)')}`);
      const callsAfterFirst = countCalls('deezerSearch');
      await getBuyLinks(`artist=Ed%20Sheeran&album=${encodeURIComponent('- (Deluxe)')}`);

      expect(countCalls('deezerSearch')).toBeGreaterThan(callsAfterFirst);
    });

    it('should keep the whole name in search links once Deezer confirms it', async () => {
      const artist = 'Simon & Garfunkel';
      mockApis({
        deezerAlbum: () => ok({ ...DEEZER_ALBUM, title: 'Bookends', artist: { id: 1, name: artist } }),
        barcodeSearch: () => ok({ releases: [] }),
      });

      const { link } = await getBuyLinks(`artist=${encodeURIComponent(artist)}&album=Bookends&region=GB&url=${encodeURIComponent('https://www.deezer.com/album/1')}`);

      expect(link('banquet')?.url).toContain('q=Simon%20%26%20Garfunkel%20Bookends');
    });
  });

  describe('Community-edited links', () => {
    it.each([
      ['discogs', 'https://evil.example/release/1'],
      ['discogs', 'https://notdiscogs.com/release/1'],
      ['purchase for download', 'https://evilhdtracks.com/album/1'],
      ['purchase for download', 'javascript://a.bandcamp.com/album/x?%0aalert(1)'],
    ])('should ignore a %s link to %s', async (type, url) => {
      mockApis({ releases: releasesWith(relation(type, url)), discogs: () => ok({ results: [] }) });

      const { data } = await getBuyLinks(MAE_MULLER_GB);

      expect(JSON.stringify(data.links)).not.toContain(url);
    });
  });

  describe('Discogs and MusicBrainz outages', () => {
    const discogsEntry = () => mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('discogs:'));

    it('should try MusicBrainz again soon if its barcode search failed, even if a title search worked', async () => {
      mockApis({
        barcodeSearch: () => failure(503),
        titleSearch: () => ok({
          'release-groups': [{ id: 'release-group-id', title: 'Sorry I’m Late', 'artist-credit': [{ name: 'Mae Muller' }] }],
        }),
      });

      await getBuyLinks(MAE_MULLER_GB);

      const entry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('musicbrainz:'));
      expect(entry?.[2]).toEqual({ ttl: 300 });
    });

    it('should only keep a Discogs result briefly if MusicBrainz was down', async () => {
      mockApis({ releases: () => failure(503) });

      await getBuyLinks(MAE_MULLER_GB);

      expect(discogsEntry()?.[2]).toEqual({ ttl: 300 });
    });

    it('should try again soon if there is no Discogs token, so that adding one takes effect', async () => {
      delete process.env.DISCOGS_TOKEN;
      mockApis();

      await getBuyLinks(MAE_MULLER_GB);

      expect(discogsEntry()?.[2]).toEqual({ ttl: 300 });
    });

    it('should give up on Discogs within its time budget', async () => {
      // Each reply beats the timeout on its request, but in a row they'd keep people waiting
      const slowly = (reply: Reply): ReplyTo<Promise<Reply>> => (options) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(reply), 4000);
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      mockApis({
        releases: () => ok({
          releases: [
            { barcode: '111111111111', media: [{ format: 'CD' }], relations: [] },
            { barcode: '222222222222', media: [{ format: 'CD' }], relations: [relation('discogs', 'https://www.discogs.com/release/1')] },
          ],
        }),
        discogs: slowly(ok({ results: [] })),
        discogsRelease: slowly(failure(404)),
      });

      const started = Date.now();
      const { status, link } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(Date.now() - started).toBeLessThan(13000);
      expect(link('discogs')?.url).toBeDefined();
      expect(discogsEntry()?.[2]).toEqual({ ttl: 300 });
    });

    it("should not search Discogs with text that no catalog has confirmed, as searches carry our token", async () => {
      mockApis({ deezerSearch: () => ok({ data: [] }) });

      const { link } = await getBuyLinks(`artist=Someone&album=${encodeURIComponent('Anything they type')}&region=GB`);

      expect(countCalls('discogs')).toBe(0);
      expect(link('discogs')?.isSearch).toBe(true);
    });

    it('should not use a Discogs search result for another album', async () => {
      mockApis({
        releases: () => ok({ releases: [] }),
        discogs: () => ok({ results: [{ title: 'Mae Muller - Bootleg', uri: '/release/999' }] }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('discogs')?.isSearch).toBe(true);
    });
  });

  describe('When the cache fails', () => {
    it('should still answer if reads fail', async () => {
      mockApis();
      jest.spyOn(mockCache, 'get').mockImplementation(() => { throw new Error('Cache unavailable'); });

      const { status, link } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(link('itunes')?.isSearch).toBeUndefined();
    });

    it('should still answer if writes fail', async () => {
      mockApis();
      jest.spyOn(mockCache, 'set').mockImplementation(() => { throw new Error('Cache unavailable'); });

      const { status, link } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(link('itunes')?.isSearch).toBeUndefined();
    });
  });

  describe('iTunes', () => {
    it('should use full size artwork if Deezer has none', async () => {
      mockApis({ deezerAlbum: () => ok({ ...DEEZER_ALBUM, cover_big: undefined, cover_xl: undefined }) });

      const { data } = await getBuyLinks(MAE_MULLER_GB);

      expect(data.metadata.artwork).toBe('https://is1-ssl.mzstatic.com/image/600x600bb.jpg');
    });

    it('should try again soon if the UPC lookup failed, even if a name search worked', async () => {
      mockApis({ itunesLookup: () => failure(500), itunesSearch: () => ok(ITUNES_ALBUM) });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.url).toBe('https://music.apple.com/gb/album/sorry-im-late/1688585521');
      const entry = mockCacheSet.mock.calls.find(([key]) => String(key).startsWith('itunes:'));
      expect(entry?.[2]).toEqual({ ttl: 300 });
    });
  });

  describe('iTunes name search', () => {
    it('should not accept the same title by another artist', async () => {
      mockApis({
        itunesLookup: () => ok({ results: [] }),
        itunesSearch: () => ok({
          results: [{ ...ITUNES_ALBUM.results[0], artistName: 'Someone Else', collectionViewUrl: 'https://music.apple.com/gb/album/wrong/1' }],
        }),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(link('itunes')?.isSearch).toBe(true);
    });
  });

  describe('MusicBrainz reliability', () => {
    it('should identify the app in its User-Agent', async () => {
      mockApis();

      await getBuyLinks(MAE_MULLER_GB);

      const [, options] = (global.fetch as jest.Mock).mock.calls.find(([url]) => apiFor(url) === 'barcodeSearch');
      expect(options.headers['User-Agent']).toBe('StreamToShelf/1.0 (https://streamtoshelf.com)');
    });

    it('should retry when MusicBrainz is busy', async () => {
      const replies = [failure(503), ok(BARCODE_MATCH)];
      mockApis({
        barcodeSearch: () => replies.shift() as Reply,
        releases: releasesWith(relation('purchase for download', 'https://band.bandcamp.com/album/sorry-im-late')),
      });

      const { link } = await getBuyLinks(MAE_MULLER_GB);

      expect(countCalls('barcodeSearch')).toBe(2);
      expect(link('bandcamp')?.url).toBe('https://band.bandcamp.com/album/sorry-im-late');
    });

    it('should retry when MusicBrainz is rate limiting', async () => {
      const replies = [failure(429), ok(BARCODE_MATCH)];
      mockApis({ barcodeSearch: () => replies.shift() as Reply });

      await getBuyLinks(MAE_MULLER_GB);

      expect(countCalls('barcodeSearch')).toBe(2);
    });

    it('should wait at least a second between requests', async () => {
      const times: number[] = [];
      const record = (reply: () => Reply) => () => {
        times.push(Date.now());
        return reply();
      };
      mockApis({
        barcodeSearch: record(DEFAULT_REPLIES.barcodeSearch),
        releases: record(DEFAULT_REPLIES.releases),
      });

      await getBuyLinks(MAE_MULLER_GB);

      expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
    });

    it('should give up within its time budget', async () => {
      // MusicBrainz never answers, so each request only ends when it times out
      (global.fetch as jest.Mock).mockImplementation(async (url: string, options: RequestInit) => {
        if (apiFor(url) === 'barcodeSearch' || apiFor(url) === 'titleSearch') {
          return new Promise((_, reject) => {
            options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          });
        }
        return defaultReply(url);
      });

      const started = Date.now();
      const { status, link } = await getBuyLinks(MAE_MULLER_GB);

      expect(status).toBe(200);
      expect(link('bandcamp')?.isSearch).toBe(true);
      expect(Date.now() - started).toBeLessThan(16000);
    });
  });

  describe('Caching', () => {
    const cacheEntry = (prefix: string) =>
      mockCacheSet.mock.calls.find(([key]) => String(key).startsWith(prefix));

    const FOURTEEN_DAYS = 14 * 24 * 60 * 60;
    const FIVE_MINUTES = 5 * 60;

    it('should keep complete results for weeks', async () => {
      mockApis();

      await getBuyLinks(MAE_MULLER_GB);

      expect(cacheEntry('musicbrainz:602455821812')?.[2]).toEqual({ ttl: FOURTEEN_DAYS });
      expect(cacheEntry('itunes:GB:602455821812')?.[2]).toEqual({ ttl: FOURTEEN_DAYS });
    });

    it('should keep results from a failed lookup only briefly', async () => {
      mockApis({ barcodeSearch: () => failure(503), titleSearch: () => failure(503) });

      await getBuyLinks(MAE_MULLER_GB);

      expect(cacheEntry('musicbrainz:')?.[2]).toEqual({ ttl: FIVE_MINUTES });
    });

    it('should keep results briefly if only the last lookup fails', async () => {
      mockApis({ releases: () => failure(503) });

      await getBuyLinks(MAE_MULLER_GB);

      expect(cacheEntry('musicbrainz:')?.[2]).toEqual({ ttl: FIVE_MINUTES });
    });

    it('should not repeat any lookups for an album it has seen', async () => {
      mockApis();

      await getBuyLinks(MAE_MULLER_GB);
      const callsAfterFirstView = fetchedUrls().length;
      await getBuyLinks(MAE_MULLER_GB);

      expect(fetchedUrls().length).toBe(callsAfterFirstView);
    });

    it('should remember when an album is not found', async () => {
      mockApis({
        itunesLookup: () => ok({ results: [] }),
        itunesSearch: () => ok({ results: [] }),
      });

      await getBuyLinks(MAE_MULLER_GB);
      await getBuyLinks(MAE_MULLER_GB);

      expect(countCalls('itunesLookup')).toBe(1);
    });

    it('should share MusicBrainz results across regions, but not iTunes results', async () => {
      mockApis();

      await getBuyLinks(MAE_MULLER_GB);
      await getBuyLinks(MAE_MULLER_GB.replace('region=GB', 'region=DE'));

      expect(countCalls('barcodeSearch')).toBe(1);
      expect(countCalls('itunesLookup')).toBe(2);
    });
  });
});
