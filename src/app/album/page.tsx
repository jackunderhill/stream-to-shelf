import { Metadata } from 'next';
import { Suspense } from 'react';
import AlbumPageClient from './AlbumPageClient';
import AlbumPageFallback from './AlbumPageFallback';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function fetchAlbumArtwork(artist: string, album: string): Promise<string | null> {
  try {
    // Only try to fetch artwork if we have a working base URL
    // During build time, we skip this as there's no server running
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stream-to-shelf.vercel.app';

    // Don't attempt internal fetches during build time
    // The API will only be available at runtime
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
      return null;
    }

    // Set a reasonable timeout for the fetch (5 seconds)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${baseUrl}/api/spotify-search?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`,
        {
          signal: controller.signal,
          next: { revalidate: 3600 },
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].images?.[0]?.url || null;
      }
      return null;
    } catch {
      clearTimeout(timeout);
      // Silently return null on timeout or other errors
      // The OG image endpoint will be used as fallback
      return null;
    }
  } catch {
    // Outer catch shouldn't normally trigger, but just in case
    return null;
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const artist = typeof params.artist === 'string' ? params.artist : '';
  const album = typeof params.album === 'string' ? params.album : '';

  const pageTitle = artist && album ? `${album} by ${artist} – StreamToShelf` : 'Album Details – StreamToShelf';
  const pageDescription = artist && album ? `Find where to buy ${album} by ${artist} from legitimate music stores.` : 'Find where to buy this album from legitimate music stores.';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stream-to-shelf.vercel.app';

  // Build URLs using string concatenation to avoid URL constructor issues in metadata generation
  const pageUrl = artist && album
    ? `${baseUrl}/album?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`
    : `${baseUrl}/album`;

  if (!artist || !album) {
    return {
      title: pageTitle,
      description: pageDescription,
    };
  }

  // Try to fetch actual album artwork from Spotify
  // If this fails or times out, we fall back to the generated OG image
  let albumArtworkUrl: string | null = null;
  try {
    albumArtworkUrl = await fetchAlbumArtwork(artist, album);
  } catch {
    // Silently fail - fallback to generated image is used
  }

  // Use actual album artwork if available, otherwise fall back to generated image
  const ogImages = [];
  if (albumArtworkUrl) {
    ogImages.push({
      url: albumArtworkUrl,
      width: 640,
      height: 640,
      alt: `${album} by ${artist}`,
    });
  }

  // Always include generated image as well for better compatibility
  const ogImageUrl = `${baseUrl}/api/og?title=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`;
  ogImages.push({
    url: ogImageUrl,
    width: 1200,
    height: 630,
    alt: `${album} by ${artist}`,
  });

  // Return metadata with artist/album info
  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      siteName: 'StreamToShelf',
      images: ogImages,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [albumArtworkUrl || ogImageUrl],
    },
  };
}

export default async function AlbumPage({ searchParams }: Props) {
  const params = await searchParams;
  const previewTitle = typeof params.previewTitle === 'string' ? params.previewTitle : undefined;
  const previewArtist = typeof params.previewArtist === 'string' ? params.previewArtist : undefined;
  const previewArtwork = typeof params.previewArtwork === 'string' ? params.previewArtwork : undefined;

  return (
    <Suspense
      fallback={
        <AlbumPageFallback
          previewTitle={previewTitle}
          previewArtist={previewArtist}
          previewArtwork={previewArtwork}
        />
      }
    >
      <AlbumPageClient />
    </Suspense>
  );
}
