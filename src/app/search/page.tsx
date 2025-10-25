import { Metadata } from 'next';
import { Suspense } from 'react';
import SearchPageClient from './SearchPageClient';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const artist = typeof params.artist === 'string' ? params.artist : '';
  const album = typeof params.album === 'string' ? params.album : '';

  if (!artist) {
    return {
      title: 'Search Music – StreamToShelf',
      description: 'Search for any artist and discover legitimate stores selling their music.',
    };
  }

  const title = `${artist}${album ? ` - ${album}` : ''} – Search Results | StreamToShelf`;
  const description = `Browse albums by ${artist}${album ? ` matching "${album}"` : ''}. Find where to buy as digital downloads, vinyl, CD, and more.`;

  // Use environment variable for base URL, fallback to Vercel URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stream-to-shelf.vercel.app';

  // Build OG image URL using URL constructor for proper encoding
  const ogImageUrl = new URL('/api/og', baseUrl);
  ogImageUrl.searchParams.set('title', artist);
  if (album) {
    ogImageUrl.searchParams.set('artist', album);
  }

  const pageUrl = new URL('/search', baseUrl);
  pageUrl.searchParams.set('artist', artist);
  if (album) {
    pageUrl.searchParams.set('album', album);
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl.toString(),
      siteName: 'StreamToShelf',
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${artist} - StreamToShelf`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
    },
  };
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-12" role="status" aria-live="polite">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" aria-hidden="true"></div>
              <p className="mt-4 text-gray-400">Loading search...</p>
            </div>
          </div>
        </div>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
