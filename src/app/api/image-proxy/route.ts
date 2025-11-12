import { NextRequest, NextResponse } from 'next/server';

/**
 * Image Proxy Endpoint
 *
 * This endpoint proxies external images, allowing us to serve images from any domain
 * without needing to whitelist them in next.config.ts. This is useful for:
 * - Handling images from many different music platforms via Songlink
 * - Caching images for better performance
 * - Resizing/optimizing images on-the-fly
 *
 * Usage: /api/image-proxy?url=https://example.com/image.jpg
 */

// Disable caching for this API route to ensure we always fetch fresh images
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const REQUEST_TIMEOUT = 10000; // 10 seconds
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validate that the image URL is safe to proxy
 */
function validateImageUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      console.warn(`Rejected image proxy request with protocol: ${url.protocol}`);
      return null;
    }

    // Prevent SSRF attacks - reject localhost and private IPs
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname === '0.0.0.0'
    ) {
      console.warn(`Rejected image proxy request to private IP: ${hostname}`);
      return null;
    }

    return url;
  } catch {
    console.warn(`Invalid image URL provided to proxy: ${urlString}`);
    return null;
  }
}

/**
 * Fetch image with timeout
 */
async function fetchImageWithTimeout(
  url: URL,
  timeout = REQUEST_TIMEOUT
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; StreamToShelf/1.0; +https://stream-to-shelf.vercel.app)',
        'Accept': 'image/*',
        // Don't follow redirects that might be infinite
        'Referer': 'https://stream-to-shelf.vercel.app',
      },
    });

    clearTimeout(timeoutId);
    return response;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
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

    // Validate and sanitize the URL
    const validatedUrl = validateImageUrl(imageUrl);
    if (!validatedUrl) {
      return NextResponse.json(
        { error: 'Invalid or unsafe image URL' },
        { status: 400 }
      );
    }

    // Fetch the image
    const imageResponse = await fetchImageWithTimeout(validatedUrl);

    if (!imageResponse) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 503 }
      );
    }

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Image server returned ${imageResponse.status}` },
        { status: imageResponse.status }
      );
    }

    // Check content type is actually an image
    const contentType = imageResponse.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(
        `Rejected non-image content from ${validatedUrl.hostname}: ${contentType}`
      );
      return NextResponse.json(
        { error: 'URL does not return an image' },
        { status: 400 }
      );
    }

    // Check file size
    const contentLength = imageResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image file too large' },
        { status: 413 }
      );
    }

    // Stream the image data
    const buffer = await imageResponse.arrayBuffer();

    // Double-check size after fetching
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image file too large' },
        { status: 413 }
      );
    }

    // Return the image with appropriate headers
    const response = new NextResponse(buffer, {
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
