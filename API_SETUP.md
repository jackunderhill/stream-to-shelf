# StreamToShelf API Setup Guide

Search and most links work with no credentials at all. Two optional keys add direct links.

## 🔑 Optional Credentials

### Discogs
**Get your token**: https://www.discogs.com/settings/developers

```env
DISCOGS_TOKEN=your_discogs_token
```

- **Used for**: Master pages, found from physical barcodes, and physical releases
- **Without it**: Discogs uses the link from MusicBrainz if there is one, and otherwise a search link
- **Rate limits**: 60 requests per minute

### Tavily
**Get your key**: https://app.tavily.com

```env
TAVILY_API_KEY=your_tavily_api_key
```

- **Used for**: Direct links to Bandcamp, Qobuz, Banquet Records, musicMagpie, World of Books and artists' own stores, where MusicBrainz has none
- **Without it**: Those stores use search links
- **Credits**: Each search costs 1. The free plan has 1,000 a month, so `src/lib/tavily.ts` aims to stop at 30 a day. That's about 6 new albums a day, as a new album costs up to 5. Once the cap is reached, new albums use search links until midnight UTC. One visitor can use 15 credits a day on each server instance, leaving the rest for others. If the cache can't be read, nothing is spent. The caps are best effort, because Runtime Cache has no atomic increment, so use a Vercel Firewall rate limit on `/api/*` as well
- **Rules**: Only ever search chosen domains, never the open web, and never request store pages directly. Every result must pass the strict matching in `src/lib/store-pages.ts`

Add both to `.env.local`, and to the Vercel project before deploying. Restart the dev server after changing them.

## 🔌 APIs That Don't Require Setup

### Deezer API
- **Used for**: Album and artist search, artwork and UPCs
- **Endpoint**: `https://api.deezer.com`

### MusicBrainz API
- **Used for**: Direct links to Bandcamp, Amazon, Qobuz, HDtracks and 7digital, physical barcodes, and artists' homepages. It's also used to confirm that Deezer profiles with the same name are the same artist
- **Rate limits**: About 1 request per second per IP, so lookups are cached
- **Endpoint**: `https://musicbrainz.org/ws/2`

### iTunes Search API
- **Used for**: Region-specific iTunes links
- **Endpoint**: `https://itunes.apple.com`

## 📊 Where Each Store Link Comes From

Every store falls back to its own search page, labelled "Search", so a source being down costs direct links and never the page.

| Store | Direct links from |
|-------|-------------------|
| iTunes | iTunes Search API |
| Amazon, Amazon Music, HDtracks, 7digital | MusicBrainz |
| Bandcamp, Qobuz | MusicBrainz, then Tavily |
| Discogs | Discogs API, using barcodes from MusicBrainz |
| Banquet Records, musicMagpie, World of Books | Tavily |
| Artist's store, Official site | Tavily, using homepages from MusicBrainz |

musicMagpie is only shown in the UK, as it doesn't deliver abroad.

## 🔍 Testing Your Setup

**Test album search:**
```bash
curl "http://localhost:3000/api/deezer-search?artist=Radiohead&album=In+Rainbows"
```

**Test buy links** (a new album costs up to 5 Tavily credits):
```bash
curl "http://localhost:3000/api/buy-links?artist=Radiohead&album=OK%20Computer&region=US"
```

## 🚨 Troubleshooting

**"Discogs returning 401"**
- Verify your token at https://www.discogs.com/settings/developers

**Most stores show "Search"**
- MusicBrainz is often busy. Lookups that fail are retried after 5 minutes
- Check whether `TAVILY_API_KEY` is set, and whether the logs say that the daily budget was reached or couldn't be read

**Rate limits hit:**
- Discogs: 60 requests per minute
- MusicBrainz: About 1 request per second per IP. Links fall back to store searches when it is busy
