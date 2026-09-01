import { Settings } from '../db.js';

export interface SubdomainResult {
  success: boolean;
  subdomain: string;
  url: string;
  message?: string;
  error?: string;
}

export interface DeployResult {
  success: boolean;
  url: string;
  message?: string;
  error?: string;
}

export interface HostingAdapter {
  createSubdomain(subdomain: string, settings: Settings): Promise<SubdomainResult>;
  deployWebsite(subdomain: string, html: string, settings: Settings): Promise<DeployResult>;
}
