'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AlbumPreview {
  title: string;
  artist: string;
  artwork?: string;
  spotifyUrl: string;
}

interface SearchPreviewContextType {
  previewData: AlbumPreview | null;
  setPreviewData: (data: AlbumPreview | null) => void;
}

const SearchPreviewContext = createContext<SearchPreviewContextType | undefined>(undefined);

export function SearchPreviewProvider({ children, initialData }: { children: ReactNode; initialData?: AlbumPreview | null }) {
  const [previewData, setPreviewData] = useState<AlbumPreview | null>(initialData ?? null);

  return (
    <SearchPreviewContext.Provider value={{ previewData, setPreviewData }}>
      {children}
    </SearchPreviewContext.Provider>
  );
}

export function useSearchPreview() {
  const context = useContext(SearchPreviewContext);
  if (context === undefined) {
    throw new Error('useSearchPreview must be used within a SearchPreviewProvider');
  }
  return context;
}
