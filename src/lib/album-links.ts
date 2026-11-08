import { deezerAlbumId, DeezerAlbum, fetchAlbum, findAlbum, mainArtists } from '@/lib/deezer';
import { findDiscogsUrl } from '@/lib/discogs';
import { findItunesAlbum } from '@/lib/itunes';
import { cachedLookup, Lookup } from '@/lib/lookup-cache';
import { findMusicBrainzLinks } from '@/lib/musicbrainz';
import { albumKey, isSameArtist, matchKey } from '@/lib/music-text';
import { buildStoreLinks } from '@/lib/store-links';
import { emptyStorePages, findStorePages, STORE_PAGE_TTL } from '@/lib/store-pages';
import { Region, SearchResult } from '@/types';

interface AlbumRequest {
  artist: string;
  album: string;
  region: Region;
  albumUrl?: string | null;
  /** Who's asking, which limits how many store searches they can use up */
  visitor?: string;
}

const VARIOUS_ARTISTS = 'variousartists';

/** The parts of a Deezer album that we rely on. Null when Deezer doesn't have the album. */
type DeezerMatch = Pick<DeezerAlbum, 'title' | 'upc' | 'cover_big' | 'cover_xl' | 'artist' | 'contributors'> | null;

async function lookUpDeezerAlbum(albumId: string | null, artist: string, album: string): Promise<Lookup<DeezerMatch>> {
  try {
    const details = albumId ? await fetchAlbum(albumId) : await findAlbum(artist, album);
    const value = details && {
      title: details.title,
      upc: details.upc,
      cover_big: details.cover_big,
      cover_xl: details.cover_xl,
      artist: details.artist,
      contributors: details.contributors,
    };
    return { value, complete: true };
  } catch (error) {
    console.error('Deezer album lookup error:', error);
    return { value: null, complete: false };
  }
}

/**
 * Gather an album's buy links. Deezer gives us the album's UPC, which then
 * identifies it exactly in the other catalogs. Each lookup is cached and
 * handles its own failures, so one source being down only costs its links.
 */
export async function getAlbumLinks({ artist, album, region, albumUrl, visitor }: AlbumRequest): Promise<SearchResult> {
  const albumId = albumUrl ? deezerAlbumId(albumUrl) : null;
  // The exact text, as lookups search with it: a key that ignored punctuation
  // would let "÷" and "-", or a spelling with a hidden character, share results
  const nameKey = `${artist}:${album}`.toLowerCase();

  const deezer = await cachedLookup(`deezer:${albumId ?? nameKey}`, () =>
    lookUpDeezerAlbum(albumId, artist, album)
  );

  // Results are shared with everyone under the album's UPC, so only use it if the
  // request really is that album. Otherwise a link to one album with the name of
  // another, which stale search text can produce, would store the wrong album's links.
  const creditedArtists = deezer ? mainArtists(deezer) : [];
  const requestedArtist = creditedArtists.find(({ name }) => isSameArtist(name, artist));
  const confirmed = requestedArtist && deezer && albumKey(deezer.title) === albumKey(album)
    ? { upc: deezer.upc, artist: requestedArtist.name, album: deezer.title }
    : null;

  const upc = confirmed?.upc;
  const catalogKey = upc ?? nameKey;
  const lookupArtist = confirmed?.artist ?? artist;
  const lookupAlbum = confirmed?.album ?? album;

  const [musicBrainz, itunes] = await Promise.all([
    cachedLookup(`musicbrainz:${catalogKey}`, () => findMusicBrainzLinks(upc, lookupArtist, lookupAlbum)),
    cachedLookup(`itunes:${region}:${catalogKey}`, () => findItunesAlbum(upc, lookupArtist, lookupAlbum, region)),
  ]);

  // Searches cost credits, so only spend them on real albums. Compilations are out, as
  // they share names and "Various Artists" tells two apart no better than the title does.
  // Wait for MusicBrainz too, as its gaps aren't real until it has answered, and that
  // would hide the artist's store for a week.
  const canSearchStores = confirmed
    && musicBrainz.complete
    && matchKey(confirmed.artist) !== VARIOUS_ARTISTS;

  const [discogsUrl, storePages] = await Promise.all([
    cachedLookup(`discogs:${catalogKey}`, async () => {
      const { value, complete } = await findDiscogsUrl(
        musicBrainz.barcodes, musicBrainz.discogs, lookupArtist, lookupAlbum, Boolean(confirmed)
      );
      return { value, complete: complete && musicBrainz.complete };
    }),
    canSearchStores
      ? cachedLookup(
          `store-pages:${catalogKey}`,
          () => findStorePages({
            artists: creditedArtists.map(({ name }) => name),
            album: confirmed.album,
            homepages: musicBrainz.homepages,
            bandcampAccounts: musicBrainz.bandcampAccounts,
            barcodes: musicBrainz.barcodes,
            hasBandcamp: Boolean(musicBrainz.bandcamp),
            hasQobuz: Boolean(musicBrainz.qobuz),
            visitor,
          }),
          STORE_PAGE_TTL
        )
      : emptyStorePages(),
  ]);

  return {
    links: buildStoreLinks({ region, artist: lookupArtist, album, musicBrainz, itunes, discogsUrl, storePages }),
    metadata: {
      title: album,
      artistName: artist,
      // For a collaboration this is who they asked for, not whoever Deezer lists first
      artistId: creditedArtists.length > 0 ? String((requestedArtist ?? creditedArtists[0]).id) : undefined,
      artwork: deezer?.cover_big || deezer?.cover_xl || itunes?.artwork,
    },
  };
}
