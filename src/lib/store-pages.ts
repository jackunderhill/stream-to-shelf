import { getDomain } from 'tldts';
import { Lookup } from '@/lib/lookup-cache';
import { EDITION_WORD, matchKey, nameKeys, normaliseBarcode, plainQuotes, stripEdition } from '@/lib/music-text';
import { searchSites, SiteResult } from '@/lib/tavily';

export const STORE_PAGE_TTL = 7 * 24 * 60 * 60; // 7 days: shorter than other lookups, as stock comes and goes

const BANDCAMP_DOMAIN = 'bandcamp.com';
const QOBUZ_DOMAIN = 'qobuz.com';
const BANQUET_DOMAIN = 'banquetrecords.com';
const MUSICMAGPIE_DOMAIN = 'musicmagpie.co.uk';
const WORLD_OF_BOOKS_DOMAIN = 'worldofbooks.com';

const MAX_ARTIST_SITES = 3;

// Homepages on these belong to the platform, so searching them wouldn't be limited to the artist
const SHARED_HOSTS = [
  'bandcamp.com', 'blogspot.com', 'carrd.co', 'facebook.com', 'instagram.com', 'linktr.ee', 'myspace.com',
  'soundcloud.com', 'spotify.com', 'squarespace.com', 'tiktok.com', 'tumblr.com', 'twitter.com', 'weebly.com',
  'wixsite.com', 'wordpress.com', 'x.com', 'youtube.com',
];

const NOT_THE_ARTIST = /\b(?:tribute|covers?|karaoke|lullab(?:y|ies)|reimagined|made famous|in the style of|originally performed)\b/i;

