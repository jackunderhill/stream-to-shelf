/**
 * @jest-environment node
 */
import { GET } from '@/app/api/spotify-search/route';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';

describe('/api/spotify-search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      expect(data.error).toBe('Artist parameter is required');
    });
  });

  describe('Search Functionality', () => {
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

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'token_search_1_' + Date.now(),
              expires_in: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            albums: { items: mockAlbums },
          }),
        });
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

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'token_search_filter_unique_' + Date.now(),
              expires_in: -1, // Force expiration to get a fresh token
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            albums: { items: mockAlbums },
          }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Radiohead');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].artists[0].name).toBe('Radiohead');
    });

    it('should return empty results if no albums found', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'token_search_3_' + Date.now(),
              expires_in: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            albums: { items: [] },
          }),
        });
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=NonexistentArtist');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle Spotify API errors gracefully', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'token_error_1_' + Date.now(),
              expires_in: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=ErrorTest');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Spotify search failed');
    });

    it('should handle rate limiting (429)', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'token_error_2_' + Date.now(),
              expires_in: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 429,
        });
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=RateLimited');
      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it('should handle timeout errors', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'token_error_3_' + Date.now(),
              expires_in: 0,
            }),
          });
        }
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        return Promise.reject(abortError);
      });

      const request = new NextRequest('http://localhost:3000/api/spotify-search?artist=Timeout');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error).toBe('Request timeout - please try again');
    });
  });
});
