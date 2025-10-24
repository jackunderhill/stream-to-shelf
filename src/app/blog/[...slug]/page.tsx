import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import { getBlogPost, getBlogPostSlugs } from '@/lib/blog';

interface BlogPostPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateStaticParams() {
  const slugs = getBlogPostSlugs();
  return slugs.map((slug) => ({
    slug: [slug],
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug[0];
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found – StreamToShelf',
    };
  }

  return {
    title: `${post.title} – StreamToShelf`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      url: `https://streamtoshelf.com/blog/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

const mdxComponents = {
  h1: (props: React.ComponentProps<'h1'>) => <h1 className="text-3xl font-bold mb-6" {...props} />,
  h2: (props: React.ComponentProps<'h2'>) => <h2 className="text-2xl font-semibold mb-4 mt-8" {...props} />,
  h3: (props: React.ComponentProps<'h3'>) => <h3 className="text-xl font-semibold mb-3 mt-6" {...props} />,
  p: (props: React.ComponentProps<'p'>) => <p className="mb-4 leading-relaxed" {...props} />,
  ul: (props: React.ComponentProps<'ul'>) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
  ol: (props: React.ComponentProps<'ol'>) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
  li: (props: React.ComponentProps<'li'>) => <li className="leading-relaxed" {...props} />,
  a: (props: React.ComponentProps<'a'>) => (
    <Link
      className="text-blue-400 hover:text-blue-300 underline transition-colors"
      {...props}
      href={props.href || ''}
    />
  ),
  blockquote: (props: React.ComponentProps<'blockquote'>) => (
    <blockquote
      className="border-l-4 border-blue-500 pl-4 italic text-gray-300 my-6"
      {...props}
    />
  ),
  code: (props: React.ComponentProps<'code'>) => (
    <code
      className="bg-gray-800 text-gray-200 px-2 py-1 rounded text-sm"
      {...props}
    />
  ),
  pre: (props: React.ComponentProps<'pre'>) => (
    <pre
      className="bg-gray-800 text-gray-200 p-4 rounded-lg overflow-x-auto mb-6"
      {...props}
    />
  ),
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug[0];
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Back to Home
            </Link>
          </nav>

          {/* Article Header */}
          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-gray-400 mb-6">
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
                      className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xl text-gray-300 leading-relaxed">{post.description}</p>
          </header>

          {/* Article Content */}
          <article className="prose prose-invert prose-lg max-w-none">
            <MDXRemote source={post.content} components={mdxComponents} />
          </article>

          {/* Call to Action */}
          <div className="mt-16 p-8 bg-gray-800 rounded-lg border border-gray-700 text-center">
            <h2 className="text-2xl font-bold mb-4">Start Searching for Music</h2>
            <p className="text-gray-300 mb-6">
              Ready to buy some music? Use our search to find where your favorite artists sell their work.
            </p>
            <Link
              href="/"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 inline-block"
            >
              Search Music Stores
            </Link>
          </div>
        </div>

        {/* Schema.org Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": post.title,
              "description": post.description,
              "datePublished": post.date,
              "dateModified": post.date,
              "author": {
                "@type": "Organization",
                "name": "StreamToShelf"
              },
              "publisher": {
                "@type": "Organization",
                "name": "StreamToShelf",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://streamtoshelf.com/logo.png"
                }
              },
              "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `https://streamtoshelf.com/blog/${slug}`
              }
            })
          }}
        />
      </div>
    </div>
  );
}