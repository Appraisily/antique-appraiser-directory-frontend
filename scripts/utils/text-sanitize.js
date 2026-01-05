const MAX_TEXT_LENGTH = 2000;

export function sanitizePlainText(input) {
  if (input === null || input === undefined) return '';
  let text = String(input);

  // Remove any model/tool artifacts that sometimes leak into datasets.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ' ');

  // Convert common Markdown to plain text.
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1'); // [text](url) -> text
  text = text.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
  text = text.replace(/#{1,6}\s+/g, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // Strip citation-like footnotes and arrows.
  text = text.replace(/\[[^\]]{0,40}\]/g, ' ');
  text = text.replace(/[→]+/g, ' ');

  // Drop raw URLs (we keep links separately in structured fields).
  text = text.replace(/https?:\/\/\S+/g, ' ');

  // Collapse whitespace.
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length > MAX_TEXT_LENGTH) {
    text = `${text.slice(0, MAX_TEXT_LENGTH - 1).trimEnd()}…`;
  }

  return text;
}

export function truncateText(input, max = 160) {
  const text = sanitizePlainText(input);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function isLikelyPlaceholderUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'example.com') return true;
    if (host.includes('example')) return true;
    if (host.includes('placehold')) return true;
    if (host.includes('examplelink')) return true;
    if (host.includes('downtown') && host.endsWith('.com')) return true;
    return false;
  } catch {
    return true;
  }
}

export function normalizeWebsiteUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export function detectCountryFromRegion(region) {
  const normalized = String(region || '').trim().toLowerCase();
  if (!normalized) return 'US';

  const canadian = new Set([
    'ab',
    'bc',
    'mb',
    'nb',
    'nl',
    'ns',
    'nt',
    'nu',
    'on',
    'pe',
    'qc',
    'sk',
    'yt',
    'alberta',
    'british columbia',
    'manitoba',
    'new brunswick',
    'newfoundland and labrador',
    'nova scotia',
    'northwest territories',
    'nunavut',
    'ontario',
    'prince edward island',
    'quebec',
    'saskatchewan',
    'yukon',
    // Non-standard codes found in earlier exports.
    'br',
    'qu',
  ]);

  if (canadian.has(normalized)) return 'CA';
  return 'US';
}

export function regionNameToCode(regionName) {
  const name = String(regionName || '').trim().toLowerCase();
  if (!name) return '';

  const ca = {
    alberta: 'AB',
    'british columbia': 'BC',
    manitoba: 'MB',
    'new brunswick': 'NB',
    'newfoundland and labrador': 'NL',
    'nova scotia': 'NS',
    'northwest territories': 'NT',
    nunavut: 'NU',
    ontario: 'ON',
    'prince edward island': 'PE',
    quebec: 'QC',
    saskatchewan: 'SK',
    yukon: 'YT',
  };

  const us = {
    alabama: 'AL',
    alaska: 'AK',
    arizona: 'AZ',
    arkansas: 'AR',
    california: 'CA',
    colorado: 'CO',
    connecticut: 'CT',
    delaware: 'DE',
    florida: 'FL',
    georgia: 'GA',
    hawaii: 'HI',
    idaho: 'ID',
    illinois: 'IL',
    indiana: 'IN',
    iowa: 'IA',
    kansas: 'KS',
    kentucky: 'KY',
    louisiana: 'LA',
    maine: 'ME',
    maryland: 'MD',
    massachusetts: 'MA',
    michigan: 'MI',
    minnesota: 'MN',
    mississippi: 'MS',
    missouri: 'MO',
    montana: 'MT',
    nebraska: 'NE',
    nevada: 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    ohio: 'OH',
    oklahoma: 'OK',
    oregon: 'OR',
    pennsylvania: 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    tennessee: 'TN',
    texas: 'TX',
    utah: 'UT',
    vermont: 'VT',
    virginia: 'VA',
    washington: 'WA',
    'west virginia': 'WV',
    wisconsin: 'WI',
    wyoming: 'WY',
    'district of columbia': 'DC',
  };

  return ca[name] || us[name] || '';
}

export function normalizeRegionCode(region) {
  const raw = String(region || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper === 'BR') return 'BC';
  if (upper === 'QU') return 'QC';
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return regionNameToCode(raw);
}

export function extractKeywordPhrases(values, limit = 4) {
  const joined = Array.isArray(values) ? values.join(', ') : String(values || '');
  const cleaned = sanitizePlainText(joined);
  if (!cleaned) return [];
  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s+/g, ' '))
    .filter((part) => part.length >= 3 && part.length <= 60);
  const unique = [...new Set(parts)];
  return unique.slice(0, Math.max(0, limit));
}

export function looksLikeAiJunk(input) {
  const text = String(input || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('<think') ||
    text.includes('needto ensure') ||
    text.includes('did i miss') ||
    text.includes('examplelink') ||
    text.includes('source') ||
    text.includes('→') ||
    /\[\d/.test(text)
  );
}

