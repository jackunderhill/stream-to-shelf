# StreamToShelf API Setup Guide

## 🎵 Required API Credentials

### 1. Spotify API ✅ (Required)
**Get your credentials**: https://developer.spotify.com/dashboard

1. Log in to Spotify Developer Dashboard
2. Create a new app
3. Copy your Client ID and Client Secret
4. Add to `.env.local`:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

**What it's used for**: Searching for albums and artists, displaying album artwork and metadata

**Rate limits**: Generally generous for this use case

### 2. Discogs API 🎯 (Required)
**Get your token**: https://www.discogs.com/settings/developers

1. Create or log in to your Discogs account
2. Go to Settings → Developers
3. Generate new token
4. Add to `.env.local`:
```env
DISCOGS_TOKEN=your_discogs_token_here
```

**What it's used for**: Finding physical media releases (vinyl, CDs, cassettes)

**Rate limits**: 60 requests per minute (authenticated)

**Example API call:**
```bash
curl -H "Authorization: Discogs token=YOUR_TOKEN" \
"https://api.discogs.com/database/search?q=Radiohead+In+Rainbows&type=release&artist=Radiohead"
```

## 🔌 APIs That Don't Require Setup

### Songlink/Odesli API
- **Status**: Active, no authentication required
- **Used for**: Aggregating buy links from iTunes, Bandcamp, Google Play, etc.
- **Rate limits**: Reasonable for moderate traffic
- **Endpoint**: `https://api.song.link/v1-alpha.1/links`

### Amazon (Direct Links)
- **Status**: Using search URLs, no API key needed
- **Used for**: Both digital music and physical media
- **Region-aware**: Automatically routes to correct Amazon domain (US, UK, CA, AU, DE, FR, JP)

### HDtracks (Direct Links)
- **Status**: Using search URLs, no API key needed
- **Used for**: High-resolution audio downloads

## 🚀 Quick Setup

1. **Copy environment template:**
```bash
cp .env.example .env.local
```

2. **Add your credentials to `.env.local`:**
```env
# Spotify (required)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Discogs (required)
DISCOGS_TOKEN=your_discogs_token

# No other API keys needed!
```

3. **Restart your dev server:**
```bash
npm run dev
```

## 📊 What Each API Provides

| API | Provides | Auth Required | Cost |
|-----|----------|---------------|------|
| **Spotify** | Album search, metadata, artwork | ✅ Client credentials | Free |
| **Songlink** | iTunes, Bandcamp, Google Play links | ❌ No | Free |
| **Discogs** | Vinyl, CD, cassette releases | ✅ Token | Free |
| **Amazon** | Digital & physical purchase links | ❌ No | Free |
| **HDtracks** | Hi-res audio download links | ❌ No | Free |

## 🔍 Testing Your Setup

**Test Spotify search:**
```bash
curl "http://localhost:3000/api/spotify-search?artist=Radiohead&album=In+Rainbows"
```

**Test buy links (requires Spotify URL):**
```bash
curl "http://localhost:3000/api/songlink?url=https://open.spotify.com/album/5vkqYmiPBYLaalcmjujWxo&region=US"
```

**Expected response includes:**
- Digital downloads: iTunes, Amazon Music, Bandcamp, Google Play, HDtracks
- Physical media: Amazon, Discogs

## 🚨 Troubleshooting

**"Spotify authentication failed"**
- Double-check your Client ID and Client Secret
- Make sure there are no extra spaces in `.env.local`
- Restart your dev server after adding credentials

**"Discogs returning 401"**
- Verify your token at https://www.discogs.com/settings/developers
- Check that the token is correctly copied to `.env.local`

**"No physical media results"**
- Some albums may not be available on Discogs
- Try a different, more popular album for testing

**Rate limits hit:**
- Discogs: 60/min authenticated, 25/min unauthenticated
- Songlink: Should handle reasonable traffic
- Spotify: Very generous limits for search

## 📝 Environment Variables Reference

```env
# Required
SPOTIFY_CLIENT_ID=        # From developer.spotify.com/dashboard
SPOTIFY_CLIENT_SECRET=    # From developer.spotify.com/dashboard
DISCOGS_TOKEN=            # From discogs.com/settings/developers

# Optional (has defaults)
NODE_ENV=development
```

That's it! With just Spotify and Discogs credentials, you have access to:
- Millions of albums from Spotify's catalog
- Digital purchase links from 5+ platforms
- Physical media from Discogs marketplace
- Region-aware Amazon links for all territories
