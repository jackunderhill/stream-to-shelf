import { generateMetadata } from '@/app/album/page';

// Mock fetch globally
global.fetch = jest.fn();

describe('Album Page Metadata Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://stream-to-shelf.vercel.app';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates default metadata when no spotifyUrl is provided', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('Album Details – StreamToShelf');
    expect(metadata.description).toBe('Find where to buy this album from legitimate music stores.');
  });

  it('generates rich metadata when album data is available', async () => {
    const mockAlbumData = {
      metadata: {
        title: 'OK Computer',
        artistName: 'Radiohead',
        artwork: 'https://example.com/ok-computer.jpg',
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    expect(metadata.title).toBe('OK Computer by Radiohead – Buy Music | StreamToShelf');
    expect(metadata.description).toBe(
      'Find where to buy OK Computer by Radiohead. Available as digital downloads, vinyl, CD, and more from legitimate music stores.'
    );
  });

  it('includes OpenGraph metadata with album artwork and generated OG image', async () => {
    const mockAlbumData = {
      metadata: {
        title: 'OK Computer',
        artistName: 'Radiohead',
        artwork: 'https://example.com/ok-computer.jpg',
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBe('OK Computer by Radiohead – Buy Music | StreamToShelf');
    expect(metadata.openGraph?.description).toContain('OK Computer by Radiohead');
    expect(metadata.openGraph?.siteName).toBe('StreamToShelf');
    expect(metadata.openGraph?.type).toBe('website');

    // Should include both artwork and OG image
    const images = metadata.openGraph?.images as Array<{
      url: string;
      width: number;
      height: number;
      alt: string;
    }>;

    expect(images).toHaveLength(2);

    // First image should be the album artwork (for WhatsApp/Signal)
    expect(images[0].url).toBe('https://example.com/ok-computer.jpg');
    expect(images[0].width).toBe(640);
    expect(images[0].height).toBe(640);
    expect(images[0].alt).toBe('OK Computer by Radiohead - Album Cover');

    // Second image should be the generated OG image
    expect(images[1].url).toContain('/api/og');
    expect(images[1].url).toContain('title=OK+Computer'); // + is standard URL encoding for spaces
    expect(images[1].url).toContain('artist=Radiohead');
    expect(images[1].width).toBe(1200);
    expect(images[1].height).toBe(630);
  });

  it('includes Twitter card metadata', async () => {
    const mockAlbumData = {
      metadata: {
        title: 'OK Computer',
        artistName: 'Radiohead',
        artwork: 'https://example.com/ok-computer.jpg',
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.card).toBe('summary_large_image');
    expect(metadata.twitter?.title).toBe('OK Computer by Radiohead – Buy Music | StreamToShelf');
    expect(metadata.twitter?.description).toContain('OK Computer by Radiohead');

    // Twitter should use the generated OG image
    const twitterImages = metadata.twitter?.images as string[];
    expect(twitterImages[0]).toContain('/api/og');
    expect(twitterImages[0]).toContain('title=OK+Computer'); // + is standard URL encoding for spaces
    expect(twitterImages[0]).toContain('artist=Radiohead');
  });

  it('handles missing album artwork gracefully', async () => {
    const mockAlbumData = {
      metadata: {
        title: 'OK Computer',
        artistName: 'Radiohead',
        // No artwork field
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    const images = metadata.openGraph?.images as Array<{
      url: string;
      width: number;
      height: number;
    }>;

    // Should only have the generated OG image, not the album artwork
    expect(images).toHaveLength(1);
    expect(images[0].url).toContain('/api/og');
  });

  it('returns default metadata when fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    expect(metadata.title).toBe('Album Details – StreamToShelf');
    expect(metadata.description).toBe('Find where to buy this album from legitimate music stores.');
  });

  it('returns default metadata when fetch throws an error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    expect(metadata.title).toBe('Album Details – StreamToShelf');
    expect(metadata.description).toBe('Find where to buy this album from legitimate music stores.');
  });

  it('returns default metadata when album data has no metadata field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ links: [] }), // No metadata field
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    expect(metadata.title).toBe('Album Details – StreamToShelf');
    expect(metadata.description).toBe('Find where to buy this album from legitimate music stores.');
  });

  it('uses correct base URL in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const mockAlbumData = {
      metadata: {
        title: 'OK Computer',
        artistName: 'Radiohead',
        artwork: 'https://example.com/ok-computer.jpg',
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    // Should have called fetch with localhost URL in development
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/api/songlink'),
      expect.any(Object)
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('uses production URL from environment variable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.com';

    const mockAlbumData = {
      metadata: {
        title: 'OK Computer',
        artistName: 'Radiohead',
        artwork: 'https://example.com/ok-computer.jpg',
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    const images = metadata.openGraph?.images as Array<{ url: string }>;
    expect(images[1].url).toContain('https://custom-domain.com/api/og');
  });

  it('properly encodes special characters in OG image URL', async () => {
    const mockAlbumData = {
      metadata: {
        title: 'OK Computer & The Tourist',
        artistName: 'Radiohead / Various Artists',
        artwork: 'https://example.com/ok-computer.jpg',
      },
      links: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumData,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        spotifyUrl: 'https://open.spotify.com/album/123',
      }),
    });

    const images = metadata.openGraph?.images as Array<{ url: string }>;

    // Should properly encode special characters (+ for spaces, %26 for &, %2F for /)
    expect(images[1].url).toContain('OK+Computer');
    expect(images[1].url).toContain('%26'); // & character
    expect(images[1].url).toContain('Radiohead');
    expect(images[1].url).toContain('%2F'); // / character
  });
});
