import { NextRequest, NextResponse } from 'next/server';
import { getArtistAlbums } from '@/lib/artist-albums';
import { DeezerAlbum, filterByTitle, findArtistByName, searchAlbums } from '@/lib/deezer';
import { Album, AlbumSearchResponse } from '@/types';

/**
 * Search for an artist by name alone. Album search is limited, and filling it
 * with similar names left Bonobo with 4 of 40 results and Lady_Bonobo_ with 26,
 * so use the artist's discography if the name is exact, and otherwise search.
 */
async function searchByArtistName(artist: string): Promise<DeezerAlbum[]> {
  const match = await findArtistByName(artist);
  const albums = match ? await getArtistAlbums(String(match.id), match.name) : [];
  return albums.length > 0 ? albums : searchAlbums(artist);
}

function mapDeezerAlbum(album: DeezerAlbum, fallbackArtistName: string): Album {
  return {
    id: String(album.id),
    name: album.title,
    artists: [{ id: String(album.artist?.id ?? ''), name: album.artist?.name ?? fallbackArtistName }],
    images: [{ url: album.cover_big || album.cover_xl, width: 500, height: 500 }],
    release_date: album.release_date,
    album_type: album.record_type,
    total_tracks: album.nb_tracks ?? 0,
    url: album.link,
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const album = searchParams.get('album');
  const artistId = searchParams.get('artistId');

  if (!artist || artist.trim().length === 0) {
    return NextResponse.json({ error: 'Artist parameter is required' }, { status: 400 });
  }

  // It goes into a Deezer API path, and each new value is a new cache entry
  if (artistId && !/^\d{1,15}$/.test(artistId)) {
    return NextResponse.json({ error: 'Invalid artist ID' }, { status: 400 });
  }

  const sanitizedArtist = artist.trim().substring(0, 100);
  const sanitizedAlbum = album?.trim().substring(0, 100);

  try {
    let albums: DeezerAlbum[];

    if (artistId) {
      // Use the artist discography endpoint for complete results
      albums = await getArtistAlbums(artistId, sanitizedArtist);
      if (sanitizedAlbum) {
        albums = filterByTitle(albums, sanitizedAlbum);
      }
    } else if (sanitizedAlbum) {
      albums = await searchAlbums(sanitizedArtist, sanitizedAlbum);
    } else {
      albums = await searchByArtistName(sanitizedArtist);
    }

    const jsonResponse = NextResponse.json<AlbumSearchResponse>({
      artist: sanitizedArtist,
      album: sanitizedAlbum,
      results: albums.map((a) => mapDeezerAlbum(a, sanitizedArtist)),
    });
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    return jsonResponse;

  } catch (error) {
    console.error('Deezer search error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
