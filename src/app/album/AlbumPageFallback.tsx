import Image from 'next/image';

interface AlbumPageFallbackProps {
  previewTitle?: string;
  previewArtist?: string;
  previewArtwork?: string;
}

export default function AlbumPageFallback({
  previewTitle,
  previewArtist,
  previewArtwork,
}: AlbumPageFallbackProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header - no back button in fallback since it requires client-side JS */}
        <div className="mb-8">
          {/* Back button will appear once the client component loads */}
        </div>

        {/* Show preview data if available (from search results) */}
        {previewTitle && previewArtist && (
          <div className="bg-gray-800/50 rounded-lg p-8 mb-8 flex flex-col items-center text-center">
            {previewArtwork && (
              <Image
                src={previewArtwork}
                alt={`${previewTitle} album cover`}
                width={256}
                height={256}
                className="w-64 h-64 rounded-lg shadow-2xl mb-6"
                priority
              />
            )}
            <div>
              <h1 className="text-5xl font-bold mb-3">{previewTitle}</h1>
              <p className="text-3xl text-gray-400">{previewArtist}</p>
            </div>
          </div>
        )}

        {/* Loading spinner */}
        <div className="text-center py-12" role="status" aria-live="polite">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" aria-hidden="true"></div>
          <p className="mt-4 text-gray-400">Finding where to buy...</p>
        </div>
      </div>
    </div>
  );
}
