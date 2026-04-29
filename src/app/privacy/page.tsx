import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">
          <span className="gradient-text">Privacy Policy</span>
        </h1>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">What We Collect</h2>
            <p className="mb-4">
              StreamToShelf does not collect or store any personal data. We do not require you to
              create an account or log in to use the service.
            </p>
            <p>
              Search queries you enter (artist and album names) are used only to fetch results
              from third-party music APIs and are not stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Third-Party Services</h2>
            <p className="mb-4">We use the following third-party services to power search results:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Deezer API</strong> — artist and album search</li>
              <li><strong className="text-white">Odesli / song.link</strong> — resolving purchase links across platforms</li>
              <li><strong className="text-white">Discogs API</strong> — physical media links</li>
              <li><strong className="text-white">Vercel Analytics</strong> — anonymous page view statistics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Cookies</h2>
            <p>
              We do not use tracking or advertising cookies. Vercel Analytics may set cookies for
              anonymous analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Contact</h2>
            <p>
              If you have questions about this privacy policy, please visit our{' '}
              <Link href="/" className="text-blue-400 hover:underline">
                homepage
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
