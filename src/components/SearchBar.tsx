'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  initialArtist?: string;
  initialAlbum?: string;
}

export default function SearchBar({ initialArtist = '', initialAlbum = '' }: SearchBarProps) {
  const [artist, setArtist] = useState(initialArtist);
  const [album, setAlbum] = useState(initialAlbum);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist.trim()) return;

    const params = new URLSearchParams();
    params.set('artist', artist.trim());
    if (album.trim()) params.set('album', album.trim());

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="artist" className="block text-sm font-medium text-gray-300 mb-2">
              Artist *
            </label>
            <input
              id="artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Enter artist name..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              required
              maxLength={100}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="album" className="block text-sm font-medium text-gray-300 mb-2">
              Album (optional)
            </label>
            <input
              id="album"
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="Enter album name..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              maxLength={100}
            />
          </div>
        </div>

        <div className="text-center">
          <button
            type="submit"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mx-auto"
            disabled={!artist.trim() || isPending}
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </>
            ) : (
              'Find Music Stores'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
