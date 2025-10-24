// Songlink API response types
export interface SonglinkResponse {
  entityUniqueId: string;
  userCountry: string;
  pageUrl: string;
  linksByPlatform: {
    [platform: string]: {
      url: string;
      entityUniqueId: string;
      nativeAppUriMobile?: string;
      nativeAppUriDesktop?: string;
    };
  };
  entitiesByUniqueId: {
    [uniqueId: string]: {
      id: string;
      type: 'song' | 'album';
      title?: string;
      artistName?: string;
      thumbnailUrl?: string;
      thumbnailWidth?: number;
      thumbnailHeight?: number;
      apiProvider: string;
      platforms: string[];
    };
  };
}

// Our app's types
export interface SearchResult {
  artist?: string;
  album?: string;
  songlink?: SonglinkResponse;
  links: PlatformLink[];
  metadata?: {
    title: string;
    artistName: string;
    artwork?: string;
  };
}

export interface PlatformLink {
  platform: string;
  displayName: string;
  url: string;
  category: 'download' | 'physical';
  icon?: string;
}

export type Region = 'US' | 'GB' | 'CA' | 'AU' | 'DE' | 'FR' | 'JP';

export interface SearchParams {
  artist: string;
  album?: string;
  region?: Region;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
}

// Spotify API types
export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string; width: number; height: number }[];
  release_date: string;
  album_type: string; // 'album', 'single', 'compilation'
  total_tracks: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifySearchResponse {
  artist: string;
  album?: string;
  results: SpotifyAlbum[];
}
