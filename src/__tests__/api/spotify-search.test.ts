/**
 * @jest-environment node
 */
import { GET } from '@/app/api/spotify-search/route';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/spotify-search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Input Validation', () => {
    it('should return 400 if artist parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/spotify-search');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Artist parameter is required');
    });

    it('should return 400 if artist parameter is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Artist parameter is required');
    });

    it('should return 400 if artist is only whitespace', async () => {
      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=%20%20%20');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Artist parameter cannot be empty');
    });

    it('should trim and sanitize artist input', async () => {
      // Mock token request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600,
        }),
      });

      // Mock search request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: {
            items: [],
          },
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=%20%20Radiohead%20%20');

      await GET(request);

      // Check that the search was called with trimmed artist
      const searchCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(searchCall[0]).toContain('artist%3ARadiohead');
    });
  });

  describe('Authentication', () => {
    it('should return 500 if Spotify authentication fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to authenticate with Spotify');
    });

    it('should cache and reuse access tokens', async () => {
      // Mock token request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'cached_token',
          expires_in: 3600,
        }),
      });

      // Mock first search request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: { items: [] },
        }),
      });

      // Mock second search request (should NOT request new token)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: { items: [] },
        }),
      });

      // First request
      const request1 = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');
      await GET(request1);

      // Second request - should use cached token
      const request2 = new NextRequest('http://localhost:3000/api/spotify-search?artist=Beatles');
      await GET(request2);

      // Should have called fetch 3 times: 1 token + 2 searches
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      // Mock token request for all tests in this group
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600,
        }),
      });
    });

    it('should successfully search for artist', async () => {
      const mockAlbums = [
        {
          id: '1',
          name: 'OK Computer',
          artists: [{ name: 'Radiohead' }],
          images: [{ url: 'https://example.com/image.jpg', width: 640, height: 640 }],
          release_date: '1997-05-21',
          album_type: 'album',
          total_tracks: 12,
          external_urls: { spotify: 'https://open.spotify.com/album/1' },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: {
            items: mockAlbums,
          },
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artist).toBe('Radiohead');
      expect(data.results).toEqual(mockAlbums);
    });

    it('should filter results to match the requested artist', async () => {
      const mockAlbums = [
        {
          id: '1',
          name: 'OK Computer',
          artists: [{ name: 'Radiohead' }],
          images: [{ url: 'https://example.com/image.jpg', width: 640, height: 640 }],
          release_date: '1997-05-21',
          album_type: 'album',
          total_tracks: 12,
          external_urls: { spotify: 'https://open.spotify.com/album/1' },
        },
        {
          id: '2',
          name: 'Different Artist Album',
          artists: [{ name: 'Other Band' }],
          images: [{ url: 'https://example.com/image2.jpg', width: 640, height: 640 }],
          release_date: '2000-01-01',
          album_type: 'album',
          total_tracks: 10,
          external_urls: { spotify: 'https://open.spotify.com/album/2' },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: {
            items: mockAlbums,
          },
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].artists[0].name).toBe('Radiohead');
    });

    it('should search with both artist and album parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: {
            items: [],
          },
        }),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/spotify-search?artist=Radiohead&album=OK%20Computer'
      );

      await GET(request);

      const searchCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(searchCall[0]).toContain('artist%3ARadiohead');
      expect(searchCall[0]).toContain('album%3AOK%20Computer');
    });

    it('should return empty results if no albums found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          albums: {
            items: [],
          },
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=NonexistentArtist');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Mock token request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600,
        }),
      });
    });

    it('should handle Spotify API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Spotify search failed');
    });

    it('should handle rate limiting (429)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error).toBe('Request timeout - please try again');
    });
  });
});
