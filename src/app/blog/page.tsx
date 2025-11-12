import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/blog';

export default function BlogIndex() {
  const posts = getAllBlogPosts();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              ← Back to Home
            </Link>
          </nav>

          {/* Page Header */}
          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Music Buying Blog</h1>
            <p className="text-xl text-gray-300">
              Explore our guides and insights about music ownership, buying formats, and supporting artists.
            </p>
          </header>

          {/* Blog Posts List */}
          {posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="bg-gray-800/50 rounded-lg p-6 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      {post.tags.length > 0 && (
                        <div className="flex gap-2">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group cursor-pointer"
                    >
                      <h2 className="text-2xl font-bold group-hover:text-blue-400 transition-colors">
                        {post.title}
                      </h2>
                    </Link>
                    <p className="text-gray-300 leading-relaxed">{post.description}</p>
                    <div className="mt-2">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer font-semibold"
                      >
                        Read more →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No blog posts yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
