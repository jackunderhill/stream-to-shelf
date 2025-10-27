import { renderHook, waitFor } from '@testing-library/react';
import { useArtistAutocomplete } from '@/hooks/useArtistAutocomplete';

// Mock useDebounceValue from usehooks-ts
jest.mock('usehooks-ts', () => ({
  useDebounceValue: jest.fn((value) => [value]),
}));

describe('useArtistAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns empty suggestions for queries shorter than 2 characters', () => {
    const { result } = renderHook(() => useArtistAutocomplete('a'));

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches artist suggestions for valid query', async () => {
    const mockArtists = [
      { id: '1', name: 'Radiohead', imageUrl: 'https://example.com/radiohead.jpg' },
      { id: '2', name: 'Radio Dept', imageUrl: 'https://example.com/radiodept.jpg' },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ artists: mockArtists }),
    });

    const { result } = renderHook(() => useArtistAutocomplete('radio'));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual(mockArtists);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/artist-autocomplete?query=radio',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('handles fetch errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useArtistAutocomplete('test'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching artist suggestions:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('does not update state for aborted requests', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useArtistAutocomplete('test'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not show error or update suggestions for aborted requests
    expect(result.current.suggestions).toEqual([]);
  });

  it('returns empty array when API returns no artists', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ artists: [] }),
    });

    const { result } = renderHook(() => useArtistAutocomplete('xyz123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('aborts previous request when query changes', async () => {
    const abortMock = jest.fn();
    const mockAbortController = {
      signal: { aborted: false } as AbortSignal,
      abort: abortMock,
    };

    global.AbortController = jest.fn(() => mockAbortController) as unknown as typeof AbortController;

    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { rerender } = renderHook(
      ({ query }) => useArtistAutocomplete(query),
      { initialProps: { query: 'radio' } }
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Change query
    rerender({ query: 'beatles' });

    // Previous request should be aborted
    expect(abortMock).toHaveBeenCalled();
  });

  it('handles API response without artists field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // No artists field
    });

    const { result } = renderHook(() => useArtistAutocomplete('test'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual([]);
  });
});
