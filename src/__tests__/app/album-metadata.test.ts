import { generateMetadata } from '@/app/album/page';

describe('Album Page Metadata Generation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SITE_URL = 'https://stream-to-shelf.vercel.app';
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

    // Should include both actual album artwork and generated OG image
    const images = metadata.openGraph?.images as Array<{
      url: string;
      width?: number;
      height?: number;
      alt: string;
    }>;

    expect(images.length).toBeGreaterThanOrEqual(1);

    // First image should be the actual album artwork from Spotify
    expect(images[0].url).toContain('scdn.co');
    expect(images[0].width).toBe(640);
    expect(images[0].height).toBe(640);

    // Second image should be the generated OG image (if available)
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

    // Twitter should use actual album artwork if available
    const twitterImages = metadata.twitter?.images as string[];
    expect(twitterImages).toBeDefined();
    expect(twitterImages.length).toBeGreaterThan(0);
    // Should be either Spotify image or the OG API
    expect(
      twitterImages[0].includes('scdn.co') ||
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
    // Should NOT have OpenGraph metadata when album is missing
    expect(metadata.openGraph).toBeUndefined();
  });

  it('uses custom base URL from environment variable', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.com';

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead',
        album: 'OK Computer',
      }),
    });

    const images = metadata.openGraph?.images as Array<{ url: string }>;
    expect(images[0].url).toContain('https://custom-domain.com/api/og');
  });

  it('properly encodes special characters in OG image URL', async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({
        artist: 'Radiohead / The Smile',
        album: 'OK Computer & Kid A',
      }),
    });

    // Should properly encode special characters
    const images = metadata.openGraph?.images as Array<{ url: string }>;
    expect(images[0].url).toContain('/api/og');
    expect(images[0].url).toContain('OK%20Computer');
    expect(images[0].url).toContain('%26'); // & character
    expect(images[0].url).toContain('Radiohead');
  });
});
