import { NextRequest, NextResponse } from 'next/server';
import { SpotifyAlbum, SpotifySearchResponse } from '@/types';

const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_TIMEOUT = 10000; // 10 seconds

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

let spotifyTokenCache: { token: string; expires: number } | null = null;

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyTokenCache && spotifyTokenCache.expires > Date.now()) {
    return spotifyTokenCache.token;
  }

  try {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const response = await fetchWithTimeout(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) return null;

    const data = await response.json();
    spotifyTokenCache = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in * 1000) - 60000,
    };

    return data.access_token;
  } catch (error) {
    console.error('Spotify token error:', error);
    return null;
  }
}

// Disable caching for this API route to prevent stale data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const album = searchParams.get('album');

  // Input validation
  if (!artist || artist.trim().length === 0) {
    return NextResponse.json(
      { error: 'Artist parameter is required' },
      { status: 400 }
    );
  }

  // Sanitize and validate length
  const sanitizedArtist = artist.trim().substring(0, 100);
  const sanitizedAlbum = album?.trim().substring(0, 100);

  if (sanitizedArtist.length === 0) {
    return NextResponse.json(
      { error: 'Artist parameter cannot be empty' },
      { status: 400 }
    );
  }

  try {
    const token = await getSpotifyToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Spotify' },
        { status: 500 }
      );
    }

    const query = sanitizedAlbum
      ? `artist:${sanitizedArtist} album:${sanitizedAlbum}`
      : `artist:${sanitizedArtist}`;
    const url = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(query)}&type=album&limit=20`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Spotify search failed' },
        { status: response.status === 429 ? 429 : 500 }
      );
    }

    const data = await response.json();

    if (!data.albums || !data.albums.items) {
      return NextResponse.json<SpotifySearchResponse>({
        artist: sanitizedArtist,
        album: sanitizedAlbum || undefined,
        results: [],
      });
    }

    // Filter to get albums from the correct artist
    const artistLower = sanitizedArtist.toLowerCase();
    const filteredResults = data.albums.items.filter((item: SpotifyAlbum) => {
      const itemArtists = item.artists?.map((a) => a.name.toLowerCase()) || [];
      return itemArtists.some((a: string) =>
        a.includes(artistLower) || artistLower.includes(a)
      );
    });

    const jsonResponse = NextResponse.json<SpotifySearchResponse>({
      artist: sanitizedArtist,
      album: sanitizedAlbum || undefined,
      results: filteredResults,
    });

    // Prevent caching at the browser/CDN level
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    return jsonResponse;

  } catch (error) {
    console.error('Spotify search API error:', error);

    // Check if it's an abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
