export function sanitizeSubdomain(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[*_~`]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateSubdomainSlug(name: string, existingSlugs: string[] = []): string {
  if (!name) return 'demo-' + Math.random().toString(36).substring(2, 7);

  // Convert to lowercase, remove asterisks/markdown and trim
  let slug = name.toLowerCase().replace(/[*_~`]/g, '').trim();

  // Replace common business suffixes
  slug = slug.replace(/\b(inc|llc|ltd|co|corp|corporation|company|limited)\b/gi, '');

  // Replace non-alphanumeric characters with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Truncate to reasonable subdomain length (max 30 chars)
  if (slug.length > 30) {
    slug = slug.substring(0, 30).replace(/-+$/, '');
  }

  // Fallback if empty after sanitization
  if (!slug || slug.length < 2) {
    slug = 'demo-' + Math.random().toString(36).substring(2, 7);
  }

  // If slug already exists, append a short random hash to prevent collisions
  if (existingSlugs.includes(slug)) {
    const suffix = Math.random().toString(36).substring(2, 5);
    slug = `${slug.substring(0, 26)}-${suffix}`;
  }

  return sanitizeSubdomain(slug);
}
