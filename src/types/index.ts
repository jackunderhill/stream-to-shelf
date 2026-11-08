// Our app's types
export interface SearchResult {
  links: PlatformLink[];
  metadata?: {
    title: string;
    artistName: string;
    artistId?: string;
    artwork?: string;
  };
}

export interface PlatformLink {
  platform: string;
  displayName: string;
  url: string;
  category: 'download' | 'physical';
  /** True when the link goes to the store's search page rather than the album itself */
  isSearch?: boolean;
}

export type Region = 'US' | 'GB' | 'CA' | 'AU' | 'DE' | 'FR' | 'JP';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
}

// Music catalog types
export interface Artist {
  id: string;
  name: string;
}

export interface Album {
  id: string;
  name: string;
  artists: Artist[];
  images: { url: string; width: number; height: number }[];
  release_date?: string;
  album_type: string;
  total_tracks: number;
  url: string;
}

export interface AlbumSearchResponse {
  artist: string;
  album?: string;
  results: Album[];
}
