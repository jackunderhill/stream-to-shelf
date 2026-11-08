import { generateMetadata } from '@/app/album/page';

const DEEZER_IMAGE = 'https://e-cdns-images.dzcdn.net/images/cover/okcomputer.jpg';

const mockDeezerResponse = {
  results: [
    {
      id: '1',
      name: 'OK Computer',
      url: 'https://www.deezer.com/album/123',
      images: [{ url: DEEZER_IMAGE, width: 500, height: 500 }],
      artists: [{ id: '1', name: 'Radiohead' }],
      release_date: '1997-05-21',
      album_type: 'album',
      total_tracks: 12,
    },
  ],
};

describe('Album Page Metadata Generation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SITE_URL = 'https://stream-to-shelf.vercel.app';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDeezerResponse,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates default metadata when no parameters are provided', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('Album Details – StreamToShelf');
    expect(metadata.description).toBe('Find where to buy this album from legitimate music stores.');
  });

  it('generates rich metadata when artist and album are provided', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead',
        album: 'OK Computer',
      }),
    });

    expect(metadata.title).toBe('OK Computer by Radiohead – StreamToShelf');
    expect(metadata.description).toBe(
      'Find where to buy OK Computer by Radiohead from legitimate music stores.'
    );
  });

  it('includes OpenGraph metadata with album artwork and generated OG image', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead',
        album: 'OK Computer',
      }),
    });

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBe('OK Computer by Radiohead – StreamToShelf');
    expect(metadata.openGraph?.description).toContain('OK Computer by Radiohead');
    expect(metadata.openGraph?.siteName).toBe('StreamToShelf');

    const images = metadata.openGraph?.images as Array<{
      url: string;
      width?: number;
      height?: number;
      alt: string;
    }>;

    expect(images.length).toBeGreaterThanOrEqual(1);

    // First image should be the actual album artwork from Deezer
    expect(images[0].url).toContain('dzcdn.net');
    expect(images[0].width).toBe(500);
    expect(images[0].height).toBe(500);

    // Second image should be the generated OG image
    if (images.length > 1) {
      expect(images[1].url).toContain('/api/og');
      expect(images[1].width).toBe(1200);
      expect(images[1].height).toBe(630);
    }
  });

  it('includes Twitter card metadata', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead',
        album: 'OK Computer',
      }),
    });

    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter?.title).toBe('OK Computer by Radiohead – StreamToShelf');
    expect(metadata.twitter?.description).toContain('OK Computer by Radiohead');

    const twitterImages = metadata.twitter?.images as string[];
    expect(twitterImages).toBeDefined();
    expect(twitterImages.length).toBeGreaterThan(0);
    expect(
      twitterImages[0].includes('dzcdn.net') ||
      twitterImages[0].includes('/api/og')
    ).toBe(true);
  });

  it('returns basic metadata when only artist is provided', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead',
      }),
    });

    expect(metadata.title).toBe('Album Details – StreamToShelf');
    expect(metadata.description).toBe('Find where to buy this album from legitimate music stores.');
    expect(metadata.openGraph).toBeUndefined();
  });

  it('uses custom base URL from environment variable', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.com';
    jest.resetModules();
    const { generateMetadata: generateCustomMetadata } = await import('@/app/album/page');

    const metadata = await generateCustomMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead',
        album: 'OK Computer',
      }),
    });

    const images = metadata.openGraph?.images as Array<{ url: string }>;
    const ogImage = images.find(img => img.url.includes('/api/og'));
    expect(ogImage?.url).toContain('https://custom-domain.com/api/og');
  });

  it('properly encodes special characters in OG image URL', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead / The Smile',
        album: 'OK Computer & Kid A',
      }),
    });

    const images = metadata.openGraph?.images as Array<{ url: string }>;
    const ogImage = images.find(img => img.url.includes('/api/og'));
    expect(ogImage?.url).toContain('/api/og');
    expect(ogImage?.url).toContain('OK%20Computer');
    expect(ogImage?.url).toContain('%26');
    expect(ogImage?.url).toContain('Radiohead');
  });
});
