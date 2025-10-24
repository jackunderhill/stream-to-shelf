import { Region } from '@/types';

/**
 * Maps language codes to supported regions
 */
const LANGUAGE_TO_REGION: Record<string, Region> = {
  'en-US': 'US',
  'en-GB': 'GB',
  'en-CA': 'CA',
  'en-AU': 'AU',
  'de': 'DE',
  'de-DE': 'DE',
  'de-AT': 'DE',
  'de-CH': 'DE',
  'fr': 'FR',
  'fr-FR': 'FR',
  'fr-CA': 'CA',
  'fr-BE': 'FR',
  'fr-CH': 'FR',
  'ja': 'JP',
  'ja-JP': 'JP',
};

/**
 * Detects the user's region based on navigator.language
 * Falls back to US if the language is not mapped to a supported region
 */
export function detectRegion(): Region {
  if (typeof navigator === 'undefined') {
    return 'US'; // Server-side default
  }

  const language = navigator.language;

  // Try exact match first
  if (language in LANGUAGE_TO_REGION) {
    return LANGUAGE_TO_REGION[language];
  }

  // Try matching just the language code (e.g., 'en' from 'en-NZ')
  const languageCode = language.split('-')[0];
  if (languageCode in LANGUAGE_TO_REGION) {
    return LANGUAGE_TO_REGION[languageCode];
  }

  // Special handling for English variants
  if (languageCode === 'en') {
    // Check country code
    const parts = language.split('-');
    if (parts.length > 1) {
      const countryCode = parts[1].toUpperCase();
      if (countryCode === 'GB' || countryCode === 'UK') return 'GB';
      if (countryCode === 'CA') return 'CA';
      if (countryCode === 'AU') return 'AU';
    }
    // Default English to US
    return 'US';
  }

  // Default fallback
  return 'US';
}
