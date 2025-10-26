/**
 * @jest-environment node
 */
import { GET } from '@/app/api/songlink/route';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.DISCOGS_TOKEN = 'test_discogs_token';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/songlink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Input Validation', () => {
    it('should return 400 if url parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/songlink');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('URL parameter is required');
    });

    it('should return 400 if url parameter is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/songlink?url=');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('URL parameter is required');
    });

    it('should return 400 for invalid URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/songlink?url=not-a-valid-url');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid URL format');
    });

    it('should return 400 for invalid region', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&region=INVALID'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid region parameter');
    });

    it('should accept valid regions', async () => {
      const validRegions = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP'];

      for (const region of validRegions) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            entityUniqueId: 'test',
            userCountry: region,
            pageUrl: 'https://song.link/test',
            linksByPlatform: {},
            entitiesByUniqueId: {
              test: {
                id: '1',
                type: 'album' as const,
                title: 'Test Album',
                artistName: 'Test Artist',
                apiProvider: 'spotify',
                platforms: [],
              },
            },
          }),
        });

        const request = new NextRequest(
          `http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&region=${region}`
        );

        const response = await GET(request);

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Songlink API Integration', () => {
    it('should successfully fetch and return songlink data', async () => {
      const mockSonglinkResponse = {
        entityUniqueId: 'SPOTIFY_ALBUM::123',
        userCountry: 'US',
        pageUrl: 'https://song.link/s/123',
        linksByPlatform: {
          itunes: {
            url: 'https://music.apple.com/album/123',
            entityUniqueId: 'ITUNES_ALBUM::123',
          },
          bandcamp: {
            url: 'https://bandcamp.com/album/test',
            entityUniqueId: 'BANDCAMP_ALBUM::123',
          },
        },
        entitiesByUniqueId: {
          'SPOTIFY_ALBUM::123': {
            id: '123',
            type: 'album' as const,
            title: 'OK Computer',
            artistName: 'Radiohead',
            thumbnailUrl: 'https://example.com/image.jpg',
            apiProvider: 'spotify',
            platforms: ['spotify', 'itunes'],
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&artist=Radiohead&album=OK%20Computer'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata?.title).toBe('OK Computer');
      expect(data.metadata?.artistName).toBe('Radiohead');
      expect(data.links).toBeInstanceOf(Array);
    });

    it('should return empty results if Songlink API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const request = new NextRequest('http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.links).toEqual([]);
      expect(data.metadata).toBeUndefined();
    });
  });

  describe('Platform Links Generation', () => {
    it('should categorize links into download and physical', async () => {
      const mockSonglinkResponse = {
        entityUniqueId: 'SPOTIFY_ALBUM::123',
        userCountry: 'US',
        pageUrl: 'https://song.link/s/123',
        linksByPlatform: {
          itunes: {
            url: 'https://music.apple.com/album/123',
            entityUniqueId: 'ITUNES_ALBUM::123',
          },
          bandcamp: {
            url: 'https://bandcamp.com/album/test',
            entityUniqueId: 'BANDCAMP_ALBUM::123',
          },
        },
        entitiesByUniqueId: {
          'SPOTIFY_ALBUM::123': {
            id: '123',
            type: 'album' as const,
            title: 'OK Computer',
            artistName: 'Radiohead',
            apiProvider: 'spotify',
            platforms: ['spotify', 'itunes'],
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&artist=Radiohead&album=OK%20Computer'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      const downloadLinks = data.links.filter((link: { category: string }) => link.category === 'download');
      const physicalLinks = data.links.filter((link: { category: string }) => link.category === 'physical');

      expect(downloadLinks.length).toBeGreaterThan(0);
      expect(physicalLinks.length).toBeGreaterThan(0);
    });

    it('should include Amazon digital and physical links', async () => {
      const mockSonglinkResponse = {
        entityUniqueId: 'SPOTIFY_ALBUM::123',
        userCountry: 'US',
        pageUrl: 'https://song.link/s/123',
        linksByPlatform: {},
        entitiesByUniqueId: {
          'SPOTIFY_ALBUM::123': {
            id: '123',
            type: 'album' as const,
            title: 'OK Computer',
            artistName: 'Radiohead',
            apiProvider: 'spotify',
            platforms: [],
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&artist=Radiohead&album=OK%20Computer'
      );

      const response = await GET(request);
      const data = await response.json();

      const amazonDigital = data.links.find((link: { platform: string }) => link.platform === 'amazonDigital');
      const amazonPhysical = data.links.find((link: { platform: string }) => link.platform === 'amazonPhysical');

      expect(amazonDigital).toBeDefined();
      expect(amazonDigital.category).toBe('download');
      expect(amazonPhysical).toBeDefined();
      expect(amazonPhysical.category).toBe('physical');
    });

    it('should use correct Amazon domain for region', async () => {
      const mockSonglinkResponse = {
        entityUniqueId: 'SPOTIFY_ALBUM::123',
        userCountry: 'GB',
        pageUrl: 'https://song.link/s/123',
        linksByPlatform: {},
        entitiesByUniqueId: {
          'SPOTIFY_ALBUM::123': {
            id: '123',
            type: 'album' as const,
            title: 'OK Computer',
            artistName: 'Radiohead',
            apiProvider: 'spotify',
            platforms: [],
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&region=GB&artist=Radiohead&album=OK%20Computer'
      );

      const response = await GET(request);
      const data = await response.json();

      const amazonLink = data.links.find((link: { platform: string }) => link.platform === 'amazonDigital');

      expect(amazonLink.url).toContain('amazon.co.uk');
    });
  });

  describe('Discogs Integration', () => {
    it('should fetch Discogs results when artist and album provided', async () => {
      const mockSonglinkResponse = {
        entityUniqueId: 'SPOTIFY_ALBUM::123',
        userCountry: 'US',
        pageUrl: 'https://song.link/s/123',
        linksByPlatform: {},
        entitiesByUniqueId: {
          'SPOTIFY_ALBUM::123': {
            id: '123',
            type: 'album' as const,
            title: 'OK Computer',
            artistName: 'Radiohead',
            apiProvider: 'spotify',
            platforms: [],
          },
        },
      };

      const mockDiscogsResponse = {
        results: [
          {
            id: 1,
            uri: '/release/12345',
            title: 'Radiohead - OK Computer',
          },
        ],
      };

      // Mock Songlink fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

      // Mock Discogs fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiscogsResponse,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&artist=Radiohead&album=OK%20Computer'
      );

      const response = await GET(request);
      const data = await response.json();

      const discogsLink = data.links.find((link: { platform: string }) => link.platform === 'discogs');

      expect(discogsLink).toBeDefined();
      expect(discogsLink.url).toBe('https://www.discogs.com/release/12345');
      expect(discogsLink.category).toBe('physical');
    });

    it('should handle Discogs API errors gracefully', async () => {
      const mockSonglinkResponse = {
        entityUniqueId: 'SPOTIFY_ALBUM::123',
        userCountry: 'US',
        pageUrl: 'https://song.link/s/123',
        linksByPlatform: {},
        entitiesByUniqueId: {
          'SPOTIFY_ALBUM::123': {
            id: '123',
            type: 'album' as const,
            title: 'OK Computer',
            artistName: 'Radiohead',
            apiProvider: 'spotify',
            platforms: [],
          },
        },
      };

      // Mock Songlink fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSonglinkResponse,
      });

      // Mock Discogs fetch failure
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123&artist=Radiohead&album=OK%20Computer'
      );

      const response = await GET(request);
      const data = await response.json();

      // Should still return results without Discogs link
      expect(response.status).toBe(200);
      expect(data.links).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

      const request = new NextRequest('http://localhost:3000/api/songlink?url=https://open.spotify.com/album/123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error).toBe('Request timeout - please try again');
    });
  });
});
