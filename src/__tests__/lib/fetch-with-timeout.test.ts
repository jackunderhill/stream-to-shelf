/**
 * @jest-environment node
 */

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

global.fetch = jest.fn();

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should keep the timeout running after the headers arrive, so that it covers the body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await fetchWithTimeout('https://example.com', {}, 1000);
    const { signal } = (global.fetch as jest.Mock).mock.calls[0][1];

    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(signal.aborted).toBe(true);
  });

  it('should pass on the request options', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await fetchWithTimeout('https://example.com', { method: 'POST' });

    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe('POST');
  });
});
