import SearchBar from '@/components/SearchBar';
import Link from 'next/link';
import { ShieldCheckIcon, MusicalNoteIcon, HeartIcon } from '@heroicons/react/24/solid';
import { getAllBlogPosts } from '@/lib/blog';

export default function Home() {
  const blogPosts = getAllBlogPosts().slice(0, 3);
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="gradient-text">StreamToShelf</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Find Where to Buy Music – Downloads, CDs, Vinyl & More
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Search for any artist and discover legitimate stores selling their music
            in your preferred format. Support artists by buying their music!
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-20">
          <SearchBar />
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-8 bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg border border-blue-500/30">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheckIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-blue-100">Legitimate Stores Only</h3>
            <p className="text-blue-200/70">
              We only show results from official music stores and authorized retailers.
            </p>
          </div>

          <div className="text-center p-8 bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-lg border border-purple-500/30">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <MusicalNoteIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-purple-100">All Formats</h3>
            <p className="text-purple-200/70">
              Digital downloads, vinyl records, CDs, cassettes - find music in any format you love.
            </p>
          </div>

          <div className="text-center p-8 bg-gradient-to-br from-pink-900/30 to-pink-800/20 rounded-lg border border-pink-500/30">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <HeartIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-pink-100">Support Artists</h3>
            <p className="text-pink-200/70">
              Help artists earn from their work by purchasing music instead of just streaming.
            </p>
          </div>
        </div>

        {/* Blog Preview Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8">Learn More About Music Buying</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col items-center justify-center p-6 glass-effect rounded-lg transition-all duration-300 hover:scale-105 hover:-translate-y-1 relative overflow-hidden cursor-pointer min-h-48"
              >
                <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100"></div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-400 transition-colors relative z-10 text-center">
                  {post.title}
                </h3>
                <p className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors relative z-10 text-center">
                  {post.description}
                </p>
              </Link>
            ))}
          </div>
          <Link
            href="/blog"
            className="inline-block text-blue-400 hover:text-blue-300 transition-colors cursor-pointer font-semibold"
          >
            View all articles →
          </Link>
        </div>
      </div>
    </div>
  );
}
