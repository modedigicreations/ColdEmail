import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Settings } from '../db.js';
import { DeployResult, HostingAdapter, SubdomainResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getSitesDir(): string {
  const serverRoot = __dirname.includes('dist') 
    ? path.join(__dirname, '..', '..') 
    : path.join(__dirname, '..');

  const candidate1 = path.join(process.cwd(), 'public', 'sites');
  const candidate2 = path.join(serverRoot, 'public', 'sites');

  const sitesDir = fs.existsSync(candidate1) ? candidate1 : candidate2;
  if (!fs.existsSync(sitesDir)) {
    fs.mkdirSync(sitesDir, { recursive: true });
  }
  return sitesDir;
}

export class WildcardAdapter implements HostingAdapter {
  async createSubdomain(subdomain: string, settings: Settings): Promise<SubdomainResult> {
    try {
      const sitesDir = getSitesDir();
      const subDir = path.join(sitesDir, subdomain);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }

      const cleanSub = subdomain.replace(/[*_~`]/g, '').trim();
      const baseDomain = settings.baseDomain || 'demo.modedigicreations.com';
      const cleanBase = baseDomain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/^(\*+\.?)*/, '')
        .replace(/[*]/g, '')
        .trim();
      const fullUrl = `https://${cleanSub}.${cleanBase}`;

      return {
        success: true,
        subdomain: cleanSub,
        url: fullUrl,
        message: `Subdomain allocated: ${cleanSub}.${cleanBase}`
      };
    } catch (err: any) {
      return {
        success: false,
        subdomain: subdomain.replace(/[*_~`]/g, '').trim(),
        url: '',
        error: `Failed to create local subdomain directory: ${err.message}`
      };
    }
  }

  async deployWebsite(subdomain: string, html: string, settings: Settings): Promise<DeployResult> {
    try {
      const cleanSub = subdomain.replace(/[*_~`]/g, '').trim();
      const sitesDir = getSitesDir();
      const subDir = path.join(sitesDir, cleanSub);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }

      const indexPath = path.join(subDir, 'index.html');
      fs.writeFileSync(indexPath, html, 'utf-8');

      const baseDomain = settings.baseDomain || 'demo.modedigicreations.com';
      const cleanBase = baseDomain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/^(\*+\.?)*/, '')
        .replace(/[*]/g, '')
        .trim();
      const fullUrl = `https://${cleanSub}.${cleanBase}`;

      return {
        success: true,
        url: fullUrl,
        message: `Website successfully deployed to ${fullUrl}`
      };
    } catch (err: any) {
      return {
        success: false,
        url: '',
        error: `Failed to deploy website: ${err.message}`
      };
    }
  }
}

export const wildcardAdapter = new WildcardAdapter();
