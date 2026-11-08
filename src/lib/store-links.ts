import { ItunesAlbum } from '@/lib/itunes';
import { MusicBrainzLinks } from '@/lib/musicbrainz';
import { plainQuotes } from '@/lib/music-text';
import { StorePages, withoutWww } from '@/lib/store-pages';
import { PlatformLink, Region } from '@/types';

// Map regions to Amazon domains
const AMAZON_DOMAINS: Record<Region, string> = {
  'US': 'amazon.com',
  'GB': 'amazon.co.uk',
  'CA': 'amazon.ca',
  'AU': 'amazon.com.au',
  'DE': 'amazon.de',
  'FR': 'amazon.fr',
  'JP': 'amazon.co.jp',
};

// Map regions to 7digital domains
const SEVENDIGITAL_DOMAINS: Record<Region, string> = {
  'US': 'us.7digital.com',
  'GB': 'uk.7digital.com',
  'CA': 'ca.7digital.com',
  'AU': 'au.7digital.com',
  'DE': 'de.7digital.com',
  'FR': 'fr.7digital.com',
  'JP': 'us.7digital.com', // Japan uses US store
};

// Map regions to Qobuz locale codes
const QOBUZ_LOCALES: Record<Region, string> = {
  'US': 'us-en',
  'GB': 'gb-en',
  'CA': 'ca-en',
  'AU': 'au-en',
  'DE': 'de-de',
  'FR': 'fr-fr',
  'JP': 'us-en', // Japan uses US store
};

// World of Books' regional stores. Everyone else uses its main store at the root,
// as other locales either redirect to the homepage or don't exist.
const WORLDOFBOOKS_PATHS: Partial<Record<Region, string>> = {
  'GB': 'en-gb/',
  'AU': 'en-au/',
};

const WORLDOFBOOKS_MUSIC = '&shopify_products%5BhierarchicalMenu%5D%5BhierarchicalCategories.lvl0%5D%5B0%5D=Music';

// Regions served by artists' regional shops, whose subdomains look like shopus., store-us. or eustore.
const SHOP_REGIONS: Record<string, Region[]> = {
  us: ['US'],
  ca: ['CA'],
  uk: ['GB'],
  gb: ['GB'],
  au: ['AU'],
  eu: ['DE', 'FR'],
};
const REGIONAL_SHOP = /^(?:shop|store)?-?(us|ca|uk|gb|au|eu)-?(?:shop|store)?\./;

interface StoreLinkSources {
  region: Region;
  artist: string;
  album: string;
  musicBrainz: MusicBrainzLinks;
  itunes: ItunesAlbum | null;
  discogsUrl: string | null;
  storePages: StorePages;
}

/** Prefer the shop for this region, then the artist's main shop over one for somewhere else */
function shopForRegion(urls: string[], region: Region): string | undefined {
  const shopRegions = (url: string) => {
    const code = new URL(url).hostname.match(REGIONAL_SHOP)?.[1];
    return code ? SHOP_REGIONS[code] : undefined;
  };

  return urls.find((url) => shopRegions(url)?.includes(region)) ?? urls.find((url) => !shopRegions(url)) ?? urls[0];
}

/** Find the link for this domain: product IDs are region-specific and cross-region links 404 */
function linkForDomain(urls: string[], domain: string): string | undefined {
  return urls.find((url) => withoutWww(new URL(url).hostname) === domain);
}

/**
 * Build the buy links for an album. Every store gets an entry, using a direct
 * link where we found one and that store's search page otherwise, so a data
 * source being down or missing an album costs direct links, not the whole page.
 */
