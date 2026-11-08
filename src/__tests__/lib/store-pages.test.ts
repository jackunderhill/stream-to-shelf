/**
 * @jest-environment node
 */

import { findStorePages } from '@/lib/store-pages';
import { searchSites, SiteResult } from '@/lib/tavily';

jest.mock('@/lib/tavily', () => ({ searchSites: jest.fn() }));

type Results = Record<string, SiteResult[]>;

const page = (title: string, url: string): SiteResult => ({ title, url });

/** Look up an album, replying to each domain's search from `results`. Titles and URLs here are from real searches. */
async function find(artist: string, album: string, results: Results, homepages: string[] = [], barcodes: string[] = []) {
  (searchSites as jest.Mock).mockImplementation(async (_query: string, searches: string[][]) =>
    searches.map((domains) => domains.flatMap((domain) => results[domain] ?? []))
  );
  const { value } = await findStorePages({ artists: [artist], album, homepages, bandcampAccounts: [], barcodes, hasBandcamp: false, hasQobuz: false });
  return value;
}

describe('findStorePages', () => {
  describe('Bandcamp', () => {
    const bandcamp = async (artist: string, album: string, results: SiteResult[]) =>
      (await find(artist, album, { 'bandcamp.com': results })).bandcamp;

    it('should find the album whichever way round the title is written', async () => {
      const url = 'https://sleafordmods.bandcamp.com/album/english-tapas';

      expect(await bandcamp('Sleaford Mods', 'English Tapas', [page('English Tapas - Sleaford Mods - Bandcamp', url)])).toBe(url);
      expect(await bandcamp('Sleaford Mods', 'English Tapas', [page('English Tapas | Sleaford Mods', url)])).toBe(url);
    });

    it('should accept an artist named only in the subdomain', async () => {
      const url = 'https://alvvays.bandcamp.com/album/blue-rev';

      expect(await bandcamp('Alvvays', 'Blue Rev', [page('We care about your privacy', url)])).toBe(url);
    });

    it('should match titles with an ampersand, which slugs drop', async () => {
      const url = 'https://sufjanstevens.bandcamp.com/album/carrie-lowell';

      expect(await bandcamp('Sufjan Stevens', 'Carrie & Lowell', [page('Carrie & Lowell - Sufjan Stevens', url)])).toBe(url);
    });

    it('should reject an album with the same name by someone else', async () => {
      const results = [page("Sorry I'm Late | Minos | Don't Be Afraid", 'https://dontbeafraid.bandcamp.com/album/sorry-im-late')];

      expect(await bandcamp('Mae Muller', "Sorry I'm Late", results)).toBeUndefined();
    });

    it('should accept an edition if that is all there is', async () => {
      const url = 'https://sufjanstevens.bandcamp.com/album/carrie-lowell-10th-anniversary-edition';

      expect(await bandcamp('Sufjan Stevens', 'Carrie & Lowell', [page('Carrie & Lowell (10th Anniversary Edition) - Sufjan Stevens', url)])).toBe(url);
    });

    it('should not take extra words beside an edition marker for the same album', async () => {
      const results = [page('KID A MNESIA (Deluxe Edition) | Radiohead', 'https://radiohead.bandcamp.com/album/kid-a-mnesia-deluxe-edition')];

      expect(await bandcamp('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it.each([
      ['X', 'Los Angeles', 'alexsmith'],
      ['Can', 'Future Days', 'scandal'],
      ['Low', 'Ones and Sixes', 'yellowjackets'],
      ['Adele', '21', 'adelefans'],
      ['Radiohead', 'Kid A', 'radioheadbootlegs'],
    ])('should not take an account containing the name %s for the artist', async (artist, album, account) => {
      const url = `https://${account}.bandcamp.com/album/${album.toLowerCase().replace(/ /g, '-')}`;

      expect(await bandcamp(artist, album, [page(`${album} | ${artist}`, url)])).toBeUndefined();
    });

    it.each([['officialmichaelkiwanuka'], ['michaelkiwanukamusic'], ['michaelkiwanukaband']])('should accept the account %s', async (account) => {
      const url = `https://${account}.bandcamp.com/album/fudge`;

      expect(await bandcamp('Michael Kiwanuka', 'FUDGE', [page('FUDGE', url)])).toBe(url);
    });

    it('should accept an account that MusicBrainz lists for the artist', async () => {
      const url = 'https://bmblackmidi.bandcamp.com/album/schlagenheim';
      (searchSites as jest.Mock).mockResolvedValue([[page('Schlagenheim - black midi', url)], [], [], []]);

      const { value } = await findStorePages({
        artists: ['black midi'], album: 'Schlagenheim', homepages: [], bandcampAccounts: ['bmblackmidi.bandcamp.com'], barcodes: [], hasBandcamp: false, hasQobuz: false,
      });

      expect(value.bandcamp).toBe(url);
    });

    it('should not pass on other schemes', async () => {
      const results = [page('Kid A | Radiohead', 'javascript://radiohead.bandcamp.com/album/kid-a?%0aalert(1)')];

      expect(await bandcamp('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should only accept pages on Bandcamp itself', async () => {
      const results = [page('Kid A | Radiohead', 'https://radiohead.example.com/album/kid-a')];

      expect(await bandcamp('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should clean up the addresses that search results give', async () => {
      const results = [page('Kid A | Radiohead', 'http://radiohead.bandcamp.com/album/kid-a?from=discover_page#buy')];

      expect(await bandcamp('Radiohead', 'Kid A', results)).toBe('https://radiohead.bandcamp.com/album/kid-a');
    });

    it('should cope with an address that has a stray percent sign', async () => {
      const results = [page('Kid A | Radiohead', 'https://radiohead.bandcamp.com/album/100%-kid-a')];

      expect(await bandcamp('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should reject an upload that credits the artist but is on someone else\'s account', async () => {
      const results = [
        page('Watch the Throne (deluxe) | Jay-Z and Kanye West', 'https://nathanielozuski.bandcamp.com/album/watch-the-throne-deluxe?action=buy'),
        page('Watch the Throne (deluxe) | Jay-Z and Kanye West | Nathaniel Ozuski', 'https://nathanielozuski.bandcamp.com/album/watch-the-throne-deluxe'),
      ];

      expect((await find('Kanye West', 'Watch the Throne', { 'bandcamp.com': results })).bandcamp).toBeUndefined();
    });

    it('should prefer the album over its editions', async () => {
      const results = [
        page('Carrie & Lowell (10th Anniversary Edition) - Sufjan Stevens', 'https://sufjanstevens.bandcamp.com/album/carrie-lowell-10th-anniversary-edition'),
        page('Carrie & Lowell - Sufjan Stevens', 'https://sufjanstevens.bandcamp.com/album/carrie-lowell'),
      ];

      expect(await bandcamp('Sufjan Stevens', 'Carrie & Lowell', results)).toBe('https://sufjanstevens.bandcamp.com/album/carrie-lowell');
    });

    it('should not mistake a longer title for the album', async () => {
      const results = [page('KID A MNESIA | Radiohead', 'https://radiohead.bandcamp.com/album/kid-a-mnesia')];

      expect(await bandcamp('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should only accept album pages', async () => {
      const results = [
        page('Run Away From the Mob | Queens of the Stone Age', 'https://qotsa.bandcamp.com/track/run-away-from-the-mob'),
        page('Run Away From the Mob', 'https://qotsa.bandcamp.com/merch/run-away-from-the-mob'),
        page('Queens of the Stone Age: Run Away From the Mob', 'https://daily.bandcamp.com/features/run-away-from-the-mob'),
      ];

      expect(await bandcamp('Queens of the Stone Age', 'Run Away From the Mob', results)).toBeUndefined();
    });

    it('should reject tributes and covers', async () => {
      const results = [
        page('Souvlaki - A Slowdive Tribute', 'https://shoegazefans.bandcamp.com/album/souvlaki'),
        page('Souvlaki (Slowdive Covers) | Someone', 'https://someone.bandcamp.com/album/souvlaki'),
        page('N64 Radiohead - Kid A on Nintendo 64 | Sunset Hotline Mode7', 'https://malibumode7.bandcamp.com/album/n64-radiohead-kid-a-on-nintendo-64'),
      ];

      expect(await bandcamp('Slowdive', 'Souvlaki', results)).toBeUndefined();
      expect(await bandcamp('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should reject them from stores that match on the URL alone', async () => {
      const results = [page('Souvlaki - A Tribute to Slowdive', 'https://www.banquetrecords.com/slowdive/souvlaki/X1')];

      expect((await find('Slowdive', 'Souvlaki', { 'banquetrecords.com': results })).banquet).toBeUndefined();
    });

    it('should allow those words in the album name itself', async () => {
      const url = 'https://catpower.bandcamp.com/album/covers';

      expect(await bandcamp('Cat Power', 'Covers', [page('Covers | Cat Power', url)])).toBe(url);
    });

    it('should remove tracking from the link', async () => {
      const results = [page('FUDGE | Michael Kiwanuka', 'https://officialmichaelkiwanuka.bandcamp.com/album/fudge?from=discover_page&ui_context=results_grid')];

      expect(await bandcamp('Michael Kiwanuka', 'FUDGE', results)).toBe('https://officialmichaelkiwanuka.bandcamp.com/album/fudge');
    });
  });

  describe('Qobuz', () => {
    const qobuz = async (artist: string, album: string, results: SiteResult[]) =>
      (await find(artist, album, { 'qobuz.com': results })).qobuz;

    it('should accept each title format that Qobuz uses', async () => {
      const titles = ['Romance, FONTAINES D.C.', 'FONTAINES DC|Romance', 'Fontaines D.C. Romance - Qobuz', 'Romance, FONTAINES D.C. - Qobuz'];

      for (const title of titles) {
        const url = 'https://www.qobuz.com/us-en/album/romance-fontaines-dc/uyd7u6792hk6a';
        expect(await qobuz('Fontaines D.C.', 'Romance', [page(title, url)])).toEqual([url]);
      }
    });

    it('should keep editions credited to the artist', async () => {
      const url = 'https://www.qobuz.com/au-en/album/romance-fontaines-dc/bqha2n4wkxe5a';

      expect(await qobuz('Fontaines D.C.', 'Romance', [page('Romance (Deluxe Edition), FONTAINES D.C. - Qobuz', url)])).toEqual([url]);
    });

    it('should not find an artist inside other words', async () => {
      const results = [page('Los Angeles (Deluxe Edition), Somebody Else - Qobuz', 'https://www.qobuz.com/us-en/album/los-angeles-somebody-else/abc')];

      expect(await qobuz('X', 'Los Angeles', results)).toEqual([]);
    });

    it('should reject an artist whose name starts the same way', async () => {
      const results = [page('Greatest Hits (Deluxe Edition), Queensrÿche - Qobuz', 'https://www.qobuz.com/us-en/album/greatest-hits-queensryche/abc')];

      expect(await qobuz('Queen', 'Greatest Hits', results)).toEqual([]);
    });

    it('should not mistake another recording for a version of the album', async () => {
      const original = 'https://www.qobuz.com/us-en/album/red-taylor-swift/original';
      const rerecorded = 'https://www.qobuz.com/us-en/album/red-taylor-swift/rerecorded';
      const results = [page('Red, Taylor Swift - Qobuz', original), page("Red (Taylor's Version), Taylor Swift - Qobuz", rerecorded)];

      expect(await qobuz('Taylor Swift', "Red (Taylor's Version)", results)).toEqual([]);
      expect(await qobuz('Taylor Swift', 'Red', results)).toEqual([original]);
    });

    it('should reject an album with the same name by someone else', async () => {
      const results = [
        page('Romance, Camila Cabello - Qobuz', 'https://www.qobuz.com/us-en/album/romance-camila-cabello/abc123'),
        page('Romance (Deluxe Edition), Camila Cabello - Qobuz', 'https://www.qobuz.com/us-en/album/romance-camila-cabello/def456'),
      ];

      expect(await qobuz('Fontaines D.C.', 'Romance', results)).toEqual([]);
    });

    it('should tell an album from a release with the same slug', async () => {
      const results = [
        page('The Clearing (B Sides), Wolf Alice - Qobuz', 'https://www.qobuz.com/us-en/album/the-clearing-wolf-alice/ztuvxqvlg2rwn'),
        page('The Clearing, Wolf Alice - Qobuz', 'https://www.qobuz.com/us-en/album/the-clearing-wolf-alice/ic8whok9ukfha'),
      ];

      expect(await qobuz('Wolf Alice', 'The Clearing', results)).toEqual([
        'https://www.qobuz.com/us-en/album/the-clearing-wolf-alice/ic8whok9ukfha',
      ]);
    });

    it('should prefer the album over its editions in every locale', async () => {
      const results = [
        page('FONTAINES DC|Romance (Deluxe Edition)', 'https://www.qobuz.com/au-en/album/romance-fontaines-dc/bqha2n4wkxe5a'),
        page('Romance, FONTAINES D.C.', 'https://www.qobuz.com/us-en/album/romance-fontaines-dc/uyd7u6792hk6a'),
      ];

      expect(await qobuz('Fontaines D.C.', 'Romance', results)).toEqual([
        'https://www.qobuz.com/us-en/album/romance-fontaines-dc/uyd7u6792hk6a',
      ]);
    });

    it('should reject live albums, box sets and pages that are not albums', async () => {
      const results = [
        page('Sufjan Stevens|Carrie & Lowell Live (Live)', 'https://www.qobuz.com/se-en/album/carrie-lowell-live-sufjan-stevens/0656605613666'),
        page('Outtakes, Remixes & Demos From Carrie & Lowell, Sufjan Stevens', 'https://www.qobuz.com/se-en/album/the-greatest-gift-mixtape-outtakes-remixes-demos-from-carrie-lowell-sufjan-stevens/0656605613864'),
        page('Carrie & Lowell, Sufjan Stevens', 'https://www.qobuz.com/us-en/magazine/story/2015/carrie-lowell'),
      ];

      expect(await qobuz('Sufjan Stevens', 'Carrie & Lowell', results)).toEqual([]);
    });

    it('should skip URLs without the album in them', async () => {
      const results = [page('TANGK, IDLES - Qobuz', 'https://www.qobuz.com/fr-fr/album/artist/fbovm9up0gskc')];

      expect(await qobuz('IDLES', 'TANGK', results)).toEqual([]);
    });

    it('should only link to the main Qobuz site', async () => {
      const results = [page('TANGK, IDLES', 'https://open.qobuz.com/album/tangk-idles/gg2zaiqw0lmba')];

      expect(await qobuz('IDLES', 'TANGK', results)).toEqual([]);
    });
  });

  describe('Banquet Records', () => {
    const banquet = async (artist: string, album: string, results: SiteResult[]) =>
      (await find(artist, album, { 'banquetrecords.com': results })).banquet;

    it('should match encoded URLs', async () => {
      const url = 'https://www.banquetrecords.com/sufjan-stevens/carrie-%26-lowell/AKR099';

      expect(await banquet('Sufjan Stevens', 'Carrie & Lowell', [page('Sufjan Stevens - Carrie & Lowell', url)])).toBe(url);
    });

    it('should match an artist with punctuation in their name', async () => {
      const url = 'https://www.banquetrecords.com/fontaines-d.c./romance/XL1436CD';

      expect(await banquet('Fontaines D.C.', 'Romance', [page('Fontaines D.C. - Romance | Banquet Records', url)])).toBe(url);
    });

    it('should prefer the standard release over a signed one', async () => {
      const results = [
        page('Wolf Alice - The Clearing [personally signed]', 'https://www.banquetrecords.com/wolf-alice/the-clearing-%5Bpersonally-signed%5D/19802909852PS'),
        page('Wolf Alice - The Clearing', 'https://www.banquetrecords.com/wolf-alice/the-clearing/19802909852'),
      ];

      expect(await banquet('Wolf Alice', 'The Clearing', results)).toBe('https://www.banquetrecords.com/wolf-alice/the-clearing/19802909852');
    });

    it('should reject pages below an album', async () => {
      const results = [page('Radiohead - Kid A', 'https://www.banquetrecords.com/radiohead/kid-a/XL123/reviews')];

      expect((await find('Radiohead', 'Kid A', { 'banquetrecords.com': results })).banquet).toBeUndefined();
    });

    it('should reject events, searches and other albums', async () => {
      const results = [
        page('Wolf Alice - Sunday 31st August at Circuit, 7:30pm (14+)', 'https://www.banquetrecords.com/wolf-alice/circuit%2C-7%3A30pm-%2814%2B%29/WA310825'),
        page("Michael Kiwanuka / 'FUDGE' Album Listening Event", "https://www.banquetrecords.com/michael-kiwanuka-%27fudge%27-album-listening-event/banquet-records%2C-11%3A00am/MKALE111026"),
        page('Search | Banquet Records', 'https://www.banquetrecords.com/search?a=Alvvays'),
        page('Alvvays', 'https://www.banquetrecords.com/alvvays/alvvays/TRANS178'),
      ];

      expect(await banquet('Wolf Alice', 'The Clearing', results)).toBeUndefined();
      expect(await banquet('Michael Kiwanuka', 'FUDGE', results)).toBeUndefined();
      expect(await banquet('Alvvays', 'Blue Rev', results)).toBeUndefined();
    });

    it('should not accept an artist slug with no letters in it', async () => {
      const results = [page('Kid A', 'https://www.banquetrecords.com/!!!/kid-a/CAT1')];

      expect(await banquet('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should match artists with an ampersand that the slug drops', async () => {
      const url = 'https://www.banquetrecords.com/belle-sebastian/tigermilk/CAT1';

      expect(await banquet('Belle & Sebastian', 'Tigermilk', [page('Tigermilk', url)])).toBe(url);
    });

    it('should remove tracking from the link', async () => {
      const results = [page('Radiohead - Kid A', 'https://www.banquetrecords.com/radiohead/kid-a/XLLP782?open=menu')];

      expect(await banquet('Radiohead', 'Kid A', results)).toBe('https://www.banquetrecords.com/radiohead/kid-a/XLLP782');
    });
  });

  describe("The artist's own website", () => {
    const WOLF_ALICE_HOMEPAGES = ['https://www.sonymusic.co.uk/artist/wolf-alice/', 'http://wolfalice.co.uk/'];

    it("should search the artist site and their label's in one credit", async () => {
      await find('Wolf Alice', 'The Clearing', {}, WOLF_ALICE_HOMEPAGES);

      const [, searches] = (searchSites as jest.Mock).mock.calls.at(-1);
      expect(searches).toContainEqual(['wolfalice.co.uk', 'sonymusic.co.uk']);
    });

    it.each([
      ['https://com/'],
      ['https://www.com/'],
      ['https://co.uk/'],
      ['mailto:someone@example.com'],
      ['https://192.168.0.1/'],
      ['javascript://example.com/?%0aalert(1)'],
    ])('should not search or link to %s', async (homepage) => {
      const results = [page('Kid A CD', 'https://fake.com/products/kid-a-cd')];

      const { artistStore, officialSite } = await find('Radiohead', 'Kid A', { com: results, 'co.uk': results }, [homepage]);

      const [, searches] = (searchSites as jest.Mock).mock.calls.at(-1);
      expect(searches).toEqual([['bandcamp.com'], ['qobuz.com'], ['banquetrecords.com'], ['musicmagpie.co.uk', 'worldofbooks.com']]);
      expect(artistStore).toEqual([]);
      expect(officialSite).toBeUndefined();
    });

    it('should not widen one search with more than three sites', async () => {
      const labels = ['one', 'two', 'three', 'four'].map((name) => `https://${name}.example/artist/someone`);

      await find('Someone', 'Something', {}, labels);

      const [, searches] = (searchSites as jest.Mock).mock.calls.at(-1);
      expect(searches.at(-1)).toEqual(['one.example', 'two.example', 'three.example']);
    });

    it('should use the first official site that MusicBrainz lists', async () => {
      const indexed = [page('Home', 'https://first.example/about')];

      const { officialSite } = await find('Someone', 'Something', { 'first.example': indexed }, ['https://first.example/', 'https://second.example/']);

      expect(officialSite).toBe('https://first.example/');
    });

    it('should need a format, as other products can share the words of an edition', async () => {
      const results = [page('FUDGE Limited Edition', 'https://shop.michaelkiwanuka.com/products/fudge-limited-edition')];

      const { artistStore } = await find('Michael Kiwanuka', 'FUDGE', { 'michaelkiwanuka.com': results }, ['http://michaelkiwanuka.com/']);

      expect(artistStore).toEqual([]);
    });

    it('should not search sites that many artists share', async () => {
      await find('Someone', 'Something', {}, ['https://someone.bandcamp.com/', 'https://www.facebook.com/', 'https://someone.tumblr.com/']);

      const [, searches] = (searchSites as jest.Mock).mock.calls.at(-1);
      expect(searches.flat()).not.toContain('facebook.com');
      expect(searches).toEqual([['bandcamp.com'], ['qobuz.com'], ['banquetrecords.com'], ['musicmagpie.co.uk', 'worldofbooks.com']]);
    });

    it('should find products on the shop subdomain', async () => {
      const results = [page('FUDGE CD - Michael Kiwanuka', 'https://shop.michaelkiwanuka.com/products/fudge-cd')];

      const { artistStore } = await find('Michael Kiwanuka', 'FUDGE', { 'michaelkiwanuka.com': results }, ['http://michaelkiwanuka.com/']);

      expect(artistStore).toEqual(['https://shop.michaelkiwanuka.com/products/fudge-cd']);
    });

    it('should accept localised product URLs', async () => {
      const results = [page('English Tapas: Vinyl LP', 'https://sleafordmods.com/en-us/products/english-tapas-vinyl-lp')];

      const { artistStore } = await find('Sleaford Mods', 'English Tapas', { 'sleafordmods.com': results }, ['http://www.sleafordmods.com/']);

      expect(artistStore).toEqual(['https://sleafordmods.com/en-us/products/english-tapas-vinyl-lp']);
    });

    it('should reject merch, bundles and other releases', async () => {
      const results = [
        page("Sorry I'm Late Black Hoodie - Mae Muller", 'https://shop.maemuller.com/products/sorry-im-late-black-hoodie'),
        page('CD & Black Hoodie - Mae Muller', 'https://shop.maemuller.com/products/sorry-im-late-cd-and-black-hoodie-bundle'),
        page('The Clearing B Sides 7" Vinyl', 'https://shop.maemuller.com/products/sorry-im-late-b-sides-7-vinyl'),
        page('Sorry I\'m Late Digital Download', 'https://shop.maemuller.com/products/sorry-im-late-digital-download'),
        page('Sorry I\'m Late Collection', 'https://shop.maemuller.com/collections/sorry-im-late'),
      ];

      const { artistStore } = await find('Mae Muller', "Sorry I'm Late", { 'maemuller.com': results }, ['https://www.maemuller.com/']);

      expect(artistStore).toEqual([]);
    });

    it('should reject products from outside the artist domain', async () => {
      const results = [page('FUDGE CD', 'https://fakemichaelkiwanuka.com/products/fudge-cd')];

      const { artistStore } = await find('Michael Kiwanuka', 'FUDGE', { 'michaelkiwanuka.com': results }, ['http://michaelkiwanuka.com/']);

      expect(artistStore).toEqual([]);
    });

    it("should use the label's shop, but only for this artist's products", async () => {
      const results = [
        page('Sufjan Stevens - Carrie & Lowell LP', 'https://store.asthmatickitty.com/products/sufjan-stevens-carrie-lowell-lp'),
        page('Carrie & Lowell CD', 'https://store.asthmatickitty.com/products/carrie-lowell-cd'),
      ];
      const homepages = ['https://asthmatickitty.com/artists/sufjan-stevens/', 'https://sufjan.com/'];

      const { artistStore } = await find('Sufjan Stevens', 'Carrie & Lowell', { 'sufjan.com': results }, homepages);

      expect(artistStore).toEqual(['https://store.asthmatickitty.com/products/sufjan-stevens-carrie-lowell-lp']);
    });

    it('should read the format from the title when the URL is only the album name', async () => {
      const url = 'https://store.asthmatickitty.com/products/sufjan-stevens-carrie-lowell';
      const results = [page('Sufjan Stevens - Carrie & Lowell LP – Asthmatic Kitty Records', url)];

      const { artistStore } = await find('Sufjan Stevens', 'Carrie & Lowell', { 'asthmatickitty.com': results }, ['https://asthmatickitty.com/artists/sufjan-stevens/']);

      expect(artistStore).toEqual([url]);
    });

    it('should not mistake a sequel or colour album for a pressing', async () => {
      const results = [
        page('Greatest Hits 2 CD', 'https://queenonline.com/products/greatest-hits-2-cd'),
        page('Green Album LP', 'https://queenonline.com/products/greatest-hits-green-album-lp'),
      ];

      const { artistStore } = await find('Queen', 'Greatest Hits', { 'queenonline.com': results }, ['https://queenonline.com/']);

      expect(artistStore).toEqual([]);
    });

    it('should reject a page named after the album with no format, such as a t-shirt', async () => {
      const results = [page('Romance Tee - Fontaines D.C.', 'https://fontainesdc.com/products/romance')];

      const { artistStore } = await find('Fontaines D.C.', 'Romance', { 'fontainesdc.com': results }, ['https://fontainesdc.com/']);

      expect(artistStore).toEqual([]);
    });

    it('should not offer a label site as the official site', async () => {
      const results = [page('Wolf Alice | Sony Music UK', 'https://www.sonymusic.co.uk/artist/wolf-alice')];

      const { officialSite } = await find('Wolf Alice', 'The Clearing', { 'sonymusic.co.uk': results }, ['https://www.sonymusic.co.uk/artist/wolf-alice/']);

      expect(officialSite).toBeUndefined();
    });

    it('should need the official site itself to be indexed, not just its label', async () => {
      const results = [page('Sufjan Stevens - Asthmatic Kitty', 'https://asthmatickitty.com/artists/sufjan-stevens')];
      const homepages = ['https://sufjan.com/', 'https://asthmatickitty.com/artists/sufjan-stevens/'];

      const { officialSite } = await find('Sufjan Stevens', 'Carrie & Lowell', { 'sufjan.com': results }, homepages);

      expect(officialSite).toBeUndefined();
    });

    it('should list the standard pressing before numbered variants', async () => {
      const results = [
        page("Sorry I'm Late - Cassette #3", 'https://shop.maemuller.com/products/sorry-im-late-cassette-3'),
        page("Sorry I'm Late - Standard CD", 'https://shop.maemuller.com/products/sorry-im-late-standard-cd'),
      ];

      const { artistStore } = await find('Mae Muller', "Sorry I'm Late", { 'maemuller.com': results }, ['https://www.maemuller.com/']);

      expect(artistStore[0]).toBe('https://shop.maemuller.com/products/sorry-im-late-standard-cd');
    });

    it.each([
      ['fudge-signed-cd'],
      ['fudge-limited-lp'],
      ['fudge-exclusive-cassette'],
      ['fudge-cd-2'],
    ])('should list %s after the plain pressing', async (slug) => {
      const results = [
        page('FUDGE', `https://shop.michaelkiwanuka.com/products/${slug}`),
        page('FUDGE CD', 'https://shop.michaelkiwanuka.com/products/fudge-cd'),
      ];

      const { artistStore } = await find('Michael Kiwanuka', 'FUDGE', { 'michaelkiwanuka.com': results }, ['http://michaelkiwanuka.com/']);

      expect(artistStore[0]).toBe('https://shop.michaelkiwanuka.com/products/fudge-cd');
    });

    it('should list a pressing called standard first', async () => {
      const results = [
        page('FUDGE LP', 'https://shop.michaelkiwanuka.com/products/fudge-lp'),
        page('FUDGE Standard LP', 'https://shop.michaelkiwanuka.com/products/fudge-standard-lp'),
      ];

      const { artistStore } = await find('Michael Kiwanuka', 'FUDGE', { 'michaelkiwanuka.com': results }, ['http://michaelkiwanuka.com/']);

      expect(artistStore[0]).toBe('https://shop.michaelkiwanuka.com/products/fudge-standard-lp');
    });

    it('should list standard pressings before special ones', async () => {
      const results = [
        page('FUDGE Exclusive Pink 2LP', 'https://shop.michaelkiwanuka.com/products/fudge-exclusive-pink-2lp'),
        page('FUDGE 2LP', 'https://shop.michaelkiwanuka.com/products/fudge-2lp'),
      ];

      const { artistStore } = await find('Michael Kiwanuka', 'FUDGE', { 'michaelkiwanuka.com': results }, ['http://michaelkiwanuka.com/']);

      expect(artistStore).toEqual([
        'https://shop.michaelkiwanuka.com/products/fudge-2lp',
        'https://shop.michaelkiwanuka.com/products/fudge-exclusive-pink-2lp',
      ]);
    });

    it('should offer the official site when it has no product', async () => {
      const results = [page('DEAD AIR SPACE | RADIOHEAD.COM', 'https://radiohead.com/deadairspace')];

      const { artistStore, officialSite } = await find('Radiohead', 'Kid A', { 'radiohead.com': results }, ['http://www.radiohead.com/']);

      expect(artistStore).toEqual([]);
      expect(officialSite).toBe('http://www.radiohead.com/');
    });

    it('should not offer a site with nothing in the search index, as it may be gone', async () => {
      const { officialSite } = await find('Alvvays', 'Blue Rev', {}, ['https://www.alvvays.com/']);

      expect(officialSite).toBeUndefined();
    });
  });

  describe('musicMagpie', () => {
    const magpie = async (artist: string, album: string, results: SiteResult[]) =>
      (await find(artist, album, { 'musicmagpie.co.uk': results })).musicMagpie;
    const product = (slug: string) => `https://www.musicmagpie.co.uk/store/products/${slug}`;

    it('should accept each title format that it uses', async () => {
      const titles: [string, string, string][] = [
        ['Sleaford Mods', 'English Tapas', 'Sleaford Mods - English Tapas CD / Album'],
        ['Mae Muller', "Sorry I'm Late", 'Mae Muller - Sorry I\'m Late CD / Album - musicMagpie Store'],
        ['Alvvays', 'Blue Rev', 'Alvvays - Blue Rev Vinyl / 12" Album Coloured Vinyl'],
        ['Slowdive', 'Souvlaki', 'Souvlaki - Slowdive - musicMagpie Store'],
        ['Wolf Alice', 'The Clearing', 'Wolf Alice - The Clearing Vinyl / 12" Album Picture Disc'],
      ];

      for (const [artist, album, title] of titles) {
        expect(await magpie(artist, album, [page(title, product('x'))])).toBe(product('x'));
      }
    });

    it('should not mistake a title starting "And" for a second artist', async () => {
      const url = product('and-justice');

      expect(await magpie('Metallica', '...And Justice for All', [page('Metallica - ...And Justice For All CD', url)])).toBe(url);
    });

    it('should not mistake a sequel or colour album for a pressing', async () => {
      expect(await magpie('Queen', 'Greatest Hits', [page('Queen - Greatest Hits 2 CD / Album - musicMagpie Store', product('x'))])).toBeUndefined();
      expect(await magpie('Weezer', 'Weezer', [page('Weezer - Weezer Green Album CD', product('x'))])).toBeUndefined();
    });

    it('should reject other albums, singles and books', async () => {
      const results = [
        page('Radiohead - KID a MNESIA CD / Box Set - musicMagpie Store', product('radioheadkidamnesia')),
        page('Radiohead - Kid A CD / Single - musicMagpie Store', product('kid-a-single')),
        page('Kid A - Radiohead Paperback / softback - musicMagpie Store', product('kid-a-book')),
      ];

      expect(await magpie('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should reject the same title by someone else', async () => {
      const results = [page('Kid A - Someone Else - musicMagpie Store', product('kid-a'))];

      expect(await magpie('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should reject a title that does not name the artist', async () => {
      const results = [page('Kid A CD / Album - musicMagpie Store', product('kid-a'))];

      expect(await magpie('Radiohead', 'Kid A', results)).toBeUndefined();
    });

    it('should only accept product pages', async () => {
      const results = [page('Radiohead - Kid A', 'https://www.musicmagpie.co.uk/blog/2016/06/17/radiohead-kid-a')];

      expect(await magpie('Radiohead', 'Kid A', results)).toBeUndefined();
    });
  });

  describe('World of Books', () => {
    const wob = async (album: string, results: SiteResult[], barcodes: string[]) =>
      (await find('Alvvays', album, { 'worldofbooks.com': results }, [], barcodes)).worldOfBooks;

    it('should accept a page whose barcode is one of the album\'s, even without the artist in the title', async () => {
      const url = 'https://www.worldofbooks.com/en-au/products/blue-rev-cd-5400863087845';

      expect(await wob('Blue Rev', [page('Blue Rev', url)], ['5400863087845'])).toBe(url);
    });

    it('should ignore differences in zero padding', async () => {
      const url = 'https://www.worldofbooks.com/en-gb/products/the-clearing-cd-0198029098525';

      expect(await wob('The Clearing', [page('The Clearing', url)], ['198029098525'])).toBe(url);
    });

    it('should reject a page with the same name but another barcode', async () => {
      const url = 'https://www.worldofbooks.com/en-gb/products/blue-rev-cd-5400863087845';

      expect(await wob('Blue Rev', [page('Blue Rev', url)], ['111111111111'])).toBeUndefined();
    });

    it('should reject books with the same name, which have no matching barcode', async () => {
      const url = 'https://www.worldofbooks.com/en-gb/products/sorry-i-m-late-i-didn-t-want-to-come-book-jessica-pan-9781529360547';

      expect(await wob("Sorry I'm Late", [page("Sorry I'm Late, I Didn't Want to Come By Jessica Pan", url)], ['602455732767'])).toBeUndefined();
    });

    it('should prefer the standard album over a box set', async () => {
      const results = [
        page("Kid a-Deluxe Edition (Collector's Edition Box set)", 'https://www.worldofbooks.com/en-gb/products/kid-a-deluxe-edition-cd-5099969710827'),
        page('Kid a (Import)', 'https://www.worldofbooks.com/en-gb/products/kid-a-cd-0724352922024'),
      ];

      expect(await wob('Kid A', results, ['5099969710827', '724352922024'])).toBe('https://www.worldofbooks.com/en-gb/products/kid-a-cd-0724352922024');
    });

    it('should remove tracking from the link', async () => {
      const url = 'https://www.worldofbooks.com/en-au/products/blue-rev-cd-5400863087845?sku=DVDB0B5KQNBW5LN';

      expect(await wob('Blue Rev', [page('Blue Rev', url)], ['5400863087845'])).toBe('https://www.worldofbooks.com/en-au/products/blue-rev-cd-5400863087845');
    });
  });

  describe('Collaborations', () => {
    const ARTISTS = ['Apollo Brown', 'Skyzoo'];

    const findCollaboration = async (results: Results) => {
      (searchSites as jest.Mock).mockImplementation(async (_query: string, searches: string[][]) =>
        searches.map((domains) => domains.flatMap((domain) => results[domain] ?? []))
      );
      const { value } = await findStorePages({ artists: ARTISTS, album: 'Luxury Tax', homepages: [], bandcampAccounts: [], barcodes: [], hasBandcamp: false, hasQobuz: false });
      return value;
    };

    it('should search for all of the artists', async () => {
      await findCollaboration({});

      expect((searchSites as jest.Mock).mock.calls.at(-1)?.[0]).toBe('Apollo Brown Skyzoo Luxury Tax');
    });

    it("should accept a page on either artist's Bandcamp", async () => {
      const url = 'https://apollobrown.bandcamp.com/album/luxury-tax';

      const { bandcamp } = await findCollaboration({ 'bandcamp.com': [page('Luxury Tax | Apollo Brown, Skyzoo', url)] });

      expect(bandcamp).toBe(url);
    });

    it('should accept each way that Qobuz lists several artists', async () => {
      const url = 'https://www.qobuz.com/gb-en/album/luxury-tax-apollo-brown-skyzoo/o71aag4wcnzsd';
      const titles = ['Luxury Tax, Apollo Brown, Skyzoo - Qobuz', 'Luxury Tax, Apollo Brown & Skyzoo', 'Apollo Brown, Skyzoo|Luxury Tax'];

      for (const title of titles) {
        const { qobuz } = await findCollaboration({ 'qobuz.com': [page(title, url)] });
        expect(qobuz).toEqual([url]);
      }
    });

    it('should accept Banquet pages filed under either artist or both', async () => {
      for (const slug of ['apollo-brown', 'skyzoo', 'apollo-brown-%26-skyzoo', 'apollo-brown-and-skyzoo']) {
        const url = `https://www.banquetrecords.com/${slug}/luxury-tax/MMS123`;
        const { banquet } = await findCollaboration({ 'banquetrecords.com': [page('Luxury Tax', url)] });
        expect(banquet).toBe(url);
      }
    });

    it('should still reject Banquet pages that also name someone else', async () => {
      const results = [page('Luxury Tax', 'https://www.banquetrecords.com/apollo-brown-%26-someone-else/luxury-tax/MMS123')];

      const { banquet } = await findCollaboration({ 'banquetrecords.com': results });

      expect(banquet).toBeUndefined();
    });

    it('should still reject the same title by neither artist', async () => {
      const results = [page('Luxury Tax | Someone Else', 'https://someoneelse.bandcamp.com/album/luxury-tax')];

      const { bandcamp } = await findCollaboration({ 'bandcamp.com': results });

      expect(bandcamp).toBeUndefined();
    });
  });

  it('should not mistake a self-titled album for its artist', async () => {
    const url = 'https://www.qobuz.com/us-en/album/alvvays-alvvays/abc123';

    const { qobuz } = await find('Alvvays', 'Alvvays', { 'qobuz.com': [page('Alvvays, Alvvays - Qobuz', url)] });

    expect(qobuz).toEqual([url]);
  });

  it('should search without edition markers, and not spend credits on stores that we have', async () => {
    (searchSites as jest.Mock).mockResolvedValue([[], []]);

    await findStorePages({ artists: ['Alvvays'], album: 'Blue Rev (Deluxe Edition)', homepages: [], bandcampAccounts: [], barcodes: [], hasBandcamp: true, hasQobuz: true });

    expect(searchSites).toHaveBeenLastCalledWith('Alvvays Blue Rev', [['banquetrecords.com'], ['musicmagpie.co.uk', 'worldofbooks.com']], undefined);
  });

  it('should keep what it found if one search fails, but only briefly', async () => {
    const url = 'https://www.banquetrecords.com/radiohead/kid-a/XLLP782';
    (searchSites as jest.Mock).mockResolvedValue([null, [], [page('Radiohead - Kid A', url)]]);

    const { value, complete } = await findStorePages({ artists: ['Radiohead'], album: 'Kid A', homepages: [], bandcampAccounts: [], barcodes: [], hasBandcamp: false, hasQobuz: false });

    expect(value.banquet).toBe(url);
    expect(complete).toBe(false);
  });

  it('should report an incomplete lookup if it could not search', async () => {
    (searchSites as jest.Mock).mockResolvedValue(null);

    const { complete } = await findStorePages({ artists: ['Radiohead'], album: 'Kid A', homepages: [], bandcampAccounts: [], barcodes: [], hasBandcamp: false, hasQobuz: false });

    expect(complete).toBe(false);
  });
});
