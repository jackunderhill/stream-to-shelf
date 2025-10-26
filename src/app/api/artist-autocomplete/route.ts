import { NextRequest, NextResponse } from 'next/server';

const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_TIMEOUT = 5000; // 5 seconds for autocomplete

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

interface SpotifyArtist {
  id: string;
  name: string;
  images?: Array<{ url: string; width: number; height: number }>;
}

let spotifyTokenCache: { token: string; expires: number } | null = null;

// Export for testing purposes
export function resetTokenCache() {
  spotifyTokenCache = null;
}

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

// Disable caching for this API route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  // Input validation
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ artists: [] });
  }

  // Sanitize and validate length
  const sanitizedQuery = query.trim().substring(0, 100);

  try {
    const token = await getSpotifyToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Spotify' },
        { status: 500 }
      );
    }

    // Search for artists
    const url = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(sanitizedQuery)}&type=artist&limit=8`;

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

    if (!data.artists || !data.artists.items) {
      return NextResponse.json({ artists: [] });
    }

    // Map to our simpler format
    const artists = data.artists.items.map((artist: SpotifyArtist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.images && artist.images.length > 0
        ? artist.images[artist.images.length - 1].url // Get smallest image
        : undefined,
    }));

    const jsonResponse = NextResponse.json({ artists });

    // Prevent caching
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    return jsonResponse;

  } catch (error) {
    console.error('Artist autocomplete API error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ artists: [] }); // Return empty on timeout
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
