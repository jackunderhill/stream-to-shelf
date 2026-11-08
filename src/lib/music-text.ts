// Not "version": Red (Taylor's Version) and Unplugged (Live Version) are different recordings
const EDITION_WORDS = 'deluxe|edition|remaster|remastered|expanded|anniversary|bonus|explicit|clean';
const BRACKETED_EDITION = new RegExp(`\\s*[(\\[][^)\\]]*\\b(?:${EDITION_WORDS})\\b[^)\\]]*[)\\]]\\s*$`, 'i');
const DASHED_EDITION = new RegExp(`\\s+-\\s+[^-]*\\b(?:${EDITION_WORDS})\\b[^-]*$`, 'i');

/** Matches a single word that marks an edition of an album */
export const EDITION_WORD = new RegExp(`^(?:${EDITION_WORDS})$`, 'i');

/**
 * Reduce text to a comparison key, ignoring case, accents and punctuation.
 * e.g. "Fontaines D.C." and "Fontaines DC" share a key, as do "I’m" and "I'm".
 * Keeps all scripts, and falls back to the raw text for names made only of
 * symbols (e.g. "!!!") so that they don't collapse to an empty key.
 */
export function matchKey(text: string): string {
  const key = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]/gu, '');

  return key || text.trim().toLowerCase();
}

/**
 * Remove a trailing edition marker from an album title
 * e.g. "Blue Rev (Deluxe Edition)" -> "Blue Rev"
 */
export function stripEdition(title: string): string {
  return title.replace(BRACKETED_EDITION, '').replace(DASHED_EDITION, '').trim();
}

/** Comparison key for an album title, ignoring edition markers */
export function albumKey(title: string): string {
  return matchKey(stripEdition(title));
}

/** Every comparison key for a name. Stores turn "&" into either "and" or nothing, so there can be two. */
export function nameKeys(name: string): string[] {
  return [...new Set([matchKey(name), matchKey(name.replace(/&/g, ' '))])];
}

/** Barcodes are stored with varying zero padding */
export function normaliseBarcode(barcode: string): string {
  return barcode.replace(/^0+/, '');
}

/** Replace curly quotes, which many stores' search boxes treat as different characters */
export function plainQuotes(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/**
 * Extract the first artist from a string that may contain multiple artists
 * e.g. "Artist1, Artist2" -> "Artist1"
 */
export function getFirstArtist(artistName: string): string {
  // Common separators for multiple artists
  const separators = [', ', ' & ', ' and ', ' feat. ', ' ft. ', ' featuring ', ' with '];

  let firstArtist = artistName;
  for (const separator of separators) {
    const parts = firstArtist.split(separator);
    if (parts.length > 1) {
      firstArtist = parts[0];
    }
  }

  return firstArtist.trim();
}

/** Check a catalog's artist name against the requested one, which may list several artists */
export function isSameArtist(candidate: string, requested: string): boolean {
  const candidateKey = matchKey(candidate);
  return candidateKey === matchKey(requested) || candidateKey === matchKey(getFirstArtist(requested));
}

/** Find the item by this artist. The whole name comes first, as "Belle" isn't Belle and Sebastian. */
export function findByArtist<T>(items: T[], artist: string, artistOf: (item: T) => string | undefined): T | undefined {
  return items.find((item) => matchKey(artistOf(item) ?? '') === matchKey(artist))
    ?? items.find((item) => isSameArtist(artistOf(item) ?? '', artist));
}
