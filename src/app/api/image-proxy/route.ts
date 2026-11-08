import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

/**
 * Image Proxy Endpoint
 *
 * Serves artwork from CDN hosts that aren't listed in next.config.ts. Album art only
 * comes from these sources, so nothing else is fetched: an open proxy could be pointed
 * at internal addresses, and would host anyone's content on our domain.
 *
 * Usage: /api/image-proxy?url=https://cdn-images.dzcdn.net/image.jpg
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const REQUEST_TIMEOUT = 10000; // 10 seconds
const ALLOWED_HOST_SUFFIXES = ['.dzcdn.net', '.mzstatic.com', '.discogs.com'];
const REFERER = 'https://streamtoshelf.com';

/**
 * Validate that the image URL is on a host that serves album art. Art has no query
 * string, and each new one would be a new image for the optimiser, which is metered.
 */
function validateImageUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);
    const isAllowedHost = ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.toLowerCase().endsWith(suffix));

    if (url.protocol !== 'https:' || !isAllowedHost || url.search) {
      console.warn(`Rejected image proxy request for: ${url.protocol}//${url.hostname}`);
      return null;
    }

    return url;
  } catch {
    console.warn('Invalid image URL provided to proxy');
    return null;
  }
}

/** Read a body up to the size limit. Content-Length is optional, so it can't be relied on. */
async function readWithLimit(response: Response): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > MAX_IMAGE_SIZE) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    // Validate input
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Same for extra parameters on this request
    if (searchParams.size > 1) {
      return NextResponse.json(
        { error: 'Unexpected parameters' },
        { status: 400 }
      );
    }

    // Validate and sanitize the URL
    const validatedUrl = validateImageUrl(imageUrl);
    if (!validatedUrl) {
      return NextResponse.json(
        { error: 'Invalid or unsafe image URL' },
        { status: 400 }
      );
    }

    // Redirects aren't followed, as they could leave the allowed hosts
    let imageResponse: Response;
    try {
      imageResponse = await fetchWithTimeout(
        validatedUrl.toString(),
        { redirect: 'error', headers: { 'Accept': 'image/*', 'Referer': REFERER } },
        REQUEST_TIMEOUT
      );
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 503 }
      );
    }

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 502 }
      );
    }

    // Only raster images. SVGs can run scripts, which would run on our domain.
    const contentType = imageResponse.headers.get('content-type')?.toLowerCase();
    if (!contentType?.startsWith('image/') || contentType.includes('svg')) {
      console.warn(`Rejected non-image content from ${validatedUrl.hostname}: ${contentType}`);
      return NextResponse.json(
        { error: 'URL does not return an image' },
        { status: 400 }
      );
    }

    const body = await readWithLimit(imageResponse);
    if (!body) {
      return NextResponse.json(
        { error: 'Image file too large' },
        { status: 413 }
      );
    }

    // Return the image with appropriate headers
    const response = new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'X-Content-Type-Options': 'nosniff',
      },
    });

    return response;
  } catch (error) {
    console.error('Image proxy error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
