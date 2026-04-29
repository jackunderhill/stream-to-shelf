import { NextRequest, NextResponse } from 'next/server';
import { Album, AlbumSearchResponse } from '@/types';

const DEEZER_SEARCH_URL = 'https://api.deezer.com/search/album';
const API_TIMEOUT = 10000;

async function fetchWithTimeout(url: string, timeout = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

interface DeezerAlbum {
  id: number;
  title: string;
  link: string;
  cover_xl: string;
  cover_big: string;
  release_date: string;
  record_type: string;
  nb_tracks?: number;
  artist: {
    id: number;
    name: string;
  };
}

function mapDeezerAlbum(album: DeezerAlbum): Album {
  return {
    id: String(album.id),
    name: album.title,
    artists: [{ id: String(album.artist.id), name: album.artist.name }],
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

  const sanitizedArtist = artist.trim().substring(0, 100);
  const sanitizedAlbum = album?.trim().substring(0, 100);

  try {
    const query = sanitizedAlbum
      ? `artist:"${sanitizedArtist}" album:"${sanitizedAlbum}"`
      : `artist:"${sanitizedArtist}"`;

    const url = `${DEEZER_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=20`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return NextResponse.json({ error: 'Deezer search failed' }, { status: 500 });
    }

    const data = await response.json();

    if (!data.data) {
      return NextResponse.json<AlbumSearchResponse>({ artist: sanitizedArtist, album: sanitizedAlbum, results: [] });
    }

    const filtered = (data.data as DeezerAlbum[]).filter((item) => {
      if (artistId) {
        return String(item.artist.id) === artistId;
      }
      const artistLower = sanitizedArtist.toLowerCase();
      const itemArtist = item.artist.name.toLowerCase();
      return itemArtist.includes(artistLower) || artistLower.includes(itemArtist);
    });

    const jsonResponse = NextResponse.json<AlbumSearchResponse>({
      artist: sanitizedArtist,
      album: sanitizedAlbum,
      results: filtered.map(mapDeezerAlbum),
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
