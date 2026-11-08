import { NextRequest, NextResponse } from 'next/server';
import { deezerGet } from '@/lib/deezer';

const API_TIMEOUT = 5000;

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
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
    const { data = [] } = await deezerGet<{ data?: DeezerArtist[] }>(
      `/search/artist?q=${encodeURIComponent(sanitizedQuery)}&limit=8`,
      API_TIMEOUT
    );

    const artists = data.map((artist) => ({
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
    return NextResponse.json({ error: 'Artist search failed' }, { status: 500 });
  }
}
