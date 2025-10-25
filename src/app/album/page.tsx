import { Metadata } from 'next';
import { Suspense } from 'react';
import AlbumPageClient from './AlbumPageClient';
import AlbumPageFallback from './AlbumPageFallback';
import { SearchResult } from '@/types';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function fetchAlbumData(spotifyUrl: string): Promise<SearchResult | null> {
  try {
    // In development, use localhost; in production use Vercel URL
    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://stream-to-shelf.vercel.app');

    const response = await fetch(
      `${baseUrl}/api/songlink?url=${encodeURIComponent(spotifyUrl)}&region=US`,
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
        cache: 'force-cache',
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching album data for metadata:', error);
    return null;
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const spotifyUrl = typeof params.spotifyUrl === 'string' ? params.spotifyUrl : '';

  if (!spotifyUrl) {
    return {
      title: 'Album Details – StreamToShelf',
      description: 'Find where to buy this album from legitimate music stores.',
    };
  }

  // Fetch album data for rich metadata
  const albumData = await fetchAlbumData(spotifyUrl);

  if (!albumData?.metadata) {
    return {
      title: 'Album Details – StreamToShelf',
      description: 'Find where to buy this album from legitimate music stores.',
    };
  }

  const { title, artistName, artwork } = albumData.metadata;
  const pageTitle = `${title} by ${artistName} – Buy Music | StreamToShelf`;
  const description = `Find where to buy ${title} by ${artistName}. Available as digital downloads, vinyl, CD, and more from legitimate music stores.`;

  // Use environment variable for base URL, fallback to Vercel URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stream-to-shelf.vercel.app';

  // Build OG image URL using URL constructor for proper encoding
  const ogImageUrl = new URL('/api/og', baseUrl);
  ogImageUrl.searchParams.set('title', title);
  ogImageUrl.searchParams.set('artist', artistName);

  const pageUrl = new URL('/album', baseUrl);
  pageUrl.searchParams.set('spotifyUrl', spotifyUrl);

  // Build images array - use artwork directly first (for WhatsApp/Signal), then generated OG image
  const images = [];
  if (artwork) {
    images.push({
      url: artwork,
      width: 640,
      height: 640,
      alt: `${title} by ${artistName} - Album Cover`,
    });
  }
  images.push({
    url: ogImageUrl.toString(),
    width: 1200,
    height: 630,
    alt: `${title} by ${artistName}`,
  });

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: pageUrl.toString(),
      siteName: 'StreamToShelf',
      images,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImageUrl.toString()],
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
