'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PlatformLink, SearchResult } from '@/types';
import PlatformIcon from '@/components/PlatformIcon';
import { detectRegion } from '@/lib/region';
import { useSearchPreview } from '@/contexts/SearchPreviewContext';
import { getOptimalImageUrl } from '@/lib/image-proxy';

const BACK_LINK_CLASSES = 'text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2 cursor-pointer';

function BackArrow() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function linkLabel(link: PlatformLink) {
  if (link.isSearch) return `Search for this album on ${link.displayName}`;
  // We can't see stock on artists' own sites, so don't promise that it can be bought
  if (link.platform === 'artistStore') return "View this album in the artist's store";
  if (link.platform === 'officialSite') return "Visit the artist's official site";
  return `Buy ${link.category === 'download' ? 'digital download' : 'physical media'} on ${link.displayName}`;
}

interface LinkSectionProps {
  id: string;
  title: string;
  titleClassName: string;
  cardClassName: string;
  links: PlatformLink[];
}

function LinkSection({ id, title, titleClassName, cardClassName, links }: LinkSectionProps) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={`text-2xl font-bold mb-6 ${titleClassName}`}>
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-lg p-6 text-center transition-all hover:scale-105 border flex flex-col items-center cursor-pointer ${cardClassName}`}
            aria-label={linkLabel(link)}
          >
            <PlatformIcon platform={link.platform} />
            <div className="font-semibold text-white text-lg">{link.displayName}</div>
            {link.isSearch && <div className="text-sm text-gray-400 mt-1">Search</div>}
          </a>
        ))}
      </div>
    </section>
  );
}

export default function AlbumPageClient() {
  const searchParams = useSearchParams();
  const artist = searchParams.get('artist') || '';
  const album = searchParams.get('album') || '';
  const region = detectRegion();
  const { previewData, setPreviewData } = useSearchPreview();

  // Check if preview data matches current album (by artist and album name)
  const hasPreviewData = previewData &&
    previewData.artist === artist &&
    previewData.title === album;

  // Keep the clicked album's URL (used for API call) after preview data is cleared.
  // If it changed then, the fetch below would abort and restart without it.
  const [clickedAlbum] = useState(hasPreviewData ? { artist, album, url: previewData.albumUrl } : null);
  const startedWithPreview = clickedAlbum !== null;
  const albumUrl = clickedAlbum?.artist === artist && clickedAlbum.album === album ? clickedAlbum.url : '';

  // Initialize state with preview data if available
  const [results, setResults] = useState<SearchResult | null>(() => {
    // If we have preview data for this album, create a minimal SearchResult object to show immediately
    if (hasPreviewData) {
      return {
        links: [],
        metadata: {
          title: previewData.title,
          artistName: previewData.artist,
          artwork: previewData.artwork,
        },
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artist || !album) {
      setLoading(false);
      return;
    }

    // Create AbortController to cancel request if component unmounts or dependencies change
    const abortController = new AbortController();

    const fetchBuyLinks = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          artist,
          album,
          region,
          ...(albumUrl && { url: albumUrl }),
        });

        const response = await fetch(
          `/api/buy-links?${params}`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch buy links');
        }

        const data = await response.json();
        setResults(data);
        setHasFetchedData(true);
      } catch (err) {
        // Don't show error if request was aborted (component unmounted or deps changed)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError('Failed to fetch buy links. Please try again.');
        setHasFetchedData(true);
        console.error(err);
      } finally {
        // An aborted request has been replaced, and the new one is still loading
        if (!abortController.signal.aborted) setLoading(false);
      }
    };

    fetchBuyLinks();

    // Cleanup function: abort the request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [artist, album, albumUrl, region]);

  // Clear preview data after component mounts to avoid stale data on navigation
  useEffect(() => {
    if (hasPreviewData) {
      // Clear preview data after a short delay to ensure smooth transition
      const timer = setTimeout(() => {
        setPreviewData(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasPreviewData, setPreviewData]);

  // An artist ID gets the right artist's full discography, while a name search is partial and fuzzy
  const artistId = results?.metadata?.artistId;
  const artistSearchParams = new URLSearchParams({ artist, ...(artistId && { artistId }) });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back link */}
        <div className="mb-8">
          {/* Direct visits have no results to go back to, so offer the artist's albums instead */}
          {startedWithPreview || !artist ? (
            <button
              onClick={() => window.history.back()}
              className={BACK_LINK_CLASSES}
              aria-label="Go back to search results"
            >
              <BackArrow />
              Back to Results
            </button>
          ) : (
            <Link href={`/search?${artistSearchParams}`} className={BACK_LINK_CLASSES}>
              <BackArrow />
              Search other albums by this artist
            </Link>
          )}
        </div>

        {/* Show album info immediately if we have results (preview or real data) */}
        {results?.metadata && (
          <div className="bg-gray-800/50 rounded-lg p-8 mb-8 flex flex-col items-center text-center">
            {results.metadata.artwork && (
              <Image
                src={getOptimalImageUrl(results.metadata.artwork) || results.metadata.artwork}
                alt={`${results.metadata.title} album cover`}
                width={256}
                height={256}
                className="w-64 h-64 rounded-lg shadow-2xl mb-6"
                priority
              />
            )}
            <div>
              <h1 className="text-5xl font-bold mb-3">{results.metadata.title}</h1>
              <p className="text-3xl text-gray-400">{results.metadata.artistName}</p>
            </div>
          </div>
        )}

        {/* Loading State - show spinner while fetching buy links OR when we started with preview but no real data yet */}
        {(loading || (startedWithPreview && !hasFetchedData)) && !error && (
          <div className="text-center py-12" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" aria-hidden="true"></div>
            <p className="mt-4 text-gray-400">Finding where to buy...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center" role="alert">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Buy Links - only show when finished loading */}
        {!loading && !error && results && results.links.length > 0 && (
          <div className="space-y-12">
            <LinkSection
              id="digital-downloads-heading"
              title="Digital Downloads"
              titleClassName="text-blue-400"
              cardClassName="bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 hover:border-blue-600"
              links={results.links.filter((link) => link.category === 'download')}
            />
            <LinkSection
              id="physical-media-heading"
              title="Physical Media (CDs, Vinyl, Cassettes)"
              titleClassName="text-green-400"
              cardClassName="bg-green-900/20 hover:bg-green-900/30 border-green-700 hover:border-green-600"
              links={results.links.filter((link) => link.category === 'physical')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
