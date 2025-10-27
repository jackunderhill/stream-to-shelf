import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { KofiSupport } from "@/components/KofiSupport";
import { SearchPreviewProvider } from "@/contexts/SearchPreviewContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "StreamToShelf – Find Where to Buy Music",
  description: "Find Where to Buy Music – Downloads, CDs, Vinyl & More. Search for any artist and discover legitimate stores selling their music in your preferred format.",
  keywords: "buy music, vinyl records, CD, digital downloads, music store, artist search",
  authors: [{ name: "StreamToShelf" }],
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://stream-to-shelf.vercel.app",
    siteName: "StreamToShelf",
    title: "StreamToShelf – Find Where to Buy Music",
    description: "Find Where to Buy Music – Downloads, CDs, Vinyl & More",
  },
  twitter: {
    card: "summary_large_image",
    site: "@streamtoshelf",
    title: "StreamToShelf – Find Where to Buy Music",
    description: "Find Where to Buy Music – Downloads, CDs, Vinyl & More",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "StreamToShelf",
              "description": "Find Where to Buy Music – Downloads, CDs, Vinyl & More",
              "url": process.env.NEXT_PUBLIC_SITE_URL || "https://stream-to-shelf.vercel.app",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || "https://stream-to-shelf.vercel.app"}/search?artist={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>
      <body className={`font-sans antialiased bg-gray-900 text-white min-h-screen`}>
        <SearchPreviewProvider>
          <header className="border-b border-gray-800">
            <div className="container mx-auto px-4 py-4">
              <h1 className="text-2xl font-bold">
                <Link href="/" className="text-white hover:text-gray-300 transition-colors">
                  StreamToShelf
                </Link>
              </h1>
            </div>
          </header>
          <main>{children}</main>
          <KofiSupport />
        </SearchPreviewProvider>
        <Analytics />
      </body>
    </html>
  );
}
