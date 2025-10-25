import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'StreamToShelf';
    const artist = searchParams.get('artist') || '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111827',
            backgroundImage: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          }}
        >
          {/* Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 60,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: 'white',
                textAlign: 'center',
                marginBottom: 20,
                maxWidth: 900,
                lineHeight: 1.2,
              }}
            >
              {title}
            </div>

            {/* Artist */}
            {artist && (
              <div
                style={{
                  fontSize: 36,
                  color: '#9ca3af',
                  textAlign: 'center',
                  marginBottom: 30,
                }}
              >
                {artist}
              </div>
            )}

            {/* Subtitle */}
            <div
              style={{
                fontSize: 28,
                color: '#6b7280',
                textAlign: 'center',
                marginTop: 20,
              }}
            >
              Find where to buy • StreamToShelf
            </div>
          </div>

          {/* Logo/Branding at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              🎵
            </div>
            <div
              style={{
                fontSize: 24,
                color: '#9ca3af',
                fontWeight: 600,
              }}
            >
              StreamToShelf
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Error generating OG image:', errorMessage);
    return new Response(`Failed to generate image: ${errorMessage}`, { status: 500 });
  }
}
