import { ASSETS_BASE_URL, DEFAULT_PLACEHOLDER_IMAGE } from '../config/assets';

const IMAGEKIT_PREFIX = 'https://ik.imagekit.io/appraisily';
const IMAGEKIT_PREFIX_WITH_SLASH = `${IMAGEKIT_PREFIX}/`;

export function normalizeAssetUrl(input?: string | null): string {
  const url = String(input || '').trim();
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE;

  if (url.startsWith(ASSETS_BASE_URL)) return url;

  if (url.startsWith(IMAGEKIT_PREFIX_WITH_SLASH)) {
    return `${ASSETS_BASE_URL}/${url.slice(IMAGEKIT_PREFIX_WITH_SLASH.length)}`;
  }

  if (url === IMAGEKIT_PREFIX) return ASSETS_BASE_URL;

  if (url.startsWith('https://placehold.co')) return DEFAULT_PLACEHOLDER_IMAGE;

  if (url === '/placeholder-image.jpg') return DEFAULT_PLACEHOLDER_IMAGE;

  return url;
}

