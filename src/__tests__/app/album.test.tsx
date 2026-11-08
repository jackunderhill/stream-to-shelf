import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSearchParams } from 'next/navigation';
import AlbumPageClient from '@/app/album/AlbumPageClient';
import { SearchPreviewProvider } from '@/contexts/SearchPreviewContext';
import React from 'react';

interface AlbumPreview {
  title: string;
  artist: string;
  artwork?: string;
  albumUrl: string;
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock region detection
jest.mock('@/lib/region', () => ({
  detectRegion: jest.fn(() => 'US'),
}));

// Test wrapper with context provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <SearchPreviewProvider>{children}</SearchPreviewProvider>;
}

// Custom wrapper that provides preview data
function createWrapperWithPreview(previewData: AlbumPreview) {
  return function WrapperWithPreview({ children }: { children: React.ReactNode }) {
    const [preview] = React.useState(previewData);
    return (
      <SearchPreviewProvider initialData={preview}>
        {children}
      </SearchPreviewProvider>
    );
  };
}

describe('AlbumPageClient', () => {
  const mockSearchParams = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();
  });

  it('fetches and displays album buy links', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    // Mock the buy links API response
    const mockBuyLinksResponse = {
      links: [
        {
          platform: 'itunes',
          displayName: 'iTunes',
          url: 'https://itunes.apple.com/album/123',
          category: 'download',
        },
        {
          platform: 'amazonPhysical',
          displayName: 'Amazon',
          url: 'https://amazon.com/album',
          category: 'physical',
        },
      ],
      metadata: {
        title: 'Test Album',
        artistName: 'Test Artist',
        artwork: 'https://example.com/art.jpg',
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuyLinksResponse,
    });

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('iTunes')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
  });

  it('displays error message when fetch fails', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch buy links. Please try again.')).toBeInTheDocument();
    });
  });

  it('aborts fetch request when component unmounts', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    const abortMock = jest.fn();
    const mockAbortController = {
      signal: { aborted: false },
      abort: abortMock,
    };

    // Mock AbortController
    jest.spyOn(global, 'AbortController').mockImplementation((() => mockAbortController) as never);

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { unmount } = render(<AlbumPageClient />, { wrapper: TestWrapper });

    // Verify fetch was called with abort signal
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/buy-links'),
      expect.objectContaining({
        signal: mockAbortController.signal,
      })
    );

    // Unmount component
    unmount();

    // Verify abort was called
    expect(abortMock).toHaveBeenCalled();
  });

  it('aborts previous request when artist or album changes', async () => {
    const abortMocks: jest.Mock[] = [];
    let controllerCount = 0;

    // Mock AbortController to track each instance
    jest.spyOn(global, 'AbortController').mockImplementation((() => {
      const abortMock = jest.fn();
      abortMocks.push(abortMock);
      controllerCount++;
      return {
        signal: { aborted: false },
        abort: abortMock,
      };
    }) as never);

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    // Initial render
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    const { rerender } = render(<AlbumPageClient />, { wrapper: TestWrapper });

    expect(controllerCount).toBe(1);
    expect(abortMocks[0]).not.toHaveBeenCalled();

    // Change album
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'Kid A';
      return null;
    });

    rerender(<AlbumPageClient />);

    // First controller should be aborted, second created
    expect(abortMocks[0]).toHaveBeenCalled();
    expect(controllerCount).toBe(2);
  });

  it('does not show error when request is aborted (AbortError)', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    // Let the rejection be handled, as the message can't have appeared before that
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('Failed to fetch buy links. Please try again.')).not.toBeInTheDocument();
  });

  it('requests buy links by name when opened from a shared link', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Mae Muller';
      if (key === 'album') return 'Sorry I’m Late';
      return null;
    });

    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = new URL((global.fetch as jest.Mock).mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/api/buy-links');
    expect(url.searchParams.get('artist')).toBe('Mae Muller');
    expect(url.searchParams.get('album')).toBe('Sorry I’m Late');
    expect(url.searchParams.get('region')).toBe('US');
    expect(url.searchParams.has('url')).toBe(false);
  });

  it('labels links that go to a store search rather than the album', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        links: [
          { platform: 'bandcamp', displayName: 'Bandcamp', url: 'https://bandcamp.com/search?q=x', category: 'download', isSearch: true },
          { platform: 'itunes', displayName: 'iTunes', url: 'https://music.apple.com/album/1', category: 'download' },
          { platform: 'banquet', displayName: 'Banquet Records', url: 'https://banquet.com/search?q=x', category: 'physical', isSearch: true },
        ],
        metadata: { title: 'OK Computer', artistName: 'Radiohead' },
      }),
    });

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    expect(await screen.findByRole('link', { name: 'Search for this album on Bandcamp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search for this album on Banquet Records' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buy digital download on iTunes' })).toBeInTheDocument();
    expect(screen.getAllByText('Search')).toHaveLength(2);
  });

  it("does not promise that an artist's store has the album in stock", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Mae Muller';
      if (key === 'album') return 'Sorry I’m Late';
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        links: [
          { platform: 'artistStore', displayName: "Artist's store", url: 'https://shop.maemuller.com/products/cd', category: 'physical' },
          { platform: 'officialSite', displayName: 'Official site', url: 'https://www.maemuller.com/', category: 'physical' },
        ],
        metadata: { title: 'Sorry I’m Late', artistName: 'Mae Muller' },
      }),
    });

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    expect(await screen.findByRole('link', { name: "View this album in the artist's store" })).toHaveAttribute(
      'href',
      'https://shop.maemuller.com/products/cd'
    );
    expect(screen.getByRole('link', { name: "Visit the artist's official site" })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Buy/ })).not.toBeInTheDocument();
  });

  describe('Back link', () => {
    const OTHER_ALBUMS = 'Search other albums by this artist';

    const mockDirectVisit = () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Mae Muller';
        if (key === 'album') return 'Sorry I’m Late';
        return null;
      });
    };

    it('links a direct visit to a search for the artist', () => {
      mockDirectVisit();
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(<AlbumPageClient />, { wrapper: TestWrapper });

      expect(screen.getByRole('link', { name: OTHER_ALBUMS })).toHaveAttribute('href', '/search?artist=Mae+Muller');
      expect(screen.queryByText('Back to Results')).not.toBeInTheDocument();
    });

    it('links to the full discography once the artist is known', async () => {
      mockDirectVisit();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          links: [],
          metadata: { title: 'Sorry I’m Late', artistName: 'Mae Muller', artistId: '13432195' },
        }),
      });

      render(<AlbumPageClient />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByRole('link', { name: OTHER_ALBUMS })).toHaveAttribute(
          'href',
          '/search?artist=Mae+Muller&artistId=13432195'
        );
      });
    });

    it('keeps the artist link if the buy links fail to load', async () => {
      mockDirectVisit();
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

      render(<AlbumPageClient />, { wrapper: TestWrapper });

      await screen.findByText('Failed to fetch buy links. Please try again.');
      expect(screen.getByRole('link', { name: OTHER_ALBUMS })).toHaveAttribute('href', '/search?artist=Mae+Muller');
    });

    it('goes back to the results when arriving from a search', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        albumUrl: 'https://www.deezer.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      expect(screen.getByRole('button', { name: 'Go back to search results' })).toHaveTextContent('Back to Results');
      expect(screen.queryByText(OTHER_ALBUMS)).not.toBeInTheDocument();
    });
  });

  it('does not fetch when artist or album is missing', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null; // Missing album
      return null;
    });

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe('Preview Data Functionality', () => {
    it('keeps the clicked album without refetching when preview data is cleared', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        albumUrl: 'https://www.deezer.com/album/123',
      });

      jest.useFakeTimers();
      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Preview data is cleared 100ms after mount
      await act(async () => {
        jest.advanceTimersByTime(150);
      });
      jest.useRealTimers();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as jest.Mock).mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('url')).toBe('https://www.deezer.com/album/123');
    });

    it('displays preview data immediately when provided', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        artwork: 'https://example.com/preview.jpg',
        albumUrl: 'https://www.deezer.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Preview data should be visible immediately, even while loading
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Preview Artist')).toBeInTheDocument();

      // example.com isn't one of the art hosts, so it goes through the proxy
      const imageElement = screen.getByAltText('Preview Album album cover');
      expect(imageElement.getAttribute('src')).toContain('/api/image-proxy');
    });

    it('shows loading spinner when preview data is shown but not yet fetched', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        albumUrl: 'https://www.deezer.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Should show preview data AND loading spinner
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();
    });

    it('does not show "no buy links" message for preview data with empty links', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      // Mock fetch to never resolve (simulating ongoing request)
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        albumUrl: 'https://www.deezer.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Should NOT show "no buy links" message even though preview data has empty links
      expect(screen.queryByText('No buy links found for this album.')).not.toBeInTheDocument();

      // Should show loading state instead
      expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();
    });

    it('replaces preview data with actual fetched data', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      const mockResponse = {
        links: [
          {
            platform: 'itunes',
            displayName: 'iTunes',
            url: 'https://itunes.apple.com/album/123',
            category: 'download',
          },
        ],
        metadata: {
          title: 'Actual Album',
          artistName: 'Actual Artist',
          artwork: 'https://example.com/actual.jpg',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        artwork: 'https://example.com/preview.jpg',
        albumUrl: 'https://www.deezer.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Preview data visible initially
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Preview Artist')).toBeInTheDocument();

      // Wait for actual data to load
      await waitFor(() => {
        expect(screen.getByText('Actual Album')).toBeInTheDocument();
      });

      expect(screen.getByText('Actual Artist')).toBeInTheDocument();
      expect(screen.getByText('iTunes')).toBeInTheDocument();

      // Preview title should no longer be visible
      expect(screen.queryByText('Preview Album')).not.toBeInTheDocument();
    });

    it('works without preview data (standard loading flow)', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Radiohead';
        if (key === 'album') return 'OK Computer';
        // No preview data
        return null;
      });

      // Mock buy links response
      const mockBuyLinksResponse = {
        links: [
          {
            platform: 'itunes',
            displayName: 'iTunes',
            url: 'https://itunes.apple.com/album/123',
            category: 'download',
          },
        ],
        metadata: {
          title: 'Test Album',
          artistName: 'Test Artist',
          artwork: 'https://example.com/art.jpg',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuyLinksResponse,
      });

      render(<AlbumPageClient />, { wrapper: TestWrapper });

      // Should show loading initially (no preview data)
      expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Test Album')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(screen.getByText('iTunes')).toBeInTheDocument();
    });

    it('handles preview data with partial information (missing artwork)', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const PreviewWrapper = createWrapperWithPreview({
        title: 'Preview Album',
        artist: 'Preview Artist',
        albumUrl: 'https://www.deezer.com/album/123',
        // No artwork
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Preview title and artist should be visible
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Preview Artist')).toBeInTheDocument();

      // No artwork should be rendered
      expect(screen.queryByAltText('Preview Album album cover')).not.toBeInTheDocument();
    });
  });
});
