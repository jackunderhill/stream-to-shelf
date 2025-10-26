import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import AlbumPageClient from '@/app/album/AlbumPageClient';

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

describe('AlbumPageClient', () => {
  const mockSearchParams = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
      return null;
    });

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AlbumPageClient />);

    expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();
  });

  it('fetches and displays album buy links', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
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
      json: async () => mockResponse,
    });

    render(<AlbumPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('iTunes')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
  });

  it('displays error message when fetch fails', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<AlbumPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch buy links. Please try again.')).toBeInTheDocument();
    });
  });

  it('aborts fetch request when component unmounts', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
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

    const { unmount } = render(<AlbumPageClient />);

    // Verify fetch was called with abort signal
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/songlink'),
      expect.objectContaining({
        signal: mockAbortController.signal,
      })
    );

    // Unmount component
    unmount();

    // Verify abort was called
    expect(abortMock).toHaveBeenCalled();
  });

  it('aborts previous request when spotifyUrl changes', async () => {
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
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
      return null;
    });

    const { rerender } = render(<AlbumPageClient />);

    expect(controllerCount).toBe(1);
    expect(abortMocks[0]).not.toHaveBeenCalled();

    // Change spotifyUrl
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/456';
      if (key === 'region') return 'US';
      return null;
    });

    rerender(<AlbumPageClient />);

    // First controller should be aborted, second created
    expect(abortMocks[0]).toHaveBeenCalled();
    expect(controllerCount).toBe(2);
  });

  it('does not show error when request is aborted (AbortError)', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
      return null;
    });

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    render(<AlbumPageClient />);

    // Wait for any potential error message
    await waitFor(() => {
      expect(screen.queryByText('Failed to fetch buy links. Please try again.')).not.toBeInTheDocument();
    });
  });

  it('handles no buy links gracefully', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
      return null;
    });

    const mockResponse = {
      links: [],
      metadata: {
        title: 'Test Album',
        artistName: 'Test Artist',
        artwork: 'https://example.com/art.jpg',
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<AlbumPageClient />);

    await waitFor(() => {
      expect(screen.getByText('No buy links found for this album.')).toBeInTheDocument();
    });
  });

  it('does not fetch when spotifyUrl is missing', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return null;
      return null;
    });

    render(<AlbumPageClient />);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe('Preview Data Functionality', () => {
    it('displays preview data immediately when provided', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        if (key === 'previewTitle') return 'Preview Album';
        if (key === 'previewArtist') return 'Preview Artist';
        if (key === 'previewArtwork') return 'https://example.com/preview.jpg';
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AlbumPageClient />);

      // Preview data should be visible immediately, even while loading
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Preview Artist')).toBeInTheDocument();
      expect(screen.getByAltText('Preview Album album cover')).toHaveAttribute(
        'src',
        'https://example.com/preview.jpg'
      );
    });

    it('shows loading spinner when preview data is shown but not yet fetched', () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        if (key === 'previewTitle') return 'Preview Album';
        if (key === 'previewArtist') return 'Preview Artist';
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AlbumPageClient />);

      // Should show preview data AND loading spinner
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();
    });

    it('does not show "no buy links" message for preview data with empty links', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        if (key === 'previewTitle') return 'Preview Album';
        if (key === 'previewArtist') return 'Preview Artist';
        return null;
      });

      // Mock fetch to never resolve (simulating ongoing request)
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<AlbumPageClient />);

      // Should NOT show "no buy links" message even though preview data has empty links
      expect(screen.queryByText('No buy links found for this album.')).not.toBeInTheDocument();

      // Should show loading state instead
      expect(screen.getByText('Finding where to buy...')).toBeInTheDocument();
    });

    it('replaces preview data with actual fetched data', async () => {
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        if (key === 'previewTitle') return 'Preview Album';
        if (key === 'previewArtist') return 'Preview Artist';
        if (key === 'previewArtwork') return 'https://example.com/preview.jpg';
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

      render(<AlbumPageClient />);

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
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        if (key === 'previewTitle') return 'Preview Album';
        if (key === 'previewArtist') return 'Preview Artist';
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

      render(<AlbumPageClient />);

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
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        // No preview data
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
          title: 'Test Album',
          artistName: 'Test Artist',
          artwork: 'https://example.com/art.jpg',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<AlbumPageClient />);

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
        if (key === 'spotifyUrl') return 'https://open.spotify.com/album/123';
        if (key === 'previewTitle') return 'Preview Album';
        if (key === 'previewArtist') return 'Preview Artist';
        // No previewArtwork
        return null;
      });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<AlbumPageClient />);

      // Preview title and artist should be visible
      expect(screen.getByText('Preview Album')).toBeInTheDocument();
      expect(screen.getByText('Preview Artist')).toBeInTheDocument();

      // No artwork should be rendered
      expect(screen.queryByAltText('Preview Album by Preview Artist')).not.toBeInTheDocument();
    });
  });
});
