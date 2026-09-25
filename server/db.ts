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
  whatsapp?: string;
  whatsappDraft?: string;
  whatsappStatus?: 'not_contacted' | 'opened' | 'contacted';
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
  aiProvider: 'claude' | 'deepseek' | 'gemini' | 'openai';
  anthropicApiKey: string;
  deepseekApiKey: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  emailProvider: 'gmail' | 'resend';
  gmailEmail: string;
  gmailAppPassword: string;
  resendApiKey: string;
  resendFromEmail: string;
  systemPrompt: string;
  emailSignature: string;
  whatsappPromptTemplate?: string;
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

export interface CRMRecord {
  id: string;
  type: 'client' | 'lead' | 'project' | 'invoice' | 'proposal' | 'subscription' | 'task' | 'ticket' | 'journey' | 'deliverable' | 'onboarding' | 'contract' | 'service';
  name: string;
  clientId: string | null;
  status: string;
  value: number; // in pence / cents (£1 = 100 pence)
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SERVICES = [
  { id: "brand-workshop", category: "Brand strategy", name: "Brand discovery workshop", description: "90-minute leadership session, audit and strategic direction.", price: 75000, unit: "project" },
  { id: "brand-strategy", category: "Brand strategy", name: "Brand strategy & positioning", description: "Audience, market position, promise, personality and messaging spine.", price: 175000, unit: "project", recommended: true },
  { id: "naming", category: "Brand strategy", name: "Naming & tagline", description: "Research, naming routes, checks and shortlist presentation.", price: 95000, unit: "project" },
  { id: "logo", category: "Brand identity", name: "Logo identity system", description: "Primary mark, responsive variants, colour and final asset suite.", price: 150000, unit: "project", recommended: true },
  { id: "visual-identity", category: "Brand identity", name: "Complete visual identity", description: "Logo, palette, typography, graphic language and applications.", price: 325000, unit: "project", recommended: true },
  { id: "guidelines", category: "Brand identity", name: "Brand guidelines", description: "Practical digital brand book with usage rules and examples.", price: 125000, unit: "project" },
  { id: "social-kit", category: "Brand identity", name: "Social media launch kit", description: "Avatar, banners and 12 editable launch templates.", price: 65000, unit: "project" },
  { id: "packaging", category: "Brand identity", name: "Packaging design", description: "Creative direction and print-ready artwork for one SKU.", price: 85000, unit: "per SKU" },
  { id: "copy", category: "Content", name: "Website copywriting", description: "Conversion-led copy for up to six core pages.", price: 110000, unit: "project" },
  { id: "starter-site", category: "Websites", name: "Business website", description: "Strategy, UX, copy support and up to six responsive pages.", price: 220000, unit: "project", recommended: true },
  { id: "ecommerce", category: "Websites", name: "E-commerce website", description: "Conversion-led online shop, payment, delivery and core automations.", price: 500000, unit: "from" },
  { id: "bespoke-site", category: "Websites", name: "Bespoke digital experience", description: "Custom UX, motion, complex content and integrations.", price: 750000, unit: "from", recommended: true },
  { id: "landing", category: "Websites", name: "Campaign landing page", description: "Focused conversion page with tracking and lead capture.", price: 125000, unit: "project" },
  { id: "web-app", category: "Websites", name: "Web application", description: "Product design and development for a scoped web platform.", price: 850000, unit: "from" },
  { id: "booking", category: "Websites", name: "Booking system setup", description: "Services, staff, locations, payments and notifications.", price: 125000, unit: "project" },
  { id: "seo-foundations", category: "SEO & growth", name: "SEO foundations", description: "Research, technical setup, on-page optimisation and tracking.", price: 125000, unit: "project" },
  { id: "seo-retainer", category: "SEO & growth", name: "SEO Growth", description: "Monthly technical, content and authority programme.", price: 85000, unit: "month", recommended: true },
  { id: "care", category: "Care plans", name: "Website Care", description: "Hosting, updates, security, backups and monthly support.", price: 16600, unit: "month", recommended: true },
  { id: "commerce-care", category: "Care plans", name: "Commerce Care", description: "Store monitoring, updates, reporting and two support hours.", price: 32500, unit: "month" },
  { id: "growth-partner", category: "Care plans", name: "Growth Partner", description: "Care, analytics, optimisation and four retained hours.", price: 65000, unit: "month" },
];

const INITIAL_CRM_RECORDS: CRMRecord[] = [
  {
    id: "client-initial-1",
    type: "client",
    name: "Apex Dental Studio",
    clientId: null,
    status: "active",
    value: 220000,
    payload: {
      email: "contact@apexdental.test",
      phone: "+44 20 7946 0912",
      website: "https://apexdental.test",
      category: "Healthcare & Aesthetics",
      source: "Cold Outreach Campaign"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "lead-initial-1",
    type: "lead",
    name: "Apex Dental — Bespoke Website & Local SEO",
    clientId: "client-initial-1",
    status: "proposal",
    value: 220000,
    payload: {
      stage: "proposal",
      probability: 70,
      expectedClose: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: "Lead reviewed demo site concept. Sent formal proposal with care plan retainer."
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "project-initial-1",
    type: "project",
    name: "Apex Dental Brand & Digital Experience",
    clientId: "client-initial-1",
    status: "in-progress",
    value: 220000,
    payload: {
      scope: "Full custom responsive website, SEO migration, booking integration",
      targetDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
      progress: 45
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-initial-1",
    type: "task",
    name: "Finalize mobile navigation & WhatsApp chat widget",
    clientId: "client-initial-1",
    status: "in-progress",
    value: 0,
    payload: {
      projectId: "project-initial-1",
      priority: "high",
      due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      owner: "Lead Developer"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "invoice-initial-1",
    type: "invoice",
    name: "INV-2026-001 — Apex Dental Deposit",
    clientId: "client-initial-1",
    status: "paid",
    value: 110000,
    payload: {
      projectId: "project-initial-1",
      paid: 110000,
      dueDate: new Date().toISOString().slice(0, 10),
      lineItems: [
        { description: "Bespoke Digital Experience (50% Milestone Deposit)", quantity: 1, rate: 110000 }
      ]
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

interface DatabaseSchema {
  leads: Lead[];
  settings: Settings;
  crmRecords: CRMRecord[];
}

const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'gemini',
  anthropicApiKey: '',
  deepseekApiKey: '',
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
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
  whatsappPromptTemplate: `You are an elite B2B sales outreach copywriter. Compose a short, punchy, conversational WhatsApp pitch to the business owner or manager.
Introduce the bespoke, high-converting live demo website redesign we built for their brand (use {{Demo Website}} or {{demoSiteUrl}}).
Highlight 1-2 core improvements (e.g. mobile responsiveness, ultra-fast load time, modern design) that their current site lacks.
Keep it brief (under 60 words). Use natural WhatsApp formatting (*bold* for emphasis, clean spacing, polite emoji like 👋 or 🚀). Offer direct value and invite a quick look.`,
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
    this.data = { leads: [], settings: DEFAULT_SETTINGS, crmRecords: INITIAL_CRM_RECORDS };
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          leads: Array.isArray(parsed.leads) ? parsed.leads : [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          crmRecords: Array.isArray(parsed.crmRecords) && parsed.crmRecords.length > 0 ? parsed.crmRecords : INITIAL_CRM_RECORDS
        };
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Failed to load database, creating backup and resetting to default', e);
      try {
        if (fs.existsSync(DB_FILE)) {
          fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupt.${Date.now()}`);
        }
      } catch {}
      this.data = { leads: [], settings: DEFAULT_SETTINGS, crmRecords: INITIAL_CRM_RECORDS };
      this.save();
    }
  }

  private save() {
    try {
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
      console.error('Failed to save database atomically, attempting direct save', e);
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (directErr) {
        console.error('Direct fallback save also failed', directErr);
      }
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
      ...DEFAULT_SETTINGS,
      ...this.data.settings,
      ...settings
    };
    this.save();
    return this.data.settings;
  }

  // --- CRM & Pipeline Methods ---

  getCRMRecords(type?: string): CRMRecord[] {
    const list = this.data.crmRecords || [];
    if (type && type !== 'all') {
      return list.filter(r => r.type === type);
    }
    return list;
  }

  getCRMRecord(id: string): CRMRecord | undefined {
    return (this.data.crmRecords || []).find(r => r.id === id);
  }

  addCRMRecord(record: Partial<CRMRecord> & { type: string; name: string }): CRMRecord {
    const now = new Date().toISOString();
    const newRecord: CRMRecord = {
      id: record.id || `crm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: record.type as any,
      name: record.name,
      clientId: record.clientId || null,
      status: record.status || 'open',
      value: typeof record.value === 'number' ? record.value : 0,
      payload: record.payload || {},
      createdAt: now,
      updatedAt: now
    };
    if (!this.data.crmRecords) this.data.crmRecords = [];
    this.data.crmRecords.unshift(newRecord);
    this.save();
    return newRecord;
  }

  updateCRMRecord(id: string, updates: Partial<CRMRecord>): CRMRecord | undefined {
    if (!this.data.crmRecords) return undefined;
    const index = this.data.crmRecords.findIndex(r => r.id === id);
    if (index === -1) return undefined;

    const existing = this.data.crmRecords[index];
    const mergedPayload = updates.payload 
      ? { ...existing.payload, ...updates.payload }
      : existing.payload;

    const updated: CRMRecord = {
      ...existing,
      ...updates,
      payload: mergedPayload,
      updatedAt: new Date().toISOString()
    };
    this.data.crmRecords[index] = updated;
    this.save();
    return updated;
  }

  deleteCRMRecord(id: string): boolean {
    if (!this.data.crmRecords) return false;
    const index = this.data.crmRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      this.data.crmRecords.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  convertLeadToCRM(leadId: string): { client: CRMRecord; deal: CRMRecord } | undefined {
    const lead = this.getLead(leadId);
    if (!lead) return undefined;

    const clientId = `client-${lead.id}`;
    const now = new Date().toISOString();
    if (!this.data.crmRecords) this.data.crmRecords = [];

    // 1. Create or retrieve Client record
    let client = this.data.crmRecords.find(r => r.type === 'client' && (r.id === clientId || r.name.toLowerCase() === lead.name.toLowerCase()));
    if (!client) {
      client = {
        id: clientId,
        type: 'client',
        name: lead.name,
        clientId: null,
        status: 'active',
        value: 220000, // Standard starting contract value (£2,200)
        payload: {
          email: lead.email || '',
          phone: lead.whatsapp || lead.phone || '',
          website: lead.website || '',
          category: lead.category || '',
          demoSiteUrl: lead.demoSiteUrl || '',
          subdomain: lead.subdomain || '',
          seoScore: lead.seoScore,
          source: 'Outbound Discovery Engine',
          crawledNotes: lead.crawledText?.slice(0, 300) || '',
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(client);
    }

    // 2. Create Sales Pipeline Deal
    const dealId = `deal-${lead.id}`;
    let deal = this.data.crmRecords.find(r => r.type === 'lead' && r.id === dealId);
    if (!deal) {
      deal = {
        id: dealId,
        type: 'lead',
        name: `${lead.name} — Web Redesign & SEO`,
        clientId: client.id,
        status: lead.status === 'sent' ? 'proposal' : 'discovery',
        value: 220000,
        payload: {
          stage: lead.status === 'sent' ? 'proposal' : 'discovery',
          demoSiteUrl: lead.demoSiteUrl || '',
          contactEmail: lead.email || '',
          contactPhone: lead.whatsapp || lead.phone || '',
          outboundLeadId: lead.id,
          probability: lead.status === 'sent' ? 70 : 40,
          expectedClose: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          notes: `Converted from Outbound Engine. Live concept demo available at ${lead.demoSiteUrl || 'Pending'}`,
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(deal);
    }

    this.save();
    return { client, deal };
  }

  getCRMSummary() {
    const records = this.data.crmRecords || [];
    const clients = records.filter(r => r.type === 'client');
    const activeProjects = records.filter(r => r.type === 'project' && r.status !== 'complete');
    const pipelineValuePence = records
      .filter(r => r.type === 'lead' && r.status !== 'lost')
      .reduce((sum, r) => sum + (r.value || 0), 0);
    const monthlyRecurringPence = records
      .filter(r => r.type === 'subscription' && r.status === 'active')
      .reduce((sum, r) => sum + (r.value || 0), 0);
    const openTasks = records.filter(r => r.type === 'task' && r.status !== 'complete').length;

    return {
      totalClients: clients.length,
      activeProjects: activeProjects.length,
      pipelineValuePence,
      monthlyRecurringPence,
      openTasks
    };
  }
}

export const db = new Database();
export default db;
