/**
 * @jest-environment node
 */
import { GET } from '@/app/api/artist-autocomplete/route';
import { NextRequest } from 'next/server';

describe('/api/artist-autocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('fetches artist suggestions from Deezer', async () => {
    const mockDeezerResponse = {
      data: [
        {
          id: 1,
          name: 'Radiohead',
          picture_medium: 'https://e-cdns-images.dzcdn.net/images/artist/radiohead.jpg',
        },
        {
          id: 2,
          name: 'Radio Dept',
          picture_medium: 'https://e-cdns-images.dzcdn.net/images/artist/radiodept.jpg',
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDeezerResponse,
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=radio');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([
      { id: '1', name: 'Radiohead', imageUrl: 'https://e-cdns-images.dzcdn.net/images/artist/radiohead.jpg' },
      { id: '2', name: 'Radio Dept', imageUrl: 'https://e-cdns-images.dzcdn.net/images/artist/radiodept.jpg' },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.deezer.com/search/artist'),
      expect.any(Object)
    );
  });

  it('handles artists without images', async () => {
    const mockDeezerResponse = {
      data: [
        {
          id: 1,
          name: 'Unknown Artist',
          picture_medium: '',
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDeezerResponse,
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=unknown');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([
      { id: '1', name: 'Unknown Artist', imageUrl: undefined },
    ]);
  });

  it('handles empty results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=xyz123');
    const response = await GET(request);
    const data = await response.json();

    expect(data.artists).toEqual([]);
  });

  it('returns 500 when Deezer API fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Artist search failed');
  });

  it('reports the quota errors that Deezer sends as HTTP 200', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }),
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=radiohead');
    const response = await GET(request);

    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalled();
  });

  it('handles network errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Artist search failed');
  });

  it('returns empty array on timeout errors', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'AbortError';

    (global.fetch as jest.Mock).mockRejectedValueOnce(timeoutError);

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.artists).toEqual([]);
  });

  it('sanitizes query input by trimming and limiting length', async () => {
    const longQuery = 'a'.repeat(150);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const request = new NextRequest(`http://localhost:3000/api/artist-autocomplete?query=${longQuery}`);
    await GET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('a'.repeat(100))),
      expect.any(Object)
    );
  });

  it('limits results to 8 artists', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    await GET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=8'),
      expect.any(Object)
    );
  });

  it('sets no-cache headers on successful response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const request = new NextRequest('http://localhost:3000/api/artist-autocomplete?query=test');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    expect(response.headers.get('Pragma')).toBe('no-cache');
  });
});
