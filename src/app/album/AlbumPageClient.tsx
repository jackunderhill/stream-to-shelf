'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SearchResult } from '@/types';
import PlatformIcon from '@/components/PlatformIcon';
import { detectRegion } from '@/lib/region';

export default function AlbumPageClient() {
  const searchParams = useSearchParams();
  const spotifyUrl = searchParams.get('spotifyUrl') || '';
  const region = detectRegion();

  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spotifyUrl) {
      setLoading(false);
      return;
    }

    // Create AbortController to cancel request if component unmounts or dependencies change
    const abortController = new AbortController();

    const fetchBuyLinks = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use the existing search API but pass the Spotify URL directly
        const response = await fetch(
          `/api/songlink?url=${encodeURIComponent(spotifyUrl)}&region=${region}`,
          { signal: abortController.signal }
        );
        if (!response.ok) {
          throw new Error('Failed to fetch buy links');
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        // Don't show error if request was aborted (component unmounted or deps changed)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError('Failed to fetch buy links. Please try again.');
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
  }, [spotifyUrl, region]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back link */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2"
            aria-label="Go back to search results"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Results
          </button>
        </div>

        {/* Loading State */}
        {loading && (
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

        {/* Results */}
        {!loading && !error && results && (
          <div>
            {/* Album Header */}
            {results.metadata && (
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

            {/* No Buy Links */}
            {results.links.length === 0 && (
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
                            className="bg-blue-900/20 hover:bg-blue-900/30 rounded-lg p-6 text-center transition-all hover:scale-105 border border-blue-700 hover:border-blue-600 flex flex-col items-center"
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
                            className="bg-green-900/20 hover:bg-green-900/30 rounded-lg p-6 text-center transition-all hover:scale-105 border border-green-700 hover:border-green-600 flex flex-col items-center"
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
