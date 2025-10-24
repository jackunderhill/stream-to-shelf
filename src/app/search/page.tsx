'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import SearchBar from '@/components/SearchBar';
import Link from 'next/link';
import Image from 'next/image';
import { SpotifySearchResponse } from '@/types';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const artist = searchParams.get('artist') || '';
  const album = searchParams.get('album') || '';
  const region = searchParams.get('region') || 'GB';

  const [results, setResults] = useState<SpotifySearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artist) {
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          artist,
          ...(album && { album }),
        });

        const response = await fetch(`/api/spotify-search?${params}`);
        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError('Failed to fetch results. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [artist, album]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with back link */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2"
            aria-label="Back to home page"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Search Bar */}
        <div className="mb-12">
          <SearchBar />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" aria-hidden="true"></div>
            <p className="mt-4 text-gray-400">Searching for albums...</p>
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
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">
                Results for &quot;{artist}&quot;{album && <> - &quot;{album}&quot;</>}
              </h1>
              <p className="text-gray-400" aria-live="polite">
                {results.results.length > 0
                  ? `Found ${results.results.length} album${results.results.length !== 1 ? 's' : ''}`
                  : 'No albums found'
                }
              </p>
            </div>

            {/* No Results */}
            {results.results.length === 0 && (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center">
                <p className="text-gray-400 text-lg">
                  No albums found for &quot;{artist}&quot;{album && <> - &quot;{album}&quot;</>}
                </p>
                <p className="text-gray-500 mt-2">
                  Try searching with just the artist name, or check the spelling.
                </p>
              </div>
            )}

            {/* Album Grid */}
            {results.results.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {results.results.map((albumItem) => (
                  <Link
                    key={albumItem.id}
                    href={`/album?spotifyUrl=${encodeURIComponent(albumItem.external_urls.spotify)}&region=${region}`}
                    className="group"
                    aria-label={`View buy links for ${albumItem.name} by ${albumItem.artists.map(a => a.name).join(', ')}`}
                  >
                    <article className="bg-gray-800/50 rounded-lg overflow-hidden transition-all hover:scale-105 hover:bg-gray-800 border border-gray-700 hover:border-gray-600">
                      {/* Album Art */}
                      {albumItem.images[0] && (
                        <Image
                          src={albumItem.images[0].url}
                          alt={`${albumItem.name} album cover`}
                          width={albumItem.images[0].width}
                          height={albumItem.images[0].height}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      )}

                      {/* Album Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">
                          {albumItem.name}
                        </h3>
                        <p className="text-sm text-gray-400 mb-2">
                          {albumItem.artists.map(a => a.name).join(', ')}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="capitalize">{albumItem.album_type}</span>
                          <span>{new Date(albumItem.release_date).getFullYear()}</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" aria-hidden="true"></div>
            <p className="mt-4 text-gray-400">Loading search...</p>
          </div>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
