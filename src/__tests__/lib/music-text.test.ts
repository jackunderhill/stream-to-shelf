import { albumKey, getFirstArtist, isSameArtist, matchKey, plainQuotes, stripEdition } from '@/lib/music-text';

describe('matchKey', () => {
  it('should ignore case, punctuation and spacing', () => {
    expect(matchKey('Fontaines D.C.')).toBe(matchKey('fontaines dc'));
  });

  it('should treat curly and straight apostrophes the same', () => {
    expect(matchKey('Sorry I’m Late')).toBe(matchKey("Sorry I'm Late"));
  });

  it('should ignore accents', () => {
    expect(matchKey('Björk')).toBe(matchKey('Bjork'));
  });

  it('should treat & and "and" the same', () => {
    expect(matchKey('Simon & Garfunkel')).toBe(matchKey('Simon and Garfunkel'));
  });

  it('should keep non-Latin text distinct', () => {
    expect(matchKey('坂本龍一')).not.toBe(matchKey('別のアルバム'));
    expect(matchKey('坂本龍一')).not.toBe('');
  });

  it('should keep names made only of symbols distinct', () => {
    expect(matchKey('!!!')).toBe('!!!');
    expect(matchKey('†††')).not.toBe(matchKey('!!!'));
  });
});

describe('stripEdition', () => {
  it.each([
    ['Blue Rev (Deluxe Edition)', 'Blue Rev'],
    ['Blue Rev [Deluxe]', 'Blue Rev'],
    ['Blue Rev - Deluxe Edition', 'Blue Rev'],
    ['Blue Rev (2023 Remaster)', 'Blue Rev'],
    ['Blue Rev (Explicit)', 'Blue Rev'],
  ])('should strip the edition from %s', (title, expected) => {
    expect(stripEdition(title)).toBe(expected);
  });

  it.each([
    'Blue Rev',
    'Sorry I’m Late… Again',
    'Tomb Raider (Part 1)',
    'Love - Hate',
  ])('should leave %s alone', (title) => {
    expect(stripEdition(title)).toBe(title);
  });
});

describe('albumKey', () => {
  it('should match different editions of an album', () => {
    expect(albumKey('Blue Rev (Deluxe Edition)')).toBe(albumKey('Blue Rev'));
  });

  it('should keep different volumes of an album apart', () => {
    expect(albumKey('Album (Part 1)')).not.toBe(albumKey('Album (Part 2)'));
  });

  it('should keep a sequel apart from the original', () => {
    expect(albumKey('Sorry I’m Late… Again')).not.toBe(albumKey('Sorry I’m Late'));
  });
});

describe('plainQuotes', () => {
  it('should replace curly quotes', () => {
    expect(plainQuotes('Sorry I’m “Late”')).toBe('Sorry I\'m "Late"');
  });
});

describe('getFirstArtist', () => {
  it.each([
    ['Artist1, Artist2', 'Artist1'],
    ['Artist1 & Artist2', 'Artist1'],
    ['Artist1 feat. Artist2', 'Artist1'],
    ['Artist1', 'Artist1'],
  ])('should reduce %s to the first artist', (artists, expected) => {
    expect(getFirstArtist(artists)).toBe(expected);
  });
});

describe('isSameArtist', () => {
  it('should match despite punctuation', () => {
    expect(isSameArtist('Fontaines D.C.', 'Fontaines DC')).toBe(true);
  });

  it('should match the first of several requested artists', () => {
    expect(isSameArtist('Trent Reznor', 'Trent Reznor, Atticus Ross')).toBe(true);
  });

  it('should match duos credited with & or and', () => {
    expect(isSameArtist('Trent Reznor & Atticus Ross', 'Trent Reznor and Atticus Ross')).toBe(true);
  });

  it('should not match a partial name', () => {
    expect(isSameArtist('The Band', 'The Band Perry')).toBe(false);
  });
});
