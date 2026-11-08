# 🚀 StreamToShelf Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment (Optional)

Search and most links work with no credentials. To add direct links to more stores:

```bash
cp .env.example .env.local
```

Then add a [Discogs token](https://www.discogs.com/settings/developers) and a [Tavily key](https://app.tavily.com). See the [API Setup Guide](API_SETUP.md) for what each one does.

### Step 3: Start the App
```bash
npm run dev
```

Visit http://localhost:3000 and search for your favorite artist!

## 🎵 How to Use

1. **Search for an artist** (e.g., "Radiohead", "Taylor Swift")
2. **Browse the results** - see all albums and singles
3. **Click any album** to see where you can buy it
4. **Choose your format**:
   - **Digital Downloads**: iTunes, Amazon Music, Bandcamp, HDtracks, 7digital, Qobuz
   - **Physical Media**: Amazon, Discogs, Banquet Records, World of Books, musicMagpie, and the artist's own store

## 🌍 Regions

Your region is detected from your browser's language. It chooses the right iTunes, Amazon, 7digital, Qobuz and World of Books store, and artists' regional shops. Supported regions: US, UK, Canada, Australia, Germany, France, Japan.

## 🧪 Test the APIs

Test album search:
```bash
curl "http://localhost:3000/api/deezer-search?artist=Radiohead"
```

Test buy links:
```bash
curl "http://localhost:3000/api/buy-links?artist=Radiohead&album=OK%20Computer&region=US"
```

## 🚀 Ready to Deploy?

1. Push your code to GitHub
2. Go to https://vercel.com and import your repository
3. Add `DISCOGS_TOKEN` and `TAVILY_API_KEY` as environment variables
4. Deploy!

## 🔧 Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Run production build
npm test             # Run tests
npm run lint         # Check code quality
```

## 📚 Learn More

- [Full README](README.md) - Complete documentation
- [API Setup Guide](API_SETUP.md) - Detailed API configuration
- [Next.js Docs](https://nextjs.org/docs) - Learn about the framework

## 🆘 Common Issues

**Most stores show "Search":**
- MusicBrainz is often busy, and lookups that fail are retried after 5 minutes
- Check `TAVILY_API_KEY` in `.env.local`, and restart the dev server after adding it

**No Discogs link:**
- Check your Discogs token
