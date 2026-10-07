export function normalizePreviewBaseUrl(raw?: string): string {
  if (!raw || !raw.trim()) return 'http://localhost:5001';

  let trimmed = raw.trim().replace(/\/+$/, '');
  trimmed = trimmed.replace(/^(\*+\.?)*/, '').replace(/[*]/g, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('://')) return trimmed;
  return `https://${trimmed}`;
}

export function getPreviewBaseUrl(settings: any = {}, env: any = process.env): string {
  // 1. Explicit override via environment variables (e.g. PUBLIC_PREVIEW_BASE_URL)
  const explicitOverrides = [
    env?.PUBLIC_PREVIEW_BASE_URL,
    env?.PUBLIC_APP_URL,
    env?.APP_PUBLIC_URL,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of explicitOverrides) {
    const normalized = normalizePreviewBaseUrl(candidate);
    if (normalized) return normalized;
  }

  // 2. Custom Domain configured in Settings (e.g. "adeolamedia.co.uk")
  // MUST take priority over Render's default onrender.com so custom domain routing works
  const configuredDomain = String(settings?.baseDomain || '').trim();
  if (configuredDomain && !configuredDomain.toLowerCase().includes('localhost')) {
    return normalizePreviewBaseUrl(configuredDomain);
  }

  // 3. Fallback to Cloud Hosting Platform URL (e.g. Render external URL)
  const cloudPlatformUrls = [
    env?.RENDER_EXTERNAL_URL,
    env?.RENDER_SERVICE_URL,
    env?.BACKEND_PUBLIC_URL,
    env?.FRONTEND_PUBLIC_URL,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of cloudPlatformUrls) {
    const normalized = normalizePreviewBaseUrl(candidate);
    if (normalized) return normalized;
  }

  // 4. Localhost configured in settings or fallback
  if (configuredDomain) {
    return normalizePreviewBaseUrl(configuredDomain);
  }

  return 'http://localhost:5001';
}

export function getLeadPreviewUrl(lead: any, settings: any = {}, env: any = process.env): string {
  const leadIdentifier = String(lead?.id || lead?.subdomain || '').trim();
  if (!leadIdentifier) return '';

  const base = getPreviewBaseUrl(settings, env).replace(/\/+$/, '');
  return `${base}/demo/${leadIdentifier}`;
}

export function sanitizeDemoUrl(rawUrl: string | undefined, lead: any, settings: any = {}, env: any = process.env): string {
  const targetUrl = (rawUrl || '').replace(/[*_~`]/g, '').trim();

  // If already a clean /demo/ route on the current host, return it with proper protocol
  if (targetUrl.includes('/demo/')) {
    if (!/^https?:\/\//i.test(targetUrl)) {
      return `https://${targetUrl.replace(/^\/+/, '')}`;
    }
    return targetUrl;
  }

  // If it is an old subdomain link (e.g. https://slug.adeolamedia.co.uk) or blank,
  // sanitize it to the guaranteed direct preview URL:
  return getLeadPreviewUrl(lead, settings, env);
}
