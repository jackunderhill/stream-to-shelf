'use client';

import { useState, useRef, useEffect } from 'react';
import { useArtistAutocomplete } from '@/hooks/useArtistAutocomplete';
import Image from 'next/image';

interface ArtistAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (artistName: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}

export default function ArtistAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Enter artist name...',
  required = false,
  maxLength = 100,
}: ArtistAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { suggestions, isLoading } = useArtistAutocomplete(value);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const showDropdown = isFocused && (suggestions.length > 0 || isLoading);

  const handleSelectSuggestion = (artistName: string) => {
    onChange(artistName);
    setIsFocused(false);
    if (onSelect) {
      onSelect(artistName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[selectedIndex].name);
        }
        break;
      case 'Escape':
        setIsFocused(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        ref={inputRef}
        id="artist"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        required={required}
        maxLength={maxLength}
        autoComplete="off"
      />

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-3 text-gray-400 text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Searching...</span>
            </div>
          )}

          {!isLoading && suggestions.length === 0 && value.length >= 2 && (
            <div className="px-4 py-3 text-gray-400 text-sm">
              No artists found
            </div>
          )}

          {!isLoading && suggestions.map((artist, index) => (
            <button
              key={artist.id}
              type="button"
              onClick={() => handleSelectSuggestion(artist.name)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-700 text-gray-200'
              }`}
            >
              {artist.imageUrl && (
                <Image
                  src={artist.imageUrl}
                  alt={artist.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              {!artist.imageUrl && (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <span className="font-medium">{artist.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
