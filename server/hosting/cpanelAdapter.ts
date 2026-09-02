import axios from 'axios';
import https from 'https';
import { Settings } from '../db.js';
import { wildcardAdapter } from './wildcardAdapter.js';
import { DeployResult, HostingAdapter, SubdomainResult } from './types.js';

const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

export class CpanelAdapter implements HostingAdapter {
  private getHostUrl(settings: Settings): string {
    let host = (settings.cpanelHost || '').trim();
    if (!host) return '';
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'https://' + host;
    }
    host = host.replace(/\/+$/, '');
    // Default cPanel port is 2083
    if (!host.includes(':2083') && !host.includes(':2082') && !host.includes('cpanel.')) {
      host = `${host}:2083`;
    }
    return host.replace(/\/+$/, '');
  }

  private async executeUapi(endpoint: string, method: 'GET' | 'POST', dataOrParams: any, settings: Settings, isForm = false) {
    const user = (settings.cpanelUser || '').trim();
    const token = (settings.cpanelApiToken || '').trim();

    // 1. Try standard cPanel API Token authorization
    try {
      const config: any = {
        headers: {
          'Authorization': `cpanel ${user}:${token}`
        },
        httpsAgent: insecureHttpsAgent,
        timeout: 25000
      };
      if (isForm) {
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      if (method === 'GET') {
        config.params = dataOrParams;
        return await axios.get(endpoint, config);
      } else {
        return await axios.post(endpoint, dataOrParams, config);
      }
    } catch (apiErr: any) {
      // 2. If 401 or 403, fallback to Basic Auth in case the user entered their cPanel password
      if (apiErr.response?.status === 401 || apiErr.response?.status === 403) {
        const basicAuth = Buffer.from(`${user}:${token}`).toString('base64');
        const config: any = {
          headers: {
            'Authorization': `Basic ${basicAuth}`
          },
          httpsAgent: insecureHttpsAgent,
          timeout: 25000
        };
        if (isForm) {
          config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        if (method === 'GET') {
          config.params = dataOrParams;
          return await axios.get(endpoint, config);
        } else {
          return await axios.post(endpoint, dataOrParams, config);
        }
      }
      throw apiErr;
    }
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
      const response = await this.executeUapi(endpoint, 'GET', {
        domain: subdomain,
        rootdomain: baseDomain,
        dir: `public_html/${subdomain}`
      }, settings);

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

      const response = await this.executeUapi(endpoint, 'POST', form.toString(), settings, true);

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
