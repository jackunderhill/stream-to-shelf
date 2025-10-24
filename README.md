# StreamToShelf – Find Where to Buy Music

StreamToShelf helps music lovers find where to buy their favorite albums - both digital downloads and physical media (vinyl, CDs, cassettes). Search for any artist on Spotify, then see all the places you can purchase that music.

## 🎵 Features

- **Spotify-Powered Search**: Search for albums and singles using Spotify's comprehensive catalog
- **Two-Step Discovery**: Browse Spotify results, then click to see all purchase options
- **Digital & Physical**: Find digital downloads (iTunes, Amazon Music, Bandcamp, HDtracks) and physical media (Amazon, Discogs)
- **Region Support**: Localized results for US, UK, Canada, Australia, Germany, France, and Japan
- **Organized Results**: Buy links grouped by format (Digital Downloads vs Physical Media)
- **Blog Content**: Educational articles about buying and owning music

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd stream-to-shelf
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your API credentials:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DISCOGS_TOKEN=your_discogs_token
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Development Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── spotify-search/   # Spotify search API endpoint
│   │   └── songlink/         # Buy links aggregation
│   ├── blog/[...slug]/       # Dynamic blog routes
│   ├── search/               # Spotify search results page
│   ├── album/                # Album buy links page
│   ├── layout.tsx            # Root layout with SEO
│   └── page.tsx              # Home page
├── components/
│   ├── SearchBar.tsx         # Search form component
│   └── PlatformIcon.tsx      # Platform icons
├── lib/
│   └── blog.ts               # Blog post utilities
└── types/
    └── index.ts              # TypeScript definitions

content/                      # Markdown blog posts
```

## 🔌 API Integration

### Spotify API
- **Purpose**: Album and artist search
- **Authentication**: Client credentials flow
- **Used for**: Finding albums and metadata

### Songlink/Odesli API
- **Purpose**: Aggregating streaming and purchase links
- **Authentication**: None required
- **Used for**: iTunes, Bandcamp, Google Play links

### Discogs API
- **Purpose**: Physical media releases
- **Authentication**: Token required
- **Used for**: Vinyl, CD, cassette links

### Custom Integrations
- **Amazon**: Search URLs for both digital and physical media
- **HDtracks**: High-resolution audio downloads

## 🔍 How It Works

1. **User searches** for an artist/album on the home page
2. **Spotify API** returns matching albums and singles
3. **User clicks** an album to see purchase options
4. **Songlink API** provides digital store links (iTunes, Bandcamp, etc.)
5. **Discogs API** adds physical media options
6. **Results displayed** grouped by format (Digital Downloads / Physical Media)

## 📝 Adding Blog Posts

1. Create a new `.md` file in the `content/` directory
2. Add frontmatter with metadata:

```markdown
---
title: "Your Post Title"
description: "Brief description for SEO"
date: "2025-09-24"
tags: ["tag1", "tag2"]
---

# Your Post Title

Content goes here...
```

3. The post will be automatically available at `/blog/your-filename`

## 🎨 Styling

The project uses Tailwind CSS with a dark music-focused theme:

- **Dark theme**: Gray-900 gradient backgrounds
- **Format-specific colors**: Blue for digital, green for physical
- **Centered album displays**: Prominent artwork with title/artist
- **Responsive grid layouts**: Platform cards adapt to screen size

## 🧪 Testing

The project includes tests for key components and utilities:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `DISCOGS_TOKEN`

3. Deploy automatically on push to main branch

### Manual Deployment

```bash
npm run build
npm start
```

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify API client secret |
| `DISCOGS_TOKEN` | Yes | Discogs API token |

## 🎯 SEO Features

- **Dynamic meta tags**: Based on search queries and albums
- **Open Graph tags**: Social media preview cards
- **Server-side rendering**: Fast loading and SEO-friendly
- **Blog system**: Content marketing for organic traffic

## 🔄 Future Enhancements

- Price comparison across stores
- User favorites and wishlists
- Email alerts for new releases
- Advanced filtering (year, genre, label)
- Affiliate link integration for revenue

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -m "Add new feature"`
6. Push to branch: `git push origin feature/new-feature`
7. Open a pull request

## 📄 License

This project is licensed under the MIT License.

---

Built with Next.js 15, TypeScript, and Tailwind CSS.
