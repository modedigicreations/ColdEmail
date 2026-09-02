import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(process.cwd(), 'db.json');

export interface Lead {
  id: string;
  name: string;
  category?: string;
  email?: string;
  website?: string;
  phone?: string;
  seoScore?: number;
  gmbRating?: number;
  seoIssues?: string[];
  crawledText?: string;
  subdomain?: string;
  demoSiteUrl?: string;
  demoSiteHtml?: string;
  siteStatus?: 'not_started' | 'subdomain_created' | 'building' | 'deployed' | 'failed';
  emailDraft?: string;
  status: 'not_started' | 'crawled' | 'site_ready' | 'drafted' | 'sending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
}

export interface Settings {
  aiProvider: 'claude' | 'deepseek' | 'gemini';
  anthropicApiKey: string;
  deepseekApiKey: string;
  geminiApiKey?: string;
  geminiModel?: string;
  emailProvider: 'gmail' | 'resend';
  gmailEmail: string;
  gmailAppPassword: string;
  resendApiKey: string;
  resendFromEmail: string;
  systemPrompt: string;
  emailSignature: string;
  // Hosting & Subdomain Settings
  hostingProvider: 'wildcard' | 'cpanel' | 'cloudflare' | 'puppeteer_dashboard';
  baseDomain: string;
  cpanelHost?: string;
  cpanelUser?: string;
  cpanelApiToken?: string;
  cloudflareApiToken?: string;
  cloudflareZoneId?: string;
  hostingDashboardUrl?: string;
  hostingDashboardEmail?: string;
  hostingDashboardPass?: string;
  websitePromptTemplate: string;
}

interface DatabaseSchema {
  leads: Lead[];
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'claude',
  anthropicApiKey: '',
  deepseekApiKey: '',
  geminiApiKey: '',
  geminiModel: 'gemini-3.6-flash',
  emailProvider: 'gmail',
  gmailEmail: '',
  gmailAppPassword: '',
  resendApiKey: '',
  resendFromEmail: 'onboarding@resend.dev',
  emailSignature: 'Best regards,\n\n[Your Name]\n[Your Company]\nPhone: [Your Phone]\nEmail: [Your Email]',
  systemPrompt: `You are a cold outreach specialist. Compose a highly personalized, compelling, and professional cold email to the business.
Reference their specific SEO or Google Business Profile issues (like slow website speed, missing SSL, low ratings) if available.
Crucially, introduce the brand new, high-converting live demo redesign website we built for them at their personalized subdomain (use {{Demo Website}} or {{demoSiteUrl}}).
Keep it brief (under 150 words), conversational, and offer direct value. Do not sound spammy. Use a friendly tone and close with a clear call to action to review the live preview.`,
  hostingProvider: 'wildcard',
  baseDomain: 'demo.modedigicreations.com',
  cpanelHost: '',
  cpanelUser: '',
  cpanelApiToken: '',
  cloudflareApiToken: '',
  cloudflareZoneId: '',
  hostingDashboardUrl: '',
  hostingDashboardEmail: '',
  hostingDashboardPass: '',
  websitePromptTemplate: `You are an elite web designer and conversion rate optimization expert.
Build a modern, high-converting, mobile-responsive single-page landing page website for this business.
Incorporate:
1. Clean, modern aesthetic with Tailwind CSS CDN and Google Fonts (Outfit/Inter).
2. Engaging Hero section with a strong value proposition, headline, and direct CTA buttons (Call Now, Book Consultation, WhatsApp).
3. "Why Choose Us" / Services section highlighting what this business offers.
4. "Modern Web & Mobile Experience" badge/section showcasing that this site is lightning fast, SEO-optimized, and fixes their previous website issues (like mobile responsiveness, fast loading speed, SSL, and modern UX).
5. Customer Testimonials / Trust proof with 5-star Google Review aesthetic.
6. Clean contact section and footer with business phone, address, and hours.
Output ONLY complete, raw, ready-to-render HTML (from <!DOCTYPE html> to </html>) including all CSS/JS via CDN. Do not include markdown code fences or backticks.`
};

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = { leads: [], settings: DEFAULT_SETTINGS };
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Failed to load database, resetting to default', e);
      this.data = { leads: [], settings: DEFAULT_SETTINGS };
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save database', e);
    }
  }

  getLeads(): Lead[] {
    return this.data.leads;
  }

  getLead(id: string): Lead | undefined {
    return this.data.leads.find(l => l.id === id);
  }

  addLeads(newLeads: Omit<Lead, 'status' | 'id'>[]): Lead[] {
    const added: Lead[] = [];
    for (const l of newLeads) {
      // Check if duplicate by website or email or name
      const exists = this.data.leads.some(existing => 
        (l.website && existing.website === l.website) || 
        (l.email && existing.email === l.email)
      );
      if (!exists) {
        const lead: Lead = {
          ...l,
          id: Math.random().toString(36).substring(2, 9),
          status: 'not_started'
        };
        this.data.leads.push(lead);
        added.push(lead);
      }
    }
    this.save();
    return added;
  }

  updateLead(id: string, updates: Partial<Lead>): Lead | undefined {
    const lead = this.getLead(id);
    if (lead) {
      Object.assign(lead, updates);
      this.save();
    }
    return lead;
  }

  deleteLead(id: string): boolean {
    const index = this.data.leads.findIndex(l => l.id === id);
    if (index !== -1) {
      this.data.leads.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  clearLeads(): void {
    this.data.leads = [];
    this.save();
  }

  syncLeads(leads: Lead[]): void {
    this.data.leads = leads;
    this.save();
  }

  getSettings(): Settings {
    return this.data.settings;
  }

  saveSettings(settings: Partial<Settings>): Settings {
    this.data.settings = {
      ...this.data.settings,
      ...settings
    };
    this.save();
    return this.data.settings;
  }
}

export const db = new Database();
export default db;
