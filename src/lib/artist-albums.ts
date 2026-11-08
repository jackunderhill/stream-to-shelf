import { waitUntil } from '@vercel/functions';
import { DeezerAlbum, fetchArtistAlbums, findProfilesWithSameName } from '@/lib/deezer';
import { cachedLookup, Lookup } from '@/lib/lookup-cache';
import { albumKey } from '@/lib/music-text';
import { findDiscographies } from '@/lib/musicbrainz';

// More than one title in common, as lone titles like "Live" are shared by chance
const MIN_SHARED_TITLES = 2;

// Longer than this and it's better to show the profile we have than keep people waiting
const PROFILE_LOOKUP_WAIT = 4000;

function sharesDiscography(albums: DeezerAlbum[], discography: Set<string>): boolean {
  const titles = new Set(albums.map((album) => albumKey(album.title)));
  return [...titles].filter((title) => discography.has(title)).length >= MIN_SHARED_TITLES;
}

/**
 * Find the artist's other Deezer profiles. A name alone doesn't show that a
 * profile is the same artist, so one only counts if MusicBrainz lists its
 * releases under the same artist as the releases of the profile we started from.
 */
async function findOtherProfiles(artistId: string, albums: DeezerAlbum[]): Promise<Lookup<string[]>> {
  try {
    const { name, profileIds } = await findProfilesWithSameName(artistId);
    if (profileIds.length === 0) return { value: [], complete: true };

    const { value: discographies, complete } = await findDiscographies(name);
    const discography = discographies
      .map((titles) => new Set(titles.map(albumKey)))
      .find((titles) => sharesDiscography(albums, titles));
    if (!discography) return { value: [], complete };

    const profiles = await Promise.all(
      profileIds.map(async (id) => ({ id, albums: await fetchArtistAlbums(id, name) }))
    );
    return {
      value: profiles.filter((profile) => sharesDiscography(profile.albums, discography)).map(({ id }) => id),
      complete,
    };
  } catch (error) {
    console.error('Artist profile lookup error:', error);
    return { value: [], complete: false };
  }
}

const emptyAfter = (ms: number) => new Promise<string[]>((resolve) => setTimeout(() => resolve([]), ms));

/**
 * Get an artist's discography. Deezer can split one artist across several
 * profiles, which left Apollo Brown's 8 of about 56 releases on the profile that
 * artist search offers first. Losing the extra profiles only costs their albums.
 */
export async function getArtistAlbums(artistId: string, artistName: string): Promise<DeezerAlbum[]> {
  const albums = await fetchArtistAlbums(artistId, artistName);

  // A slow lookup carries on in the background, so that the next visitor gets the full list
  const profileLookup = cachedLookup(`artist-profiles:${artistId}`, () => findOtherProfiles(artistId, albums));
  waitUntil(profileLookup);
  const otherProfileIds = await Promise.race([profileLookup, emptyAfter(PROFILE_LOOKUP_WAIT)]);
  if (otherProfileIds.length === 0) return albums;

  const otherProfiles = await Promise.allSettled(otherProfileIds.map((id) => fetchArtistAlbums(id, artistName)));
  const merged = new Map(albums.map((album) => [album.id, album]));

  for (const profile of otherProfiles) {
    if (profile.status === 'rejected') {
      console.error('Artist profile fetch error:', profile.reason);
      continue;
    }
    for (const album of profile.value) {
      if (!merged.has(album.id)) merged.set(album.id, album);
    }
  }

  // Deezer sorts each profile by date, so keep that across all of them. Dates are ISO, so they sort as text.
  return [...merged.values()].sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
}
