import { useState, useEffect, useRef } from 'react';
import { useDebounceValue } from 'usehooks-ts';

interface ArtistSuggestion {
  id: string;
  name: string;
  imageUrl?: string;
}

export function useArtistAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<ArtistSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedQuery] = useDebounceValue(query, 200);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear suggestions if query is too short
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const fetchSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/artist-autocomplete?query=${encodeURIComponent(debouncedQuery)}`,
          { signal: abortControllerRef.current!.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();
        setSuggestions(data.artists || []);
      } catch (error) {
        // Don't update state if request was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching artist suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();

    // Cleanup: abort request on unmount or query change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery]);

  return { suggestions, isLoading };
}
