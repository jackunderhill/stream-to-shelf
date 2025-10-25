import { useEffect } from 'react';

interface MetadataOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export function useMetadata({ title, description, image, url }: MetadataOptions) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper function to set or update a meta tag
    const setMetaTag = (property: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }

      element.content = content;
    };

    // Set basic meta tags
    setMetaTag('description', description);

    // Set Open Graph tags
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', 'website', true);

    if (image) {
      setMetaTag('og:image', image, true);
      setMetaTag('og:image:alt', title, true);
    }

    if (url) {
      setMetaTag('og:url', url, true);
    }

    // Set Twitter Card tags
    setMetaTag('twitter:card', image ? 'summary_large_image' : 'summary');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);

    if (image) {
      setMetaTag('twitter:image', image);
      setMetaTag('twitter:image:alt', title);
    }
  }, [title, description, image, url]);
}
