import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // Spotify CDN
        port: '',
        pathname: '/image/**',
      },
      {
        protocol: 'https',
        hostname: 'mosaic.scdn.co', // Spotify mosaic images
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image-cdn-ak.spotifycdn.com', // Spotify alternative CDN
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image-cdn-fa.spotifycdn.com', // Spotify alternative CDN
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com', // Amazon images (from Songlink)
        port: '',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com', // Apple Music artwork
        port: '',
        pathname: '/image/**',
      },
      {
        protocol: 'https',
        hostname: 'a1.mzstatic.com', // Apple Music alternative CDN
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.discogs.com', // Discogs artwork
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.discogs.com', // Discogs CDN artwork
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'st.discogs.com', // Discogs static assets
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'f4.bcbits.com', // Bandcamp artwork
        port: '',
        pathname: '/img/**',
      },
    ],
  },
};

export default nextConfig;
