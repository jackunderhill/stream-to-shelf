import type { NextConfig } from "next";

// Hosts that album art loads from directly. Art has no query string, and each new
// one would be a new image for the optimiser, which is metered.
const ART_HOSTS = [
  // Deezer - Primary music source
  'e-cdns-images.dzcdn.net',
  'cdns-images.dzcdn.net',
  'cdn-images.dzcdn.net',

  // Apple Music
  'is1-ssl.mzstatic.com',
  'a1.mzstatic.com',
  'is2-ssl.mzstatic.com',
  'is3-ssl.mzstatic.com',
  'is4-ssl.mzstatic.com',
  'is5-ssl.mzstatic.com',

  // Discogs
  'img.discogs.com',
  'i.discogs.com',
  'a.discogs.com',
  'st.discogs.com',
];

// Next's inline bootstrap scripts need 'unsafe-inline' unless every page is rendered
// per request with a nonce, but this still stops anything loading from another site
// or sending data to one. Images are same-origin as next/image serves them all.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// next dev needs eval for fast refresh, so the policy only applies to real builds
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(isProduction ? [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }] : []),
        ],
      },
      {
        // Other sites' files are never treated as a page of ours. This comes last to override the above.
        source: '/api/image-proxy',
        headers: [{ key: 'Content-Security-Policy', value: "sandbox; default-src 'none'" }],
      },
    ];
  },
  images: {
    localPatterns: [{ pathname: '/api/image-proxy' }],
    remotePatterns: ART_HOSTS.map((hostname) => ({ protocol: 'https', hostname, pathname: '/**', search: '' })),
  },
};

export default nextConfig;
