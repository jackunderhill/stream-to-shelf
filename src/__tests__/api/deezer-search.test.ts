/**
 * @jest-environment node
 */

import { GET } from '@/app/api/deezer-search/route';
import { settleWithTimers } from '@/test-utils/settle-with-timers';
import { NextRequest } from 'next/server';

const mockCache = new Map<string, unknown>();
const mockCacheSet = jest.fn();

jest.mock('@vercel/functions', () => ({
  waitUntil: jest.fn(),
  getCache: () => ({
    get: async (key: string) => mockCache.get(key) ?? null,
    set: async (key: string, value: unknown, options: unknown) => {
      mockCacheSet(key, value, options);
      mockCache.set(key, value);
    },
  }),
}));

global.fetch = jest.fn();

// Lookups catch their own errors, so throwing from a mock wouldn't fail the test. afterEach checks this instead.
const unexpectedFetches: string[] = [];

const album = (id: number, title: string, artist: string) => ({
  id,
  title,
  link: `https://www.deezer.com/album/${id}`,
  cover_big: `https://cdn-images.dzcdn.net/${id}.jpg`,
  cover_xl: `https://cdn-images.dzcdn.net/${id}-xl.jpg`,
  record_type: 'album',
  artist: { id: 1, name: artist },
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Routes mocked Deezer responses by the decoded search query */
function mockDeezerSearch(responses: (query: string) => unknown) {
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    const query = new URL(url).searchParams.get('q') ?? '';
    return ok(responses(query));
  });
}

const search = (params: string) =>
  GET(new NextRequest(`http://localhost:3000/api/deezer-search?${params}`));

