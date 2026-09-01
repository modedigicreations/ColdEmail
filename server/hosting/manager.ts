import { Lead, Settings } from '../db.js';
import { generateSubdomainSlug } from './slugify.js';
import { wildcardAdapter } from './wildcardAdapter.js';
import { cpanelAdapter } from './cpanelAdapter.js';
import { cloudflareAdapter } from './cloudflareAdapter.js';
import { DeployResult, SubdomainResult } from './types.js';

export async function createLeadSubdomain(lead: Lead, settings: Settings): Promise<SubdomainResult> {
  const slug = lead.subdomain || generateSubdomainSlug(lead.name);
  const provider = settings.hostingProvider || 'wildcard';

  switch (provider) {
    case 'cpanel':
      return cpanelAdapter.createSubdomain(slug, settings);
    case 'cloudflare':
      return cloudflareAdapter.createSubdomain(slug, settings);
    case 'wildcard':
    default:
      return wildcardAdapter.createSubdomain(slug, settings);
  }
}

export async function deployLeadWebsite(subdomain: string, html: string, settings: Settings): Promise<DeployResult> {
  const provider = settings.hostingProvider || 'wildcard';

  switch (provider) {
    case 'cpanel':
      return cpanelAdapter.deployWebsite(subdomain, html, settings);
    case 'cloudflare':
      return cloudflareAdapter.deployWebsite(subdomain, html, settings);
    case 'wildcard':
    default:
      return wildcardAdapter.deployWebsite(subdomain, html, settings);
  }
}
