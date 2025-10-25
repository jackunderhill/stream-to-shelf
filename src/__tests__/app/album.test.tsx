import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import AlbumPage from '@/app/album/page';

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

describe('AlbumPage', () => {
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

    render(<AlbumPage />);

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

    render(<AlbumPage />);

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

    render(<AlbumPage />);

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

    const { unmount } = render(<AlbumPage />);

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

    const { rerender } = render(<AlbumPage />);

    expect(controllerCount).toBe(1);
    expect(abortMocks[0]).not.toHaveBeenCalled();

    // Change spotifyUrl
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return 'https://open.spotify.com/album/456';
      if (key === 'region') return 'US';
      return null;
    });

    rerender(<AlbumPage />);

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

    render(<AlbumPage />);

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

    render(<AlbumPage />);

    await waitFor(() => {
      expect(screen.getByText('No buy links found for this album.')).toBeInTheDocument();
    });
  });

  it('does not fetch when spotifyUrl is missing', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'spotifyUrl') return null;
      return null;
    });

    render(<AlbumPage />);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
