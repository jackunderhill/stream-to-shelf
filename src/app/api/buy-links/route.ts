import { ipAddress } from '@vercel/functions';
import { NextRequest, NextResponse } from 'next/server';
import { getAlbumLinks } from '@/lib/album-links';
import { isRegion } from '@/lib/region';
import { SearchResult } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist')?.trim().substring(0, 100);
  const album = searchParams.get('album')?.trim().substring(0, 200);
  const region = searchParams.get('region') || 'US';
  const albumUrl = searchParams.get('url');

  // Validation
  if (!artist || !album) {
    return NextResponse.json(
      { error: 'Artist and album parameters are required' },
      { status: 400 }
    );
  }

  // Validate region
  if (!isRegion(region)) {
    return NextResponse.json(
      { error: 'Invalid region parameter' },
      { status: 400 }
    );
  }

  try {
    const result = await getAlbumLinks({ artist, album, region, albumUrl, visitor: ipAddress(request) });

    const response = NextResponse.json<SearchResult>(result);
    // Prevent caching at the browser/CDN level
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;

  } catch (error) {
    console.error('Buy links error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
