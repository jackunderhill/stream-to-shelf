import { NextRequest, NextResponse } from 'next/server';
import { Album, AlbumSearchResponse } from '@/types';

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
  release_date?: string;
  record_type: string;
  nb_tracks?: number;
  artist?: {
    id: number;
    name: string;
  };
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

// Fetch full discography by artist ID — includes singles, EPs, live albums, and release dates
async function fetchByArtistId(artistId: string, artistName: string): Promise<DeezerAlbum[]> {
  const url = `https://api.deezer.com/artist/${artistId}/albums?limit=100`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Deezer artist albums failed: ${response.status}`);
  const data = await response.json();
  return (data.data ?? []).map((album: DeezerAlbum) => ({
    ...album,
    artist: { id: Number(artistId), name: artistName },
  }));
}

// Text search fallback when no artist ID is available
async function fetchBySearch(query: string): Promise<DeezerAlbum[]> {
  const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=50`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Deezer search failed: ${response.status}`);
  const data = await response.json();
  return data.data ?? [];
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
    let albums: DeezerAlbum[];

    if (artistId) {
      // Use the artist discography endpoint for complete results
      albums = await fetchByArtistId(artistId, sanitizedArtist);
    } else {
      // Fall back to text search
      const query = sanitizedAlbum
        ? `artist:"${sanitizedArtist}" album:"${sanitizedAlbum}"`
        : `artist:"${sanitizedArtist}"`;
      albums = await fetchBySearch(query);

      // Filter to correct artist by name
      const artistLower = sanitizedArtist.toLowerCase();
      albums = albums.filter((item) => {
        const itemArtist = item.artist?.name.toLowerCase() ?? '';
        return itemArtist.includes(artistLower) || artistLower.includes(itemArtist);
      });
    }

    // If an album name was specified, filter to matching titles
    if (sanitizedAlbum) {
      const albumLower = sanitizedAlbum.toLowerCase();
      albums = albums.filter((item) => item.title.toLowerCase().includes(albumLower));
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