// Words that can sit alongside an edition word without making it a different album,
// unlike the "Mnesia" in "Kid A Mnesia (Deluxe Edition)"
const EDITION_DETAIL = /^(?:\d+(?:st|nd|rd|th)?|special|super|collector'?s?|version|limited|original|the|bonus|tracks?)$/i;

// A product must be the album in a physical format, so anything else in its name
// rules it out. Naming what's allowed is stricter than listing every kind of
// merch, and also rejects other albums like "Kid A Mnesia" when looking for "Kid A".
const FORMAT_WORD = /^(?:vinyl|lp|\d(?:x)?lp|cd|cassette|tape)$/i;
const COLOUR_WORD = /^(?:black|white|red|blue|green|pink|purple|yellow|orange|clear|gold|silver|grey|gray|transparent|translucent|marble|splatter|colou?red)$/i;
const PRODUCT_WORD = /^(?:\d+|album|standard|limited|exclusive|signed|autographed|edition|deluxe|indie|store|double|gatefold|heavyweight|180g|picture|disc)$/i;
const NUMBER = /^\d+$/;
const SPECIAL_PRODUCT = /signed|exclusive|limited/i;
const PRODUCT_VARIANT = /-\d+\/?$/; // Such as sorry-im-late-cassette-3

const JOINING_WORD = /^(?:&|and)$/i;
const BANDCAMP_ACCOUNT_AFFIXES = /^(?:official)|(?:official|band|music)$/g;

const PRODUCT_PATH = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/products?\/([^/]+)\/?$/i;
const QOBUZ_ALBUM_PATH = /^\/(?:[a-z]{2}-[a-z]{2}\/)?album\/([^/]+)\/[^/]+\/?$/;
const MUSICMAGPIE_PRODUCT_PATH = /^\/store\/products\/[^/]+\/?$/;
const SLUG_BARCODE = /-(\d{12,14})$/;

/** Pages for an album that were found by searching store websites */
export interface StorePages {
  bandcamp?: string;
  /** Best first. An album can have a different ID in each locale. */
  qobuz: string[];
  banquet?: string;
  musicMagpie?: string;
  worldOfBooks?: string;
  /** Best first. Artists often run a separate shop for each region. */
  artistStore: string[];
  /** The artist's own website, when we found no product on it */
  officialSite?: string;
}

interface StorePageRequest {
  /** Everyone the album is credited to. Stores can list a collaboration under any of them. */
  artists: string[];
  album: string;
  /** The artist's homepages from MusicBrainz */
  homepages: string[];
  /** The hostnames of Bandcamp accounts that MusicBrainz says are the artist's */
  bandcampAccounts: string[];
  /** Barcodes of the album's physical releases */
  barcodes: string[];
  /** Stores that we already have a link for, which would waste a credit */
  hasBandcamp: boolean;
  hasQobuz: boolean;
  /** Who's asking, as each visitor gets a limited share of the day's searches */
  visitor?: string;
}

/** Where to look for the artist's own shop */
interface ArtistSites {
  /** Their own website, which can be trusted to only sell their records */
  official?: { url: string; domain: string };
  /** Sites with a page about them, usually their label, which also sell other artists' records */
  labels: string[];
}

/** What pages are judged against */
interface AlbumDetails {
  title: string;
  artistKeys: string[];
  titleKeys: string[];
  barcodes: Set<string>;
  bandcampAccounts: Set<string>;
  sites: ArtistSites;
}

type Match = 'exact' | 'edition' | null;
type PageMatcher = (url: URL, album: AlbumDetails, title: string) => Match;

export const emptyStorePages = (): StorePages => ({ qobuz: [], artistStore: [] });

export const withoutWww = (hostname: string) => hostname.replace(/^www\./, '');

const isOnDomain = (hostname: string, domain: string) => hostname === domain || hostname.endsWith(`.${domain}`);

/** Parse a web address from outside. Other schemes get as far as links, so they stop here. */
function parseWebUrl(text: string): URL | null {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

const toWords = (text: string) => decode(text).split(/[^\p{L}\p{N}&'’]+/u).filter((word) => /[\p{L}\p{N}&]/u.test(word));

/** The words after `target` at the start of `words`, however each spaces and punctuates it */
function wordsAfter(words: string[], target: string): string[] | null {
  let key = '';
  for (const [index, word] of words.entries()) {
    key += matchKey(word);
    if (key === target) return words.slice(index + 1);
    if (!target.startsWith(key)) return null;
  }
  return null;
}

function wordsAfterAny(words: string[], targets: string[]): string[] | null {
  for (const target of targets) {
    const rest = wordsAfter(words, target);
    if (rest) return rest;
  }
  return null;
}

/** The words after one credited artist at the start of `words`, and any "&" joining them to another */
function wordsAfterArtist(words: string[], album: AlbumDetails): string[] | null {
  const rest = wordsAfterAny(words, album.artistKeys);
  if (!rest) return null;

  // An "and" is only a join if an artist follows: Metallica's next word might be "...And Justice for All"
  const isJoin = rest[0] && JOINING_WORD.test(rest[0]) && wordsAfterAny(rest.slice(1), album.artistKeys);
  return isJoin ? rest.slice(1) : rest;
}

/** Remove every credited artist, wherever they are, reporting whether there were any */
function withoutArtists(words: string[], album: AlbumDetails): { rest: string[]; hasArtist: boolean } {
  const rest: string[] = [];
  let hasArtist = false;

  for (let index = 0; index < words.length;) {
    const after = wordsAfterArtist(words.slice(index), album);
    if (after) {
      hasArtist = true;
      index = words.length - after.length;
    } else {
      rest.push(words[index++]);
    }
  }

  return { rest, hasArtist };
}

/**
 * The words after the album's name, which may come after its artists. The name
 * is tried first, as on a self-titled album it would otherwise be taken for the artist.
 */
function wordsAfterName(words: string[], album: AlbumDetails): string[] | null {
  let remaining: string[] | null = words;
  while (remaining) {
    const rest = wordsAfterAny(remaining, album.titleKeys);
    if (rest) return rest;
    remaining = wordsAfterArtist(remaining, album);
  }
  return null;
}

/**
 * What a store's title says beyond the album's name and the store's own name.
 * Null unless it has both the album and one of its artists, whichever comes first.
 */
function creditedTitleDetails(allWords: string[], album: AlbumDetails, storeName: string): string[] | null {
  const words = allWords.filter((word) => word.toLowerCase() !== storeName);
  const afterName = wordsAfterName(words, album);
  if (!afterName) return null;

  const { rest, hasArtist } = withoutArtists(afterName, album);
  return hasArtist || wordsAfterArtist(words, album) ? rest : null;
}

/** Judge what follows the album's name: an edition is fine, a longer title is another album */
function matchRemainder(rest: string[] | null): Match {
  if (!rest) return null;
  if (rest.length === 0) return 'exact';

  const isEdition = rest.some((word) => EDITION_WORD.test(word))
    && rest.every((word) => EDITION_WORD.test(word) || EDITION_DETAIL.test(word));
  return isEdition ? 'edition' : null;
}

/** Check that what follows an album's name only describes a pressing, and doesn't make it another title */
function isProductDescription(words: string[]): boolean {
  // "Greatest Hits 2" is a different album to "Greatest Hits"
  if (words[0] && NUMBER.test(words[0])) return false;

  return words.every((word, index) => {
    // As is Weezer's "Green Album"
    if (word.toLowerCase() === 'album' && index > 0 && COLOUR_WORD.test(words[index - 1])) return false;
    return FORMAT_WORD.test(word) || PRODUCT_WORD.test(word) || COLOUR_WORD.test(word);
  });
}

/**
 * Check whether this Bandcamp account is the artist's. Anyone can upload to
 * Bandcamp under any name and credit, so a page's title proves nothing: "Watch the
 * Throne (deluxe) | Jay-Z and Kanye West | Nathaniel Ozuski" is laid out just like
 * a label's page. Only the account shows whose it is, so it has to be the artist's
 * name, or one that MusicBrainz lists. Part of a name isn't enough: "can" is in
 * "scandal". Albums on a label's account fall back to a search link.
 */
function isArtistAccount(hostname: string, album: AlbumDetails): boolean {
  if (album.bandcampAccounts.has(hostname)) return true;

  const account = matchKey(hostname.split('.')[0]);
  return album.artistKeys.includes(account) || album.artistKeys.includes(account.replace(BANDCAMP_ACCOUNT_AFFIXES, ''));
}

const matchBandcampPage: PageMatcher = (url, album) => {
  const slug = url.pathname.match(/^\/album\/([^/]+)\/?$/)?.[1];
  if (!slug || !url.hostname.endsWith(`.${BANDCAMP_DOMAIN}`) || !isArtistAccount(url.hostname, album)) return null;

  return matchRemainder(wordsAfterAny(toWords(slug), album.titleKeys));
};

/** Qobuz gives an album and its bonus disc the same slug, so only the title can tell them apart */
const matchQobuzPage: PageMatcher = (url, album, title) => {
  const slug = url.pathname.match(QOBUZ_ALBUM_PATH)?.[1];
  if (url.hostname !== `www.${QOBUZ_DOMAIN}` || !slug || !wordsAfterAny(toWords(slug), album.titleKeys)) return null;

  return matchRemainder(creditedTitleDetails(toWords(title), album, 'qobuz'));
};

const matchBanquetPage: PageMatcher = (url, album) => {
  const [artist, title, catalogNumber, ...extra] = url.pathname.split('/').filter(Boolean);
  if (withoutWww(url.hostname) !== BANQUET_DOMAIN || !catalogNumber || extra.length > 0) return null;

  // Collaborations are filed under all their artists, as in /apollo-brown-&-skyzoo/
  const { rest, hasArtist } = withoutArtists(toWords(artist), album);
  if (!hasArtist || rest.length > 0) return null;

  return matchRemainder(wordsAfterAny(toWords(title), album.titleKeys));
};

/** Titles look like "Radiohead - Kid A CD / Album - musicMagpie Store" or "Kid A - Radiohead - musicMagpie Store" */
const matchMusicMagpiePage: PageMatcher = (url, album, title) => {
  if (withoutWww(url.hostname) !== MUSICMAGPIE_DOMAIN || !MUSICMAGPIE_PRODUCT_PATH.test(url.pathname)) return null;

  const details = creditedTitleDetails(toWords(title), album, 'musicmagpie');
  return details && isProductDescription(details) ? 'exact' : null;
};

/**
 * World of Books' titles often leave out the artist, but its URLs end in the
 * barcode, as in /products/blue-rev-cd-5400863087845. That proves which release
 * it is if the barcode is one of the album's, without relying on names at all.
 */
const matchWorldOfBooksPage: PageMatcher = (url, album) => {
  const slug = url.pathname.match(PRODUCT_PATH)?.[1];
  const barcode = slug?.match(SLUG_BARCODE)?.[1];
  if (withoutWww(url.hostname) !== WORLD_OF_BOOKS_DOMAIN || !slug || !barcode) return null;
  if (!album.barcodes.has(normaliseBarcode(barcode))) return null;

  // Just a format and the barcode after the name means the standard album, not a box set
  return wordsAfterAny(toWords(slug), album.titleKeys)?.length === 2 ? 'exact' : 'edition';
};

const matchProductPage: PageMatcher = (url, album, title) => {
  const slug = url.pathname.match(PRODUCT_PATH)?.[1];
  const { official, labels } = album.sites;
  const isOfficial = official && isOnDomain(url.hostname, official.domain);
  if (!slug || (!isOfficial && !labels.some((domain) => isOnDomain(url.hostname, domain)))) return null;

  const words = toWords(slug);
  // Labels sell many artists' records, so their products have to say whose they are
  if (!isOfficial && !wordsAfterArtist(words, album)) return null;

  const rest = wordsAfterName(words, album);
  if (!rest) return null;

  // Some URLs are just the album's name, as in /sufjan-stevens-carrie-lowell, leaving the title to give the format
  if (rest.length === 0) return toWords(title).some((word) => FORMAT_WORD.test(word)) ? 'exact' : null;

  return rest.some((word) => FORMAT_WORD.test(word)) && isProductDescription(rest) ? 'exact' : null;
};

/** The URLs of the best matches, keeping the search's order. Editions are only used if there's nothing better. */
function bestUrls(results: SiteResult[], album: AlbumDetails, matchPage: PageMatcher): string[] {
  const urls: Record<'exact' | 'edition', Set<string>> = { exact: new Set(), edition: new Set() };

  for (const { title, url: resultUrl } of results) {
    if (NOT_THE_ARTIST.test(title) && !NOT_THE_ARTIST.test(album.title)) continue;

    const url = parseWebUrl(resultUrl);
    if (!url) continue;

    const match = matchPage(url, album, title);
    if (!match) continue;

    // Search results carry tracking, such as Bandcamp's ?from=discover_page
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    urls[match].add(url.toString());
  }

  return [...(urls.exact.size > 0 ? urls.exact : urls.edition)];
}

/**
 * Sort the artist's homepages. Label pages sit at a path below the label's own
 * homepage, such as sonymusic.co.uk/artist/wolf-alice, while their own site is at
 * a root URL. MusicBrainz is community edited, so only accept real sites: a search
 * of "com" would be the open web, and we only ever search chosen domains.
 */
function findArtistSites(homepages: string[]): ArtistSites {
  const sites: ArtistSites = { labels: [] };

  for (const homepage of homepages) {
    const url = parseWebUrl(homepage);
    const domain = url ? withoutWww(url.hostname) : '';
    if (!url || !getDomain(domain) || SHARED_HOSTS.some((host) => isOnDomain(domain, host))) continue;

    if (url.pathname !== '/') sites.labels.push(domain);
    else sites.official ??= { url: homepage, domain };
  }

  return sites;
}

/** Prefer the standard pressing over a signed copy, or one of several numbered variants */
function productRank(url: string): number {
  return (SPECIAL_PRODUCT.test(url) ? 2 : 0) + (PRODUCT_VARIANT.test(url) ? 1 : 0) - (/standard/i.test(url) ? 1 : 0);
}

/**
 * Find an album's pages on stores with no API, searching only those stores and
 * the artist's own website. Search results are often for other people's albums
 * with the same name, so nothing is used unless it matches strictly here.
 */
export async function findStorePages({
  artists,
  album,
  homepages,
  bandcampAccounts,
  barcodes,
  hasBandcamp,
  hasQobuz,
  visitor,
}: StorePageRequest): Promise<Lookup<StorePages>> {
  const title = stripEdition(album);
  const sites = findArtistSites(homepages);
  const { official } = sites;
  const details: AlbumDetails = {
    title,
    artistKeys: [...new Set(artists.flatMap(nameKeys))],
    titleKeys: nameKeys(title),
    barcodes: new Set(barcodes.map(normaliseBarcode)),
    bandcampAccounts: new Set(bandcampAccounts),
    sites,
  };

  const siteDomains = [...(official ? [official.domain] : []), ...sites.labels].slice(0, MAX_ARTIST_SITES);

  // Banquet needs a search of its own, as it would take nearly every result of a shared one
  const searches = [
    ...(hasBandcamp ? [] : [[BANDCAMP_DOMAIN]]),
    ...(hasQobuz ? [] : [[QOBUZ_DOMAIN]]),
    [BANQUET_DOMAIN],
    [MUSICMAGPIE_DOMAIN, WORLD_OF_BOOKS_DOMAIN],
    ...(siteDomains.length > 0 ? [siteDomains] : []),
  ];

  const replies = await searchSites(plainQuotes(`${artists.join(' ')} ${title}`), searches, visitor);
  if (!replies) return { value: emptyStorePages(), complete: false };

  const resultsFor = (domain: string | undefined) =>
    (domain ? replies[searches.findIndex((search) => search.includes(domain))] : null) ?? [];

  const artistStore = bestUrls(resultsFor(siteDomains[0]), details, matchProductPage)
    .sort((a, b) => productRank(a) - productRank(b));

  // A site with no pages in the index may well be gone, and old domains get taken over
  const siteIsIndexed = official !== undefined && resultsFor(official.domain).some(({ url }) => {
    const parsed = parseWebUrl(url);
    return parsed !== null && isOnDomain(parsed.hostname, official.domain);
  });

  return {
    value: {
      bandcamp: bestUrls(resultsFor(BANDCAMP_DOMAIN), details, matchBandcampPage)[0],
      qobuz: bestUrls(resultsFor(QOBUZ_DOMAIN), details, matchQobuzPage),
      banquet: bestUrls(resultsFor(BANQUET_DOMAIN), details, matchBanquetPage)[0],
      musicMagpie: bestUrls(resultsFor(MUSICMAGPIE_DOMAIN), details, matchMusicMagpiePage)[0],
      worldOfBooks: bestUrls(resultsFor(WORLD_OF_BOOKS_DOMAIN), details, matchWorldOfBooksPage)[0],
      artistStore,
      officialSite: siteIsIndexed ? official?.url : undefined,
    },
    complete: replies.every((reply) => reply !== null),
  };
}