describe('/api/deezer-search', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    mockCache.clear();
    mockCacheSet.mockClear();
    unexpectedFetches.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    expect(unexpectedFetches).toEqual([]);
  });

  it('should return 400 if artist is missing', async () => {
    const response = await search('album=Blue%20Rev');

    expect(response.status).toBe(400);
  });

  it('should fall back to a plain search when the fielded query finds nothing', async () => {
    mockDeezerSearch((query) =>
      query.includes('artist:') ? { data: [] } : { data: [album(1, 'Blue Rev', 'Alvvays')] }
    );

    const response = await search('artist=Alvvays&album=Blue%20Rev');
    const data = await response.json();

    expect(data.results.map((r: { name: string }) => r.name)).toEqual(['Blue Rev']);
  });

  it('should not run the plain search when the fielded query succeeds', async () => {
    mockDeezerSearch(() => ({ data: [album(1, 'OK Computer', 'Radiohead')] }));

    await search('artist=Radiohead&album=OK%20Computer');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should apply the artist filter to plain search results', async () => {
    mockDeezerSearch((query) =>
      query.includes('artist:')
        ? { data: [] }
        : { data: [album(1, 'Blue Rev', 'Someone Else'), album(2, 'Blue Rev', 'Alvvays')] }
    );

    const data = await (await search('artist=Alvvays&album=Blue%20Rev')).json();

    expect(data.results.map((r: { id: string }) => r.id)).toEqual(['2']);
  });

  it('should match a straight apostrophe against a curly one in the title', async () => {
    mockDeezerSearch(() => ({ data: [album(1, 'Sorry I’m Late', 'Mae Muller')] }));

    const data = await (await search(`artist=Mae%20Muller&album=${encodeURIComponent("Sorry I'm Late")}`)).json();

    expect(data.results).toHaveLength(1);
  });

  it('should match artist names that differ only by punctuation', async () => {
    mockDeezerSearch(() => ({ data: [album(1, 'Dogrel', 'Fontaines D.C.')] }));

    const data = await (await search('artist=Fontaines%20DC&album=Dogrel')).json();

    expect(data.results).toHaveLength(1);
  });

  it('should keep non-Latin titles from matching everything', async () => {
    mockDeezerSearch(() => ({ data: [album(1, '坂本龍一', 'Artist'), album(2, '別のアルバム', 'Artist')] }));

    const data = await (await search(`artist=Artist&album=${encodeURIComponent('坂本龍一')}`)).json();

    expect(data.results.map((r: { id: string }) => r.id)).toEqual(['1']);
  });

  it('should strip double quotes that would break the fielded query', async () => {
    mockDeezerSearch(() => ({ data: [] }));

    await search(`artist=${encodeURIComponent('The "Band"')}&album=Songs`);

    const firstQuery = new URL((global.fetch as jest.Mock).mock.calls[0][0]).searchParams.get('q');
    expect(firstQuery).toBe('artist:"The Band" album:"Songs"');
  });

  describe('Searching by artist name alone', () => {
    const artistResult = (id: number, name: string, nb_fan: number) => ({ id, name, nb_fan });
    const BONOBO = 2108;
    const ARTISTS = [
      artistResult(13463103, 'Bonobo', 72),
      artistResult(BONOBO, 'Bonobo', 366283),
      artistResult(403956452, 'Lady_Bonobo_', 10),
    ];
    const bonoboAlbum = (id: number, title: string) => ({ ...album(id, title, 'Bonobo'), artist: { id: BONOBO, name: 'Bonobo' } });
    const SIMILAR_NAMES = [album(1, 'Rapunzel', 'Lady_Bonobo_'), bonoboAlbum(2, 'Migration')];

    function mockDeezer(artists: { id: number; name: string }[], discography: unknown[], albums: unknown[] = SIMILAR_NAMES) {
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const { pathname } = new URL(url);
        if (pathname === '/search/artist') return ok({ data: artists });
        if (pathname === '/search/album') return ok({ data: albums, total: albums.length });
        if (pathname.endsWith('/albums')) return ok({ data: discography });
        if (pathname.startsWith('/artist/')) return ok(artists.find(({ id }) => pathname === `/artist/${id}`));
        unexpectedFetches.push(url);
        return { ok: false, status: 599, json: async () => ({}) };
      });
    }

    const fetchedPaths = () => (global.fetch as jest.Mock).mock.calls.map(([url]) => new URL(url).pathname);
    const titles = async (params: string) =>
      (await (await search(params)).json()).results.map((r: { name: string }) => r.name);

    it('should show the discography of the artist with that exact name, not similar names', async () => {
      mockDeezer(ARTISTS, [bonoboAlbum(3, 'Fragments'), bonoboAlbum(4, 'Migration')]);

      expect(await titles('artist=Bonobo')).toEqual(['Fragments', 'Migration']);
    });

    it('should choose the best known artist when several have that name', async () => {
      mockDeezer(ARTISTS, []);

      await search('artist=Bonobo');

      expect(fetchedPaths()).toContain(`/artist/${BONOBO}/albums`);
      expect(fetchedPaths()).not.toContain('/artist/13463103/albums');
    });

    it('should ignore case and punctuation in the name', async () => {
      mockDeezer([artistResult(5, 'Fontaines D.C.', 100)], [album(3, 'Romance', 'Fontaines D.C.')]);

      expect(await titles('artist=fontaines%20dc')).toEqual(['Romance']);
    });

    it('should still find artists from part of their name', async () => {
      mockDeezer([artistResult(6, 'Fleetwood Mac', 100)], [album(3, 'Not This', 'Other')], [album(1, 'Rumours', 'Fleetwood Mac')]);

      expect(await titles('artist=Fleetwood')).toEqual(['Rumours']);
    });

    it('should not let a little-known artist hide a famous one that starts with the same name', async () => {
      const artists = [artistResult(7, 'Fleetwood', 25), artistResult(8, 'Fleetwood Mac', 1683553)];
      mockDeezer(artists, [album(3, 'Not This', 'Fleetwood')], [album(1, 'Rumours', 'Fleetwood Mac')]);

      expect(await titles('artist=Fleetwood')).toEqual(['Rumours']);
    });

    it('should keep an exact name that is less famous than a similar one', async () => {
      const artists = [artistResult(9, 'James', 83949), artistResult(10, 'James Blunt', 1560736)];
      mockDeezer(artists, [album(3, 'Laid', 'James')], [album(1, 'Back to Bedlam', 'James Blunt')]);

      expect(await titles('artist=James')).toEqual(['Laid']);
    });

    it('should search albums if the artist has no discography', async () => {
      mockDeezer(ARTISTS, []);

      expect(await titles('artist=Bonobo')).toEqual(['Rapunzel', 'Migration']);
    });

    it('should still search albums when an album name is given', async () => {
      mockDeezer(ARTISTS, [], [bonoboAlbum(2, 'Migration')]);

      expect(await titles('artist=Bonobo&album=Migration')).toEqual(['Migration']);
      expect(fetchedPaths()).not.toContain('/search/artist');
    });
  });

  it('should use the artist discography when an artist ID is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(ok({ name: 'Radiohead', data: [album(1, 'Kid A', 'ignored')] }));

    const data = await (await search('artist=Radiohead&artistId=399')).json();

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/artist/399/albums');
    expect(data.results[0].artists[0].name).toBe('Radiohead');
  });

  describe('Artists split across several profiles', () => {
    // The same shape as Apollo Brown, whose catalogue is spread across these Deezer profiles
    const SELECTED = 1264158;
    const MELLO = 352569022;
    const ESCAPISM = 301841121;
    const UNRELATED = 352569032;

    const release = (id: number, title: string, release_date: string, profile: number, name = 'Apollo Brown') => ({
      ...album(id, title, name),
      release_date,
      artist: { id: profile, name },
    });

    const buildDiscographies = (): Record<number, ReturnType<typeof release>[]> => ({
      [SELECTED]: [
        release(1, 'Night Moves', '2024-05-01', SELECTED),
        release(2, 'Moon at Midnight', '2023-05-01', SELECTED),
      ],
      [MELLO]: [
        release(3, 'Sincerely, Detroit', '2019-01-01', MELLO),
        release(4, 'Clouds', '2011-01-01', MELLO),
      ],
      [ESCAPISM]: [
        release(5, 'Luxury Tax', '2026-09-25', ESCAPISM),
        release(6, 'Funeral For A Dream', '2025-01-01', ESCAPISM),
      ],
      [UNRELATED]: [
        release(7, 'Across the Globe, Vol. 1', '2022-01-01', UNRELATED),
        release(8, 'Something Else', '2021-01-01', UNRELATED),
      ],
    });
    let DISCOGRAPHIES = buildDiscographies();
    const MUSICBRAINZ_TITLES = ['Night Moves', 'Moon at Midnight', 'Sincerely, Detroit', 'Clouds', 'Luxury Tax', 'Funeral For A Dream'];

    interface Mocks {
      searchResults?: ReturnType<typeof release>[];
      artists?: { id: string; name: string }[];
      discographies?: Record<string, string[]>;
      musicBrainzDown?: boolean;
      discographyDown?: string;
      profileDown?: number;
    }

    function mockProfiles({
      searchResults = Object.values(DISCOGRAPHIES).flat(),
      artists = [{ id: 'apollo-brown', name: 'Apollo Brown' }],
      discographies = { 'apollo-brown': MUSICBRAINZ_TITLES },
      musicBrainzDown = false,
      discographyDown,
      profileDown,
    }: Mocks = {}) {
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const { hostname, pathname, searchParams } = new URL(url);

        if (hostname === 'musicbrainz.org') {
          if (musicBrainzDown) return { ok: false, status: 500, json: async () => ({}) };
          if (pathname.endsWith('/artist/')) return ok({ artists });
          if (searchParams.get('artist') === discographyDown) return { ok: false, status: 500, json: async () => ({}) };
          const titles = discographies[searchParams.get('artist') ?? ''] ?? [];
          return ok({ 'release-groups': titles.map((title) => ({ title })) });
        }

        const albumsOf = Number(pathname.match(/^\/artist\/(\d+)\/albums$/)?.[1]);
        if (albumsOf) {
          if (albumsOf === profileDown) return { ok: false, status: 500, json: async () => ({}) };
          return ok({ data: DISCOGRAPHIES[albumsOf] ?? [] });
        }
        if (pathname.startsWith('/artist/')) return ok({ id: SELECTED, name: 'Apollo Brown' });
        if (pathname === '/search/album') return ok({ data: searchResults, total: searchResults.length });
        unexpectedFetches.push(url);
        return { ok: false, status: 599, json: async () => ({}) };
      });
    }

    const musicBrainzCalls = () =>
      (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).includes('musicbrainz.org')).length;

    // The rate limiter remembers when it last sent a request, so time can't go backwards between tests
    let clock = Date.now();

    beforeEach(() => {
      DISCOGRAPHIES = buildDiscographies();
      clock += 60 * 60 * 1000;
      jest.useFakeTimers({ now: clock, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Search, running the timers behind MusicBrainz's rate limiting */
    async function searchArtist(params = `artist=Apollo%20Brown&artistId=${SELECTED}`) {
      const response = await settleWithTimers(search(params));
      const data = await response.json();
      return { status: response.status, ids: (data.results ?? []).map((r: { id: string }) => Number(r.id)) as number[] };
    }

    it('should show the albums from every profile that is the same artist, newest first', async () => {
      mockProfiles();

      const { ids } = await searchArtist();

      expect(ids).toEqual([5, 6, 1, 2, 3, 4]);
    });

    it('should leave out profiles with the same name that are not the same artist', async () => {
      mockProfiles();

      const { ids } = await searchArtist();

      expect(ids).not.toContain(7);
    });

    it('should need more than one title in common to merge a profile', async () => {
      mockProfiles({ discographies: { 'apollo-brown': [...MUSICBRAINZ_TITLES, 'Across the Globe, Vol. 1'] } });

      const { ids } = await searchArtist();

      expect(ids).not.toContain(7);
    });

    it('should only count different titles as being in common', async () => {
      DISCOGRAPHIES[UNRELATED].push(release(9, 'Across the Globe, Vol. 1', '2020-01-01', UNRELATED));
      mockProfiles({ discographies: { 'apollo-brown': [...MUSICBRAINZ_TITLES, 'Across the Globe, Vol. 1'] } });

      const { ids } = await searchArtist();

      expect(ids).not.toContain(7);
    });

    it('should ignore profiles with a different name', async () => {
      mockProfiles({ searchResults: [release(10, 'Clouds', '2011-01-01', MELLO, 'Apollo Brown Jr')] });

      const { ids } = await searchArtist();

      expect(ids).toEqual([1, 2]);
    });

    it('should not merge anything if MusicBrainz does not recognise the selected profile', async () => {
      mockProfiles({ discographies: { 'apollo-brown': ['Clouds', 'Sincerely, Detroit', 'Luxury Tax'] } });

      const { ids } = await searchArtist();

      expect(ids).toEqual([1, 2]);
    });

    it('should not mix up two artists with the same name on MusicBrainz', async () => {
      mockProfiles({
        artists: [{ id: 'namesake', name: 'Apollo Brown' }, { id: 'apollo-brown', name: 'Apollo Brown' }],
        discographies: { namesake: ['Across the Globe, Vol. 1', 'Something Else'], 'apollo-brown': MUSICBRAINZ_TITLES },
      });

      const { ids } = await searchArtist();

      expect(ids).toEqual([5, 6, 1, 2, 3, 4]);
    });

    it('should not call MusicBrainz for artists with a single profile', async () => {
      mockProfiles({ searchResults: DISCOGRAPHIES[SELECTED] });

      const { ids } = await searchArtist();

      expect(ids).toEqual([1, 2]);
      expect(musicBrainzCalls()).toBe(0);
    });

    it('should check albums by the name that Deezer has, not one from the URL', async () => {
      mockProfiles();

      await searchArtist(`artist=Nirvana&artistId=${SELECTED}`);

      const query = (global.fetch as jest.Mock).mock.calls
        .map(([url]) => new URL(url))
        .find((url) => url.pathname === '/search/album')?.searchParams.get('q');
      expect(query).toBe('artist:"Apollo Brown"');
    });

    it('should list an album found on two profiles once', async () => {
      const copy = { ...DISCOGRAPHIES[SELECTED][0] };
      DISCOGRAPHIES[MELLO].push(copy);
      mockProfiles();

      const { ids } = await searchArtist();

      expect(ids.filter((id) => id === copy.id)).toHaveLength(1);
    });

    it('should filter the merged albums by title', async () => {
      mockProfiles();

      const { ids } = await searchArtist(`artist=Apollo%20Brown&artistId=${SELECTED}&album=Clouds`);

      expect(ids).toEqual([4]);
    });

    it('should still show the selected profile if MusicBrainz is down, and try again soon', async () => {
      mockProfiles({ musicBrainzDown: true });

      const { status, ids } = await searchArtist();

      expect(status).toBe(200);
      expect(ids).toEqual([1, 2]);
      expect(mockCacheSet).toHaveBeenCalledWith(`artist-profiles:${SELECTED}`, expect.anything(), { ttl: 300 });
    });

    it('should try again soon if it could only read some of the artists with that name', async () => {
      mockProfiles({
        artists: [{ id: 'apollo-brown', name: 'Apollo Brown' }, { id: 'namesake', name: 'Apollo Brown' }],
        discographyDown: 'namesake',
      });

      const { ids } = await searchArtist();

      expect(ids).toEqual([5, 6, 1, 2, 3, 4]);
      expect(mockCacheSet).toHaveBeenCalledWith(`artist-profiles:${SELECTED}`, expect.anything(), { ttl: 300 });
    });

    it('should show the selected profile rather than wait for a slow MusicBrainz, and finish in the background', async () => {
      mockProfiles();
      const respond = (global.fetch as jest.Mock).getMockImplementation() as (url: string) => Promise<unknown>;
      let answer: () => void = () => {};
      const slow = new Promise<void>((resolve) => { answer = resolve; });
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (url.includes('musicbrainz.org')) await slow;
        return respond(url);
      });

      const started = Date.now();
      const { ids } = await searchArtist();

      expect(ids).toEqual([1, 2]);
      expect(Date.now() - started).toBeLessThan(5000);

      answer();
      await jest.advanceTimersByTimeAsync(10000);
      const { ids: nextView } = await searchArtist();

      expect(nextView).toEqual([5, 6, 1, 2, 3, 4]);
    });

    it('should still show the other albums if one profile fails', async () => {
      mockProfiles();
      await searchArtist();

      mockProfiles({ profileDown: ESCAPISM });
      const { status, ids } = await searchArtist();

      expect(status).toBe(200);
      expect(ids).toEqual([1, 2, 3, 4]);
    });

    it('should remember which profiles were confirmed', async () => {
      mockProfiles();

      await searchArtist();
      const callsAfterFirstView = musicBrainzCalls();
      const { ids } = await searchArtist();

      expect(musicBrainzCalls()).toBe(callsAfterFirstView);
      expect(ids).toEqual([5, 6, 1, 2, 3, 4]);
    });

    it('should keep Deezer\'s order for an artist with one profile', async () => {
      mockProfiles({ searchResults: DISCOGRAPHIES[SELECTED] });
      DISCOGRAPHIES[SELECTED].reverse();

      const { ids } = await searchArtist();

      expect(ids).toEqual([2, 1]);
    });
  });

  it.each([['../search/album?q=x&'], ['27?a=1'], ['1'.repeat(16)], ['abc']])('should reject the artist ID %s', async (artistId) => {
    const response = await search(`artist=Radiohead&artistId=${encodeURIComponent(artistId)}`);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should find albums whose title is only symbols', async () => {
    mockDeezerSearch(() => ({ data: [album(1, '÷ (Deluxe)', 'Ed Sheeran')] }));

    const data = await (await search(`artist=Ed%20Sheeran&album=${encodeURIComponent('÷')}`)).json();

    expect(data.results).toHaveLength(1);
  });

  it('should report Deezer errors sent with HTTP 200 instead of showing no results', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      ok({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } })
    );

    const response = await search('artist=Radiohead');

    expect(response.status).toBe(500);
  });

  it('should return 504 when Deezer times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    const response = await search('artist=Radiohead');

    expect(response.status).toBe(504);
  });
});
