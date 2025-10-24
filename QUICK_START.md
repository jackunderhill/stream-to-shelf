# 🚀 StreamToShelf Quick Start

## Get Up and Running in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Get API Credentials

You need two API credentials (both free):

#### Spotify API (2 minutes)
1. Go to https://developer.spotify.com/dashboard
2. Click "Create app"
3. Fill in app name and description (anything works)
4. Copy your Client ID and Client Secret

#### Discogs API (1 minute)
1. Go to https://www.discogs.com/settings/developers
2. Click "Generate new token"
3. Copy your token

### Step 3: Configure Environment

Create `.env.local` file:
```bash
cp .env.example .env.local
```

Add your credentials:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
DISCOGS_TOKEN=your_discogs_token_here
```

### Step 4: Start the App
```bash
npm run dev
```

Visit http://localhost:3000 and search for your favorite artist!

## 🎵 How to Use

1. **Search for an artist** (e.g., "Radiohead", "Taylor Swift")
2. **Browse Spotify results** - see all albums and singles
3. **Click any album** to see where you can buy it
4. **Choose your format**:
   - **Digital Downloads**: iTunes, Amazon Music, Bandcamp, HDtracks
   - **Physical Media**: Vinyl, CDs, cassettes from Amazon and Discogs

## 🌍 Region Support

The region selector affects:
- **iTunes**: Shows region-specific store
- **Amazon**: Routes to correct domain (.com, .co.uk, .ca, etc.)
- **Future platforms**: Will respect your region preference

Supported regions: US, UK, Canada, Australia, Germany, France, Japan

## ✨ Features

- **Spotify-powered search**: Comprehensive album catalog
- **Format-organized results**: Digital and physical media grouped separately
- **Region-aware links**: Automatically routes to correct stores for your location
- **Blog content**: Learn about buying and collecting music

## 🧪 Test the APIs

Test Spotify search:
```bash
curl "http://localhost:3000/api/spotify-search?artist=Radiohead"
```

Test buy links:
```bash
curl "http://localhost:3000/api/songlink?url=https://open.spotify.com/album/5vkqYmiPBYLaalcmjujWxo&region=US"
```

## 🚀 Ready to Deploy?

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to https://vercel.com and import your repository
3. Add environment variables:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `DISCOGS_TOKEN`
4. Deploy!

Your site will be live at `your-project.vercel.app`

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

**Search returns no results:**
- Check your Spotify credentials in `.env.local`
- Make sure dev server was restarted after adding credentials

**No physical media links:**
- Check your Discogs token
- Try a popular album (e.g., "Abbey Road" by The Beatles)

**Region selector not working:**
- Currently affects iTunes and Amazon
- Some platforms (like Bandcamp) are not region-specific

---

That's it! You now have a working music discovery platform. Happy searching! 🎵
