const TEMPLATED_PRICING = new Set([
  'Initial consultation from $150; comprehensive reports quoted per project.',
  'Desktop valuations start at $95 per item; onsite work billed hourly.',
  'Museum-grade reports from $325; collection reviews offered with custom estimates.',
  'Express photo appraisal $175; full USPAP-compliant documentation priced individually.',
  'Estate packages begin at $450 and include research, inspection, and documentation.',
  'Single-item opinions from $125; multi-piece engagements receive tailored pricing.',
  'Project-based'
]);

const TEMPLATED_EXPERIENCE = new Set([
  'Founded in 2004 with two decades of appraisal expertise.',
  '15+ years providing certified antique valuations nationwide.',
  'Established in 2010 and trusted for museum-quality reporting.',
  'Serving collectors since 2007 with USPAP-compliant analyses.',
  'Over 18 years assisting estates, insurers, and private collectors.',
  'Established firm with more than 12 years of specialized appraisal practice.',
  'Established business'
]);

export function isTemplatedPricing(value: string | undefined | null): boolean {
  if (!value) return false;
  return TEMPLATED_PRICING.has(value.trim());
}

export function isTemplatedExperience(value: string | undefined | null): boolean {
  if (!value) return false;
  return TEMPLATED_EXPERIENCE.has(value.trim());
}

export function hasPlaceholderName(name: string | undefined | null): boolean {
  if (!name) return false;
  return /^\[.*\]$/.test(name.trim());
}

export function isTemplatedNotes(notes: string | undefined | null, city: string | undefined | null): boolean {
  if (!notes) return false;
  if (notes.includes('Serving the') && notes.includes('area with professional antique appraisal services.')) {
    return true;
  }
  if (city) {
    const cityPattern = `Serving the ${city}`;
    if (notes.startsWith(cityPattern) && notes.endsWith('area with professional antique appraisal services.')) {
      return true;
    }
  }
  return false;
}

export function isPlaceholderAbout(about: string | undefined | null): boolean {
  if (!about) return false;
  return about.includes('[') && about.includes(']');
}
