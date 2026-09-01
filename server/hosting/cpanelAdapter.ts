import axios from 'axios';
import https from 'https';
import { Settings } from '../db.js';
import { wildcardAdapter } from './wildcardAdapter.js';
import { DeployResult, HostingAdapter, SubdomainResult } from './types.js';

const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

export class CpanelAdapter implements HostingAdapter {
  private getHeaders(settings: Settings) {
    const user = settings.cpanelUser?.trim();
    const token = settings.cpanelApiToken?.trim();
    return {
      'Authorization': `cpanel ${user}:${token}`
    };
  }

  private getHostUrl(settings: Settings): string {
    let host = (settings.cpanelHost || '').trim();
    if (!host) return '';
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'https://' + host;
    }
    // Default cPanel port is 2083
    if (!host.includes(':2083') && !host.includes(':2082') && !host.includes('cpanel.')) {
      host = `${host}:2083`;
    }
    return host;
  }

  async createSubdomain(subdomain: string, settings: Settings): Promise<SubdomainResult> {
    const host = this.getHostUrl(settings);
    const user = settings.cpanelUser?.trim();
    const token = settings.cpanelApiToken?.trim();
    const baseDomain = (settings.baseDomain || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim();

    // If credentials are incomplete, fallback to local wildcard adapter to prevent pipeline crash
    if (!host || !user || !token || !baseDomain) {
      console.warn('[cPanel Adapter] Missing cPanel host, user, or token. Falling back to local wildcard storage.');
      return wildcardAdapter.createSubdomain(subdomain, settings);
    }

    try {
      const endpoint = `${host}/execute/SubDomain/addsubdomain`;
      const response = await axios.get(endpoint, {
        params: {
          domain: subdomain,
          rootdomain: baseDomain,
          dir: `public_html/${subdomain}`
        },
        headers: this.getHeaders(settings),
        httpsAgent: insecureHttpsAgent,
        timeout: 20000
      });

      const data = response.data;
      if (data.status === 1 || (data.errors && data.errors[0]?.includes('already exists'))) {
        const fullUrl = `https://${subdomain}.${baseDomain}`;
        return {
          success: true,
          subdomain,
          url: fullUrl,
          message: `cPanel subdomain ${subdomain}.${baseDomain} created successfully.`
        };
      } else {
        const errorMsg = data.errors ? data.errors.join(', ') : 'Unknown cPanel error';
        console.error('[cPanel Adapter] Subdomain creation failed:', errorMsg);
        return {
          success: false,
          subdomain,
          url: '',
          error: `cPanel Error: ${errorMsg}`
        };
      }
    } catch (err: any) {
      console.error('[cPanel Adapter] Request failed:', err.message);
      // Fallback to local
      console.warn('[cPanel Adapter] Falling back to local wildcard storage due to connection error.');
      return wildcardAdapter.createSubdomain(subdomain, settings);
    }
  }

  async deployWebsite(subdomain: string, html: string, settings: Settings): Promise<DeployResult> {
    // Also store locally for previewing
    await wildcardAdapter.deployWebsite(subdomain, html, settings);

    const host = this.getHostUrl(settings);
    const user = settings.cpanelUser?.trim();
    const token = settings.cpanelApiToken?.trim();
    const baseDomain = (settings.baseDomain || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim();

    if (!host || !user || !token || !baseDomain) {
      return wildcardAdapter.deployWebsite(subdomain, html, settings);
    }

    try {
      // Use cPanel Fileman save_file_content API with URL-encoded form data
      const endpoint = `${host}/execute/Fileman/save_file_content`;
      const form = new URLSearchParams();
      form.append('dir', `public_html/${subdomain}`);
      form.append('filename', 'index.html');
      form.append('content', html);

      const response = await axios.post(endpoint, form.toString(), {
        headers: {
          ...this.getHeaders(settings),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        httpsAgent: insecureHttpsAgent,
        timeout: 25000
      });

      if (response.data.status === 1) {
        const fullUrl = `https://${subdomain}.${baseDomain}`;
        return {
          success: true,
          url: fullUrl,
          message: `Website deployed to cPanel at ${fullUrl}`
        };
      } else {
        const errorMsg = response.data.errors ? response.data.errors.join(', ') : 'File upload failed';
        console.warn('[cPanel Adapter] Remote file upload failed:', errorMsg);
        return wildcardAdapter.deployWebsite(subdomain, html, settings);
      }
    } catch (err: any) {
      console.error('[cPanel Adapter] Deploy request failed:', err.message);
      return wildcardAdapter.deployWebsite(subdomain, html, settings);
    }
  }
}

export const cpanelAdapter = new CpanelAdapter();
