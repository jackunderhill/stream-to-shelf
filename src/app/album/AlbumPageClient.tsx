'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SearchResult } from '@/types';
import PlatformIcon from '@/components/PlatformIcon';
import { detectRegion } from '@/lib/region';
import { useSearchPreview } from '@/contexts/SearchPreviewContext';

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

  // Get Spotify URL from preview data (used for API call)
  const spotifyUrl = hasPreviewData ? previewData.spotifyUrl : '';

  // Track if we started with preview data (this won't change when preview data is cleared)
  const [startedWithPreview] = useState(hasPreviewData);

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
        let urlToUse = spotifyUrl;
        let spotifyImageUrl: string | undefined;

        // If we don't have a Spotify URL from preview data, look it up first
        if (!urlToUse) {
          const searchResponse = await fetch(
            `/api/spotify-search?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`,
            { signal: abortController.signal }
          );

          if (!searchResponse.ok) {
            throw new Error('Failed to find album');
          }

          const searchData = await searchResponse.json();

          // Get the first result (most relevant)
          if (searchData.results && searchData.results.length > 0) {
            const firstResult = searchData.results[0];
            urlToUse = firstResult.external_urls.spotify;
            // Capture the Spotify image for fallback if songlink doesn't have artwork
            spotifyImageUrl = firstResult.images?.[0]?.url;
          } else {
            throw new Error('Album not found');
          }
        }

        // Now fetch buy links using the Spotify URL
        const response = await fetch(
          `/api/songlink?url=${encodeURIComponent(urlToUse)}&region=${region}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch buy links');
        }

        const data = await response.json();

        // If songlink didn't return artwork but we have it from Spotify, use that
        if (data.metadata && !data.metadata.artwork && spotifyImageUrl) {
          data.metadata.artwork = spotifyImageUrl;
        }

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
        setLoading(false);
      }
    };

    fetchBuyLinks();

    // Cleanup function: abort the request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [artist, album, spotifyUrl, region]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back link */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2 cursor-pointer"
            aria-label="Go back to search results"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Results
          </button>
        </div>

        {/* Show album info immediately if we have results (preview or real data) */}
        {results?.metadata && (
          <div className="bg-gray-800/50 rounded-lg p-8 mb-8 flex flex-col items-center text-center">
            {results.metadata.artwork && (
              <Image
                src={results.metadata.artwork}
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
        {!loading && !error && results && (
          <div>

            {/* No Buy Links - only show if we've actually fetched data and got no links */}
            {results.links.length === 0 && hasFetchedData && (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center">
                <p className="text-gray-400 text-lg">
                  No buy links found for this album.
                </p>
                <p className="text-gray-500 mt-2">
                  This album might not be available for purchase digitally.
                </p>
              </div>
            )}

            {/* Buy Links - Grouped by Format */}
            {results.links.length > 0 && (
              <div className="space-y-12">
                {/* Digital Downloads Section */}
                {results.links.filter(link => link.category === 'download').length > 0 && (
                  <section aria-labelledby="digital-downloads-heading">
                    <h2 id="digital-downloads-heading" className="text-2xl font-bold mb-6 text-blue-400">
                      Digital Downloads
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {results.links
                        .filter(link => link.category === 'download')
                        .map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-900/20 hover:bg-blue-900/30 rounded-lg p-6 text-center transition-all hover:scale-105 border border-blue-700 hover:border-blue-600 flex flex-col items-center cursor-pointer"
                            aria-label={`Buy digital download on ${link.displayName}`}
                          >
                            <PlatformIcon platform={link.platform} />
                            <div className="font-semibold text-white text-lg">{link.displayName}</div>
                          </a>
                        ))}
                    </div>
                  </section>
                )}

                {/* Physical Media Section */}
                {results.links.filter(link => link.category === 'physical').length > 0 && (
                  <section aria-labelledby="physical-media-heading">
                    <h2 id="physical-media-heading" className="text-2xl font-bold mb-6 text-green-400">
                      Physical Media (CDs, Vinyl, Cassettes)
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {results.links
                        .filter(link => link.category === 'physical')
                        .map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-900/20 hover:bg-green-900/30 rounded-lg p-6 text-center transition-all hover:scale-105 border border-green-700 hover:border-green-600 flex flex-col items-center cursor-pointer"
                            aria-label={`Buy physical media on ${link.displayName}`}
                          >
                            <PlatformIcon platform={link.platform} />
                            <div className="font-semibold text-white text-lg">{link.displayName}</div>
                          </a>
                        ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
