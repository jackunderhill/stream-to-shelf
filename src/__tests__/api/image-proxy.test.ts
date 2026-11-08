/**
 * @jest-environment node
 */

import { GET } from '@/app/api/image-proxy/route';
import { NextRequest } from 'next/server';

global.fetch = jest.fn();

const IMAGE = 'https://is1-ssl.mzstatic.com/image/cover.jpg';

const proxy = (url: string) =>
  GET(new NextRequest(`http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`));

const image = (body: BodyInit | null, contentType = 'image/jpeg') =>
  new Response(body, { status: 200, headers: { 'Content-Type': contentType } });

describe('/api/image-proxy', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject query strings, as each would be a new image for the optimiser', async () => {
    const response = await proxy(`${IMAGE}?v=1`);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should reject extra parameters, for the same reason', async () => {
    const response = await GET(new NextRequest(`http://localhost:3000/api/image-proxy?url=${encodeURIComponent(IMAGE)}&v=1`));

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should serve artwork from an allowed host', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(image('image-bytes'));

    const response = await proxy(IMAGE);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(await response.text()).toBe('image-bytes');
  });

  it.each([
    ['http://169.254.169.254/latest/meta-data'],
    ['http://[::1]/'],
    ['http://2130706433/'],
    ['https://127.0.0.1.nip.io/'],
    ['https://evil.example/x.svg'],
    ['https://notdzcdn.net/x.jpg'],
    ['https://cdn.dzcdn.net.evil.example/x.jpg'],
    ['http://is1-ssl.mzstatic.com/cover.jpg'],
    ['https://artist.bandcamp.com/album/x'],
    ['not a url'],
  ])('should never fetch %s', async (url) => {
    const response = await proxy(url);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should not follow redirects, which could leave the allowed hosts', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(image('image-bytes'));

    await proxy(IMAGE);

    expect((global.fetch as jest.Mock).mock.calls[0][1].redirect).toBe('error');
  });

  it.each([['image/svg+xml'], ['IMAGE/SVG+XML; charset=utf-8'], ['text/html']])('should not serve %s', async (contentType) => {
    (global.fetch as jest.Mock).mockResolvedValue(image('<svg onload="alert(1)"/>', contentType));

    const response = await proxy(IMAGE);

    expect(response.status).toBe(400);
  });

  it('should stop reading an image over the size limit, even without a Content-Length', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const endless = new ReadableStream({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    (global.fetch as jest.Mock).mockResolvedValue(image(endless));

    const response = await proxy(IMAGE);

    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(15);
  });

  it('should not reveal what an upstream server answered', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('', { status: 401 }));

    const response = await proxy(IMAGE);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Failed to fetch image' });
  });

  it('should report failed fetches', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const response = await proxy(IMAGE);

    expect(response.status).toBe(503);
  });
});
