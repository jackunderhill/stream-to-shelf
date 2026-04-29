import { NextRequest, NextResponse } from 'next/server';

const DEEZER_ARTIST_SEARCH_URL = 'https://api.deezer.com/search/artist';
const API_TIMEOUT = 5000;

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
}

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ artists: [] });
  }

  const sanitizedQuery = query.trim().substring(0, 100);

  try {
    const url = `${DEEZER_ARTIST_SEARCH_URL}?q=${encodeURIComponent(sanitizedQuery)}&limit=8`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return NextResponse.json({ error: 'Artist search failed' }, { status: 500 });
    }

    const data = await response.json();

    if (!data.data) {
      return NextResponse.json({ artists: [] });
    }

    const artists = (data.data as DeezerArtist[]).map((artist) => ({
      id: String(artist.id),
      name: artist.name,
      imageUrl: artist.picture_medium || undefined,
    }));

    const jsonResponse = NextResponse.json({ artists });
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    return jsonResponse;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ artists: [] });
    }
    console.error('Artist autocomplete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
