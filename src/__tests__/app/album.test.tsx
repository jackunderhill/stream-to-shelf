import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSearchParams } from 'next/navigation';
import AlbumPageClient from '@/app/album/AlbumPageClient';
import { SearchPreviewProvider } from '@/contexts/SearchPreviewContext';
import React from 'react';

interface AlbumPreview {
  title: string;
  artist: string;
  artwork?: string;
  spotifyUrl: string;
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

    // Mock the Spotify search API response (to get the Spotify URL)
    const mockSearchResponse = {
      artist: 'Radiohead',
      results: [
        {
          id: '1',
          name: 'OK Computer',
          external_urls: { spotify: 'https://open.spotify.com/album/123' },
          images: [{ url: 'https://example.com/ok.jpg' }],
          artists: [{ name: 'Radiohead' }],
        },
      ],
    };

    // Mock the songlink API response (buy links)
    const mockSonglinkResponse = {
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

    // Mock both API calls in sequence
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
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
    global.AbortController = jest.fn(() => mockAbortController) as unknown as typeof AbortController;

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { unmount } = render(<AlbumPageClient />, { wrapper: TestWrapper });

    // Verify fetch was called with abort signal (for spotify-search)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/spotify-search'),
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
    global.AbortController = jest.fn(() => {
      const abortMock = jest.fn();
      abortMocks.push(abortMock);
      controllerCount++;
      return {
        signal: { aborted: false },
        abort: abortMock,
      };
    }) as unknown as typeof AbortController;

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

    // Wait for any potential error message
    await waitFor(() => {
      expect(screen.queryByText('Failed to fetch buy links. Please try again.')).not.toBeInTheDocument();
    });
  });

  it('handles no buy links gracefully', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      return null;
    });

    // Mock the Spotify search API response
    const mockSearchResponse = {
      artist: 'Radiohead',
      results: [
        {
          id: '1',
          name: 'OK Computer',
          external_urls: { spotify: 'https://open.spotify.com/album/123' },
          images: [{ url: 'https://example.com/ok.jpg' }],
          artists: [{ name: 'Radiohead' }],
        },
      ],
    };

    // Mock songlink response with no links
    const mockSonglinkResponse = {
      links: [],
      metadata: {
        title: 'Test Album',
        artistName: 'Test Artist',
        artwork: 'https://example.com/art.jpg',
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

    render(<AlbumPageClient />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText('No buy links found for this album.')).toBeInTheDocument();
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
        spotifyUrl: 'https://open.spotify.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Preview data should be visible immediately, even while loading
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Preview Artist')).toBeInTheDocument();

      // Image URL should either be direct (if whitelisted) or proxied (if not)
      const imageElement = screen.getByAltText('Preview Album album cover');
      const src = imageElement.getAttribute('src');
      const isProxied = src?.startsWith('/api/image-proxy');
      const isDirect = src === 'https://example.com/preview.jpg';
      expect(isProxied || isDirect).toBe(true);
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
        spotifyUrl: 'https://open.spotify.com/album/123',
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
        spotifyUrl: 'https://open.spotify.com/album/123',
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
        spotifyUrl: 'https://open.spotify.com/album/123',
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

    it('shows "no buy links" message only after fetching completes with empty results', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Preview Artist';
        if (key === 'album') return 'Preview Album';
        return null;
      });

      const mockResponse = {
        links: [], // No buy links
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
        spotifyUrl: 'https://open.spotify.com/album/123',
      });

      render(<AlbumPageClient />, { wrapper: PreviewWrapper });

      // Should not show message initially
      expect(screen.queryByText('No buy links found for this album.')).not.toBeInTheDocument();

      // Wait for fetch to complete
      await waitFor(() => {
        expect(screen.getByText('No buy links found for this album.')).toBeInTheDocument();
      });

      // Loading spinner should be gone
      expect(screen.queryByText('Finding where to buy...')).not.toBeInTheDocument();
    });

    it('works without preview data (standard loading flow)', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'artist') return 'Radiohead';
        if (key === 'album') return 'OK Computer';
        // No preview data
        return null;
      });

      // Mock the Spotify search API response
      const mockSearchResponse = {
        artist: 'Radiohead',
        results: [
          {
            id: '1',
            name: 'OK Computer',
            external_urls: { spotify: 'https://open.spotify.com/album/123' },
            images: [{ url: 'https://example.com/ok.jpg' }],
            artists: [{ name: 'Radiohead' }],
          },
        ],
      };

      // Mock songlink response
      const mockSonglinkResponse = {
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

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSonglinkResponse,
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
        spotifyUrl: 'https://open.spotify.com/album/123',
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
