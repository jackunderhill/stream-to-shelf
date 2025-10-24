import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import SearchPage from '@/app/search/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock SearchBar component
jest.mock('@/components/SearchBar', () => {
  return function MockSearchBar() {
    return <div data-testid="search-bar">Search Bar</div>;
  };
});

describe('SearchPage', () => {
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

  it('renders loading state initially when artist is provided', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SearchPage />);

    expect(screen.getByText('Searching for albums...')).toBeInTheDocument();
  });

  it('fetches and displays search results', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    const mockResponse = {
      artist: 'Radiohead',
      results: [
        {
          id: '1',
          name: 'OK Computer',
          album_type: 'album',
          release_date: '1997-05-21',
          external_urls: { spotify: 'https://open.spotify.com/album/123' },
          images: [{ url: 'https://example.com/ok.jpg', width: 640, height: 640 }],
          artists: [{ name: 'Radiohead' }],
        },
        {
          id: '2',
          name: 'Kid A',
          album_type: 'album',
          release_date: '2000-10-02',
          external_urls: { spotify: 'https://open.spotify.com/album/456' },
          images: [{ url: 'https://example.com/kida.jpg', width: 640, height: 640 }],
          artists: [{ name: 'Radiohead' }],
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText('Results for "Radiohead"')).toBeInTheDocument();
    });

    expect(screen.getByText('Found 2 albums')).toBeInTheDocument();
    expect(screen.getByText('OK Computer')).toBeInTheDocument();
    expect(screen.getByText('Kid A')).toBeInTheDocument();
  });

  it('displays error message when fetch fails', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch results. Please try again.')).toBeInTheDocument();
    });
  });

  it('aborts fetch request when component unmounts', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    const abortMock = jest.fn();
    const mockAbortController = {
      signal: { aborted: false },
      abort: abortMock,
    };

    // Mock AbortController
    global.AbortController = jest.fn(() => mockAbortController) as any;

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { unmount } = render(<SearchPage />);

    // Verify fetch was called with abort signal
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

  it('aborts previous request when artist changes', async () => {
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
    }) as any;

    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    // Initial render
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    const { rerender } = render(<SearchPage />);

    expect(controllerCount).toBe(1);
    expect(abortMocks[0]).not.toHaveBeenCalled();

    // Change artist
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'The Beatles';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    rerender(<SearchPage />);

    // First controller should be aborted, second created
    expect(abortMocks[0]).toHaveBeenCalled();
    expect(controllerCount).toBe(2);
  });

  it('does not show error when request is aborted (AbortError)', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    render(<SearchPage />);

    // Wait for any potential error message
    await waitFor(() => {
      expect(screen.queryByText('Failed to fetch results. Please try again.')).not.toBeInTheDocument();
    });
  });

  it('handles no results gracefully', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'UnknownArtist123';
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    const mockResponse = {
      artist: 'UnknownArtist123',
      results: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText('No albums found for "UnknownArtist123"')).toBeInTheDocument();
    });
  });

  it('includes album name in search query when provided', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return 'Radiohead';
      if (key === 'album') return 'OK Computer';
      if (key === 'region') return 'US';
      return null;
    });

    const mockResponse = {
      artist: 'Radiohead',
      album: 'OK Computer',
      results: [
        {
          id: '1',
          name: 'OK Computer',
          album_type: 'album',
          release_date: '1997-05-21',
          external_urls: { spotify: 'https://open.spotify.com/album/123' },
          images: [{ url: 'https://example.com/ok.jpg', width: 640, height: 640 }],
          artists: [{ name: 'Radiohead' }],
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<SearchPage />);

    await waitFor(() => {
      expect(screen.getByText('Results for "Radiohead" - "OK Computer"')).toBeInTheDocument();
    });

    // Verify fetch was called with both artist and album parameters
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchCall).toContain('artist=Radiohead');
    expect(fetchCall).toContain('album=OK+Computer');
  });

  it('does not fetch when artist is missing', () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'artist') return null;
      if (key === 'album') return null;
      if (key === 'region') return 'US';
      return null;
    });

    render(<SearchPage />);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Searching for albums...')).not.toBeInTheDocument();
  });
});
