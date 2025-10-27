import { Metadata } from 'next';
import { Suspense } from 'react';
import AlbumPageClient from './AlbumPageClient';
import AlbumPageFallback from './AlbumPageFallback';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function fetchAlbumArtwork(artist: string, album: string): Promise<string | null> {
  try {
    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://stream-to-shelf.vercel.app');

    const response = await fetch(
      `${baseUrl}/api/spotify-search?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`,
      {
        next: { revalidate: 3600 },
        cache: 'force-cache',
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].images?.[0]?.url || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching album artwork for metadata:', error);
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
  let albumArtworkUrl: string | null = null;
  try {
    albumArtworkUrl = await fetchAlbumArtwork(artist, album);
  } catch (error) {
    console.error('Failed to fetch album artwork:', error);
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
