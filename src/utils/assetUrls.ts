import { ASSET_HOST, DEFAULT_PLACEHOLDER_IMAGE } from '../config/assets';

export function normalizeAssetUrl(input?: string | null): string {
  const url = String(input || '').trim();
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE;

  if (url.startsWith('https://placehold.co')) return DEFAULT_PLACEHOLDER_IMAGE;

  if (url === '/placeholder-image.jpg') return DEFAULT_PLACEHOLDER_IMAGE;

  if (url.startsWith(`${ASSET_HOST}/`) || url.startsWith('/')) return url;

  return DEFAULT_PLACEHOLDER_IMAGE;
}
