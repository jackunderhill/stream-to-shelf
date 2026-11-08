# StreamToShelf – Find Where to Buy Music

StreamToShelf helps music lovers find where to buy their favorite albums - both digital downloads and physical media (vinyl, CDs, cassettes). Search for any artist, then see all the places you can purchase that music.

## 🎵 Features

- **Album Search**: Search for albums and singles using Deezer's catalog
- **Two-Step Discovery**: Browse results, then click to see all purchase options
- **Digital & Physical**: Find digital downloads (iTunes, Amazon Music, Bandcamp, HDtracks, 7digital, Qobuz) and physical media (Amazon, Discogs, Banquet Records, World of Books, musicMagpie, artists' own stores)
- **Region Support**: Localized results for US, UK, Canada, Australia, Germany, France, and Japan
- **Organized Results**: Buy links grouped by format (Digital Downloads vs Physical Media)
- **Blog Content**: Educational articles about buying and owning music

## 🚀 Quick Start

### Prerequisites

- Node.js 20.9+
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

4. Optionally, edit `.env.local` to add direct links to more stores:
```env
DISCOGS_TOKEN=your_discogs_token
TAVILY_API_KEY=your_tavily_api_key
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
│   │   ├── deezer-search/    # Deezer search API endpoint
│   │   └── buy-links/        # Buy links aggregation
│   ├── blog/[...slug]/       # Dynamic blog routes
│   ├── search/               # Deezer search results page
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

### Deezer API
- **Purpose**: Album and artist search
- **Authentication**: None required
- **Used for**: Finding albums, metadata and UPCs

### MusicBrainz API
- **Purpose**: Direct store links recorded by its community
- **Authentication**: None required, but limited to about 1 request per second per IP
- **Used for**: Bandcamp, Amazon, Qobuz, HDtracks, 7digital and Discogs links

### iTunes Search API
- **Purpose**: iTunes store links
- **Authentication**: None required
- **Used for**: Region-specific album links

### Discogs API
- **Purpose**: Physical media releases
- **Authentication**: Token recommended
- **Used for**: Master pages, found from physical barcodes

### Tavily
- **Purpose**: Finding album pages on stores with no API
- **Authentication**: API key, with 1,000 free searches a month
- **Used for**: Bandcamp, Qobuz, Banquet Records, musicMagpie, World of Books and artists' own stores. It only ever searches those sites, and results must pass strict matching in `src/lib/store-pages.ts`

## 🔍 How It Works

1. **User searches** for an artist/album on the home page
2. **Deezer API** returns matching albums and singles
3. **User clicks** an album to see purchase options
4. **Deezer API** provides the album's UPC, which identifies it exactly in other catalogs
5. **MusicBrainz and iTunes** provide direct store links, cached by UPC
6. **Discogs API** gives the master page for a physical barcode, then checks known releases, then searches by name
7. **Tavily** finds direct links on stores with no API, searching only those stores
8. **Results displayed** grouped by format (Digital Downloads / Physical Media), with a store search link wherever we don't have a direct link

Bandcamp links come from MusicBrainz or Tavily's search index, or are search links that the user opens. Bandcamp's Acceptable Use Policy prohibits scraping, and its API doesn't offer search, so we never call Bandcamp from the server.

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
   - `DISCOGS_TOKEN`
   - `TAVILY_API_KEY`

3. Deploy automatically on push to main branch

### Manual Deployment

```bash
npm run build
npm start
```

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | No | Site URL for metadata, defaults to https://streamtoshelf.com |
| `DISCOGS_TOKEN` | Recommended | Discogs API token |
| `TAVILY_API_KEY` | Optional | Direct links for stores with no API |

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

Built with Next.js 16, TypeScript, and Tailwind CSS.
