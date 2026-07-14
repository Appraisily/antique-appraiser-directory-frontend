import { ASSET_HOST, DEFAULT_PLACEHOLDER_IMAGE } from '../config/assets';

export function normalizeAssetUrl(input?: string | null): string {
  const url = String(input || '').trim();
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE;

  if (url.startsWith('https://placehold.co')) return DEFAULT_PLACEHOLDER_IMAGE;

  if (url === '/placeholder-image.jpg') return DEFAULT_PLACEHOLDER_IMAGE;

  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.origin === new URL(ASSET_HOST).origin) return url;
  } catch {
    // Malformed values use the intentional first-party placeholder.
  }

  return DEFAULT_PLACEHOLDER_IMAGE;
}
