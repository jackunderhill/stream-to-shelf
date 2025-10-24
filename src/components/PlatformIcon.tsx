import {
  ShoppingBagIcon,
  MusicalNoteIcon,
  GlobeAltIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';

export default function PlatformIcon({ platform }: { platform: string }) {
  // Map platforms to Hero Icons
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    itunes: MusicalNoteIcon,
    amazonStore: ShoppingCartIcon,
    amazonDigital: ShoppingCartIcon,
    amazonPhysical: ShoppingCartIcon,
    bandcamp: MusicalNoteIcon,
    googleStore: ShoppingBagIcon,
    discogs: ShoppingBagIcon,
    hdtracks: MusicalNoteIcon,
  };

  const Icon = iconMap[platform] || GlobeAltIcon;

  // Different colors for different platforms
  const colorMap: Record<string, string> = {
    itunes: 'text-pink-400',
    amazonStore: 'text-orange-400',
    amazonDigital: 'text-orange-400',
    amazonPhysical: 'text-orange-400',
    bandcamp: 'text-cyan-400',
    googleStore: 'text-blue-400',
    discogs: 'text-purple-400',
    hdtracks: 'text-green-400',
  };

  const color = colorMap[platform] || 'text-gray-400';

  return (
    <div className={`w-16 h-16 mb-3 ${color}`}>
      <Icon className="w-full h-full" />
    </div>
  );
}
