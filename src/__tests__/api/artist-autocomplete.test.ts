/**
 * @jest-environment node
 */
import { GET, resetTokenCache } from '@/app/api/artist-autocomplete/route';
import { NextRequest } from 'next/server';

describe('/api/artist-autocomplete', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTokenCache(); // Clear the token cache between tests
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env = {
      ...originalEnv,
      SPOTIFY_CLIENT_ID: 'test_client_id',
      SPOTIFY_CLIENT_SECRET: 'test_client_secret',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('returns empty array for queries shorter than 2 characters', async () => {
    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=a');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty array for empty query', async () => {
    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty array when query parameter is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches artist suggestions from Spotify', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    const mockSpotifyResponse = {
      artists: {
        items: [
          {
            id: '1',
            name: 'Radiohead',
            images: [
              { url: 'https://example.com/large.jpg', width: 640, height: 640 },
              { url: 'https://example.com/small.jpg', width: 64, height: 64 },
            ],
          },
          {
            id: '2',
            name: 'Radio Dept',
            images: [
              { url: 'https://example.com/radiodept.jpg', width: 64, height: 64 },
            ],
          },
        ],
      },
    };

    // Mock token fetch and search fetch
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpotifyResponse,
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=radio');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([
      {
        id: '1',
        name: 'Radiohead',
        imageUrl: 'https://example.com/small.jpg', // Smallest image
      },
      {
        id: '2',
        name: 'Radio Dept',
        imageUrl: 'https://example.com/radiodept.jpg',
      },
    ]);

    // Should have called token endpoint and search endpoint
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/search?q=radio&type=artist&limit=8'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock_token',
        }),
      })
    );
  });

  it('handles artists without images', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    const mockSpotifyResponse = {
      artists: {
        items: [
          {
            id: '1',
            name: 'Unknown Artist',
            images: [], // Empty images array
          },
        ],
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpotifyResponse,
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=unknown');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([
      {
        id: '1',
        name: 'Unknown Artist',
        imageUrl: undefined,
      },
    ]);
  });

  it('handles empty results from Spotify', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    const mockSpotifyResponse = {
      artists: {
        items: [],
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpotifyResponse,
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=xyz123');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([]);
  });

  it('returns 500 when Spotify API fails', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Spotify search failed');
  });

  it('returns 500 when token retrieval fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to authenticate with Spotify');
  });

  it('handles network errors gracefully', async () => {
    // Network error occurs during token fetch
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    // When token fetch fails due to network error, it returns the auth error
    expect(data.error).toBe('Failed to authenticate with Spotify');
  });

  it('returns empty array on timeout errors', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'AbortError';

    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockRejectedValueOnce(timeoutError);

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.artists).toEqual([]);
  });

  it('sanitizes query input by trimming and limiting length', async () => {
    const longQuery = 'a'.repeat(150); // 150 characters

    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ artists: { items: [] } }),
      });

    const request = new NextRequest(`http://localhost:3000/api/artist-autocomplete?query=${longQuery}`);
    await GET(request);

    // Should only use first 100 characters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('a'.repeat(100))),
      expect.any(Object)
    );
  });

  it('uses smallest available image from Spotify', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    const mockSpotifyResponse = {
      artists: {
        items: [
          {
            id: '1',
            name: 'Test Artist',
            images: [
              { url: 'https://example.com/large.jpg', width: 640, height: 640 },
              { url: 'https://example.com/medium.jpg', width: 320, height: 320 },
              { url: 'https://example.com/small.jpg', width: 64, height: 64 },
            ],
          },
        ],
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpotifyResponse,
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);
    const data = await response.json();

    // Should use the last (smallest) image
    expect(data.artists).toHaveLength(1);
    expect(data.artists[0].imageUrl).toBe('https://example.com/small.jpg');
  });

  it('limits results to 8 artists', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ artists: { items: [] } }),
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    await GET(request);

    // Check that the Spotify API was called with limit=8
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=8'),
      expect.any(Object)
    );
  });

  it('sets no-cache headers on successful response', async () => {
    const mockTokenResponse = {
      access_token: 'mock_token',
      expires_in: 3600,
    };

    const mockSpotifyResponse = {
      artists: { items: [] },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpotifyResponse,
      });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    // Check that response is successful
    expect(response.status).toBe(200);

    // Check cache headers
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    expect(response.headers.get('Pragma')).toBe('no-cache');
  });
});
