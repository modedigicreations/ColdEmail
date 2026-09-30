import axios from 'axios';
import { Settings } from '../db.js';
import { wildcardAdapter } from './wildcardAdapter.js';
import { DeployResult, HostingAdapter, SubdomainResult } from './types.js';

export class CloudflareAdapter implements HostingAdapter {
  async createSubdomain(subdomain: string, settings: Settings): Promise<SubdomainResult> {
    const token = settings.cloudflareApiToken?.trim();
    const zoneId = settings.cloudflareZoneId?.trim();
    const cleanSub = subdomain.replace(/[*_~`]/g, '').trim();
    const baseDomain = (settings.baseDomain || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/^(\*+\.?)*/, '')
      .replace(/[*]/g, '')
      .trim();

    // Store local folder too
    await wildcardAdapter.createSubdomain(cleanSub, settings);

    if (!token || !zoneId || !baseDomain) {
      console.warn('[Cloudflare Adapter] Missing API token or Zone ID. Falling back to local wildcard.');
      return wildcardAdapter.createSubdomain(cleanSub, settings);
    }

    try {
      const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
      const response = await axios.post(endpoint, {
        type: 'CNAME',
        name: `${cleanSub}.${baseDomain}`,
        content: baseDomain,
        ttl: 1, // Auto
        proxied: true
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.success) {
        const fullUrl = `https://${cleanSub}.${baseDomain}`;
        return {
          success: true,
          subdomain: cleanSub,
          url: fullUrl,
          message: `Cloudflare DNS record created for ${cleanSub}.${baseDomain}`
        };
      } else {
        const errorMsg = response.data.errors?.map((e: any) => e.message).join(', ') || 'Unknown Cloudflare error';
        console.error('[Cloudflare Adapter] Subdomain creation error:', errorMsg);
        return wildcardAdapter.createSubdomain(subdomain, settings);
      }
    } catch (err: any) {
      console.error('[Cloudflare Adapter] Request failed:', err.message);
      return wildcardAdapter.createSubdomain(subdomain, settings);
    }
  }

  async deployWebsite(subdomain: string, html: string, settings: Settings): Promise<DeployResult> {
    // Cloudflare DNS points to the base server/host, so deploying the static files to the server's public sites path
    return wildcardAdapter.deployWebsite(subdomain, html, settings);
  }
}

export const cloudflareAdapter = new CloudflareAdapter();
