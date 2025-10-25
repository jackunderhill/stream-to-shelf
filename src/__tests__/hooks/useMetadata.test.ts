import { renderHook } from '@testing-library/react';
import { useMetadata } from '@/hooks/useMetadata';

describe('useMetadata', () => {
  beforeEach(() => {
    // Clear all meta tags before each test
    document.head.innerHTML = '';
    document.title = '';
  });

  it('should set the document title', () => {
    renderHook(() =>
      useMetadata({
        title: 'Test Title',
        description: 'Test Description',
      })
    );

    expect(document.title).toBe('Test Title');
  });

  it('should set meta description tag', () => {
    renderHook(() =>
      useMetadata({
        title: 'Test Title',
        description: 'Test Description',
      })
    );

    const descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(descriptionTag).toBeTruthy();
    expect(descriptionTag?.content).toBe('Test Description');
  });

  it('should set Open Graph meta tags', () => {
    renderHook(() =>
      useMetadata({
        title: 'Test Album by Test Artist',
        description: 'Test album description',
        image: 'https://example.com/image.jpg',
        url: 'https://example.com/album',
      })
    );

    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    const ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
    const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    const ogImageAlt = document.querySelector('meta[property="og:image:alt"]') as HTMLMetaElement;
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
    const ogType = document.querySelector('meta[property="og:type"]') as HTMLMetaElement;

    expect(ogTitle?.content).toBe('Test Album by Test Artist');
    expect(ogDescription?.content).toBe('Test album description');
    expect(ogImage?.content).toBe('https://example.com/image.jpg');
    expect(ogImageAlt?.content).toBe('Test Album by Test Artist');
    expect(ogUrl?.content).toBe('https://example.com/album');
    expect(ogType?.content).toBe('website');
  });

  it('should set Twitter Card meta tags', () => {
    renderHook(() =>
      useMetadata({
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg',
      })
    );

    const twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement;
    const twitterTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement;
    const twitterDescription = document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement;
    const twitterImage = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement;
    const twitterImageAlt = document.querySelector('meta[name="twitter:image:alt"]') as HTMLMetaElement;

    expect(twitterCard?.content).toBe('summary_large_image');
    expect(twitterTitle?.content).toBe('Test Title');
    expect(twitterDescription?.content).toBe('Test Description');
    expect(twitterImage?.content).toBe('https://example.com/image.jpg');
    expect(twitterImageAlt?.content).toBe('Test Title');
  });

  it('should use summary card when no image is provided', () => {
    renderHook(() =>
      useMetadata({
        title: 'Test Title',
        description: 'Test Description',
      })
    );

    const twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement;
    expect(twitterCard?.content).toBe('summary');

    const ogImage = document.querySelector('meta[property="og:image"]');
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    expect(ogImage).toBeNull();
    expect(twitterImage).toBeNull();
  });

  it('should update meta tags when metadata changes', () => {
    const { rerender } = renderHook(
      ({ title, description }) => useMetadata({ title, description }),
      {
        initialProps: {
          title: 'Initial Title',
          description: 'Initial Description',
        },
      }
    );

    expect(document.title).toBe('Initial Title');

    rerender({
      title: 'Updated Title',
      description: 'Updated Description',
    });

    expect(document.title).toBe('Updated Title');
    const descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(descriptionTag?.content).toBe('Updated Description');
  });

  it('should handle missing optional parameters', () => {
    renderHook(() =>
      useMetadata({
        title: 'Test Title',
        description: 'Test Description',
      })
    );

    const ogUrl = document.querySelector('meta[property="og:url"]');
    expect(ogUrl).toBeNull();
  });

  it('should create new meta tags if they do not exist', () => {
    const initialMetaCount = document.head.querySelectorAll('meta').length;

    renderHook(() =>
      useMetadata({
        title: 'Test Title',
        description: 'Test Description',
        image: 'https://example.com/image.jpg',
        url: 'https://example.com/page',
      })
    );

    const finalMetaCount = document.head.querySelectorAll('meta').length;
    expect(finalMetaCount).toBeGreaterThan(initialMetaCount);
  });

  it('should update existing meta tags instead of creating duplicates', () => {
    // First render
    const { rerender } = renderHook(
      ({ title }) => useMetadata({ title, description: 'Description' }),
      { initialProps: { title: 'First Title' } }
    );

    const firstCount = document.head.querySelectorAll('meta[property="og:title"]').length;
    expect(firstCount).toBe(1);

    // Update with new title
    rerender({ title: 'Second Title' });

    const secondCount = document.head.querySelectorAll('meta[property="og:title"]').length;
    expect(secondCount).toBe(1); // Should still be 1, not 2

    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    expect(ogTitle?.content).toBe('Second Title');
  });
});
