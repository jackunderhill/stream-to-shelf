import React from 'react';
import { render, screen } from '@testing-library/react';
import PlatformIcon from '@/components/PlatformIcon';

describe('PlatformIcon Component', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<PlatformIcon platform="itunes" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render with correct color for each platform', () => {
      const platforms = [
        { platform: 'itunes', color: 'text-pink-400' },
        { platform: 'amazonStore', color: 'text-orange-400' },
        { platform: 'amazonDigital', color: 'text-orange-400' },
        { platform: 'amazonPhysical', color: 'text-orange-400' },
        { platform: 'bandcamp', color: 'text-cyan-400' },
        { platform: 'googleStore', color: 'text-blue-400' },
        { platform: 'discogs', color: 'text-purple-400' },
        { platform: 'hdtracks', color: 'text-green-400' },
      ];

      platforms.forEach(({ platform, color }) => {
        const { container } = render(<PlatformIcon platform={platform} />);
        const iconDiv = container.querySelector('.w-16.h-16');
        expect(iconDiv).toHaveClass(color);
      });
    });

    it('should render default color for unknown platform', () => {
      const { container } = render(<PlatformIcon platform="unknownPlatform" />);
      const iconDiv = container.querySelector('.w-16.h-16');
      expect(iconDiv).toHaveClass('text-gray-400');
    });
  });

  describe('Icon Selection', () => {
    it('should render SVG icon for Amazon platforms', () => {
      const amazonPlatforms = ['amazonStore', 'amazonDigital', 'amazonPhysical'];

      amazonPlatforms.forEach(platform => {
        const { container } = render(<PlatformIcon platform={platform} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg?.querySelector('path')).toBeInTheDocument();
      });
    });

    it('should render SVG icon for music platforms', () => {
      const musicPlatforms = ['itunes', 'bandcamp', 'hdtracks'];

      musicPlatforms.forEach(platform => {
        const { container } = render(<PlatformIcon platform={platform} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg?.querySelector('path')).toBeInTheDocument();
      });
    });

    it('should render SVG icon for store platforms', () => {
      const storePlatforms = ['googleStore', 'discogs'];

      storePlatforms.forEach(platform => {
        const { container } = render(<PlatformIcon platform={platform} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg?.querySelector('path')).toBeInTheDocument();
      });
    });

    it('should render SVG icon for unknown platforms', () => {
      const { container } = render(<PlatformIcon platform="unknownPlatform" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.querySelector('path')).toBeInTheDocument();
    });
  });

  describe('SVG Attributes', () => {
    it('should have correct SVG attributes', () => {
      const { container } = render(<PlatformIcon platform="itunes" />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-full', 'h-full');
      expect(svg).toHaveAttribute('viewBox');
    });

    it('should have path element', () => {
      const { container } = render(<PlatformIcon platform="itunes" />);
      const path = container.querySelector('path');

      expect(path).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have correct container dimensions', () => {
      const { container } = render(<PlatformIcon platform="itunes" />);
      const iconDiv = container.querySelector('.w-16.h-16');

      expect(iconDiv).toHaveClass('w-16');
      expect(iconDiv).toHaveClass('h-16');
      expect(iconDiv).toHaveClass('mb-3');
    });

    it('should apply color classes correctly', () => {
      const { container } = render(<PlatformIcon platform="itunes" />);
      const iconDiv = container.querySelector('div');

      expect(iconDiv?.className).toContain('text-pink-400');
    });
  });

  describe('Accessibility', () => {
    it('should render SVG as decorative element', () => {
      const { container } = render(<PlatformIcon platform="itunes" />);
      const svg = container.querySelector('svg');

      // SVG should not have role="img" or aria-label since it's decorative
      // The parent link/button should provide the accessible name
      expect(svg).not.toHaveAttribute('aria-label');
      expect(svg).not.toHaveAttribute('role');
    });
  });

  describe('Platform Coverage', () => {
    it('should handle all supported platforms', () => {
      const supportedPlatforms = [
        'itunes',
        'amazonStore',
        'amazonDigital',
        'amazonPhysical',
        'bandcamp',
        'googleStore',
        'discogs',
        'hdtracks',
      ];

      supportedPlatforms.forEach(platform => {
        const { container } = render(<PlatformIcon platform={platform} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });
});
