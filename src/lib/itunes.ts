import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { Lookup } from '@/lib/lookup-cache';
import { albumKey, findByArtist, plainQuotes } from '@/lib/music-text';
import { Region } from '@/types';

const ITUNES_API_URL = 'https://itunes.apple.com';
const ITUNES_TIMEOUT = 5000;

export interface ItunesAlbum {
  url: string;
  artwork?: string;
}

interface ItunesCollection {
  wrapperType?: string;
  collectionName?: string;
  collectionViewUrl?: string;
  artistName?: string;
  artworkUrl100?: string;
}

async function fetchCollections(path: string): Promise<ItunesCollection[] | null> {
  try {
    const response = await fetchWithTimeout(`${ITUNES_API_URL}${path}`, {}, ITUNES_TIMEOUT);
    if (!response.ok) {
      console.error('iTunes API error:', response.status);
      return null;
    }

    const data = await response.json();
    return (data.results ?? []).filter((item: ItunesCollection) => item.wrapperType === 'collection');
  } catch (error) {
    console.error('iTunes fetch error:', error);
    return null;
  }
}

function toAlbum(collection: ItunesCollection | undefined): ItunesAlbum | null {
  if (!collection?.collectionViewUrl) return null;
  return {
    url: collection.collectionViewUrl.split('?')[0],
    artwork: collection.artworkUrl100?.replace('100x100bb', '600x600bb'),
  };
}

/** Find an album in the region's iTunes store, by UPC where possible and otherwise by name */
export async function findItunesAlbum(
  upc: string | undefined,
  artist: string,
  album: string,
  region: Region
): Promise<Lookup<ItunesAlbum | null>> {
  const hasSameTitle = (item: ItunesCollection) => albumKey(item.collectionName ?? '') === albumKey(album);

  let byUpc: ItunesCollection[] | null = [];
  if (upc) {
    byUpc = await fetchCollections(`/lookup?upc=${upc}&country=${region}&entity=album`);
    // Barcodes do get reused, and one can return several of an artist's releases, so go by the title
    const match = byUpc?.find(hasSameTitle);
    if (match) return { value: toAlbum(match), complete: true };
  }

  const term = encodeURIComponent(plainQuotes(`${artist} ${album}`));
  const byName = await fetchCollections(`/search?term=${term}&country=${region}&entity=album&limit=25`);

  return {
    value: toAlbum(findByArtist(byName?.filter(hasSameTitle) ?? [], artist, (item) => item.artistName)),
    complete: byUpc !== null && byName !== null,
  };
}