export function buildStoreLinks({
  region,
  artist,
  album,
  musicBrainz,
  itunes,
  discogsUrl,
  storePages,
}: StoreLinkSources): PlatformLink[] {
  const links: PlatformLink[] = [];

  const query = encodeURIComponent(plainQuotes(`${artist} ${album}`));

  const addLink = (
    platform: string,
    displayName: string,
    category: PlatformLink['category'],
    directUrl: string | null | undefined,
    searchUrl: string
  ) => {
    links.push({
      platform,
      displayName,
      category,
      url: directUrl ?? searchUrl,
      ...(directUrl ? {} : { isSearch: true }),
    });
  };

  const amazonDomain = AMAZON_DOMAINS[region];
  const sevenDigitalDomain = SEVENDIGITAL_DOMAINS[region];
  const qobuzLocale = QOBUZ_LOCALES[region];
  const wobPath = WORLDOFBOOKS_PATHS[region] ?? '';
  const qobuzUrl = musicBrainz.qobuz
    ?? storePages.qobuz.find((url) => url.includes(`qobuz.com/${qobuzLocale}/`))
    ?? storePages.qobuz[0];

  // Digital downloads
  addLink(
    'bandcamp',
    'Bandcamp',
    'download',
    musicBrainz.bandcamp ?? storePages.bandcamp,
    `https://bandcamp.com/search?q=${query}&item_type=a`
  );
  addLink('itunes', 'iTunes', 'download', itunes?.url, `https://music.apple.com/${region.toLowerCase()}/search?term=${query}`);
  addLink(
    'amazonDigital',
    'Amazon Music',
    'download',
    linkForDomain(musicBrainz.amazonDigital, amazonDomain),
    `https://www.${amazonDomain}/s?k=${query}&i=digital-music`
  );
  addLink('hdtracks', 'HDtracks', 'download', musicBrainz.hdtracks, `https://www.hdtracks.com/#/search?q=${query}`);
  addLink(
    'sevendigital',
    '7digital',
    'download',
    linkForDomain(musicBrainz.sevendigital, sevenDigitalDomain),
    `https://${sevenDigitalDomain}/search?q=${query}`
  );
  addLink(
    'qobuz',
    'Qobuz',
    'download',
    // Unlike other stores' product IDs, Qobuz album IDs open in any locale. A locale's
    // own ID can be cheaper though (£12.09 vs £14.49), which is why it's preferred above.
    qobuzUrl?.replace(/qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?/, `qobuz.com/${qobuzLocale}/`),
    `https://www.qobuz.com/${qobuzLocale}/search/albums/${query}`
  );

  // Physical media
  addLink(
    'amazonPhysical',
    'Amazon',
    'physical',
    linkForDomain(musicBrainz.amazonPhysical, amazonDomain),
    `https://www.${amazonDomain}/s?k=${query}&i=popular`
  );
  addLink('discogs', 'Discogs', 'physical', discogsUrl, `https://www.discogs.com/search/?q=${query}&type=release`);
  addLink(
    'worldofbooks',
    'World of Books',
    'physical',
    storePages.worldOfBooks?.replace(/worldofbooks\.com\/(?:[a-z]{2}-[a-z]{2}\/)?/, `worldofbooks.com/${wobPath}`),
    // The search page reads the query from either parameter, and the Music category keeps books out
    `https://www.worldofbooks.com/${wobPath}search?q=${query}&shopify_products%5Bquery%5D=${query}${WORLDOFBOOKS_MUSIC}`
  );
  // musicMagpie only delivers within the UK
  if (region === 'GB') {
    addLink(
      'musicmagpie',
      'musicMagpie',
      'physical',
      storePages.musicMagpie,
      `https://www.musicmagpie.co.uk/store/category/?keyword=${query}`
    );
  }
  addLink('banquet', 'Banquet Records', 'physical', storePages.banquet, `https://www.banquetrecords.com/search?q=${query}`);

  // These two only appear when we found something, as there's no search page to fall back on
  const artistStore = shopForRegion(storePages.artistStore, region);
  if (artistStore) {
    links.push({ platform: 'artistStore', displayName: "Artist's store", category: 'physical', url: artistStore });
  } else if (storePages.officialSite) {
    links.push({ platform: 'officialSite', displayName: 'Official site', category: 'physical', url: storePages.officialSite });
  }

  // Sort by category first (download, then physical), then alphabetically within each category
  links.sort((a, b) => {
    if (a.category === b.category) {
      return a.displayName.localeCompare(b.displayName);
    }
    return a.category === 'download' ? -1 : 1;
  });

  return links;
}
