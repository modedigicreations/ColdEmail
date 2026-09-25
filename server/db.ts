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

export type StaffRole = 'super_admin' | 'admin' | 'staff';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: StaffRole;
  title: string;
  department: string;
  status: 'active' | 'suspended';
  avatar?: string;
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface StaffActivity {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffRole: StaffRole;
  action: string;
  description: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: "staff-super-adeola",
    name: "Adeola",
    email: "adeola@agency.os",
    password: "admin",
    role: "super_admin",
    title: "Agency Founder & Super Admin",
    department: "Executive Leadership",
    status: "active",
    phone: "+44 20 7946 0910",
    createdAt: new Date().toISOString()
  },
  {
    id: "staff-admin-ops",
    name: "Sarah Jenkins",
    email: "sarah@agency.os",
    password: "admin",
    role: "admin",
    title: "Operations & Delivery Director",
    department: "Agency Operations",
    status: "active",
    phone: "+44 20 7946 0911",
    createdAt: new Date().toISOString()
  },
  {
    id: "staff-outreach-marcus",
    name: "Marcus Vance",
    email: "marcus@agency.os",
    password: "staff",
    role: "staff",
    title: "Cold Outreach & Discovery Specialist",
    department: "Outbound Lead Gen",
    status: "active",
    phone: "+44 20 7946 0912",
    createdAt: new Date().toISOString()
  },
  {
    id: "staff-designer-elena",
    name: "Elena Rostova",
    email: "elena@agency.os",
    password: "staff",
    role: "staff",
    title: "Senior UI/UX & Web Designer",
    department: "Design & Development",
    status: "active",
    phone: "+44 20 7946 0913",
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_STAFF_ACTIVITIES: StaffActivity[] = [
  {
    id: "act-init-1",
    staffId: "staff-super-adeola",
    staffName: "Adeola",
    staffEmail: "adeola@agency.os",
    staffRole: "super_admin",
    action: "system_provisioned",
    description: "Configured Super Admin privileges, team roles, and automated pipeline rules.",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: "act-init-2",
    staffId: "staff-outreach-marcus",
    staffName: "Marcus Vance",
    staffEmail: "marcus@agency.os",
    staffRole: "staff",
    action: "lead_discovered",
    description: "Discovered and qualified new outbound lead: Apex Dental Studio.",
    targetType: "lead",
    targetName: "Apex Dental Studio",
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: "act-init-3",
    staffId: "staff-designer-elena",
    staffName: "Elena Rostova",
    staffEmail: "elena@agency.os",
    staffRole: "staff",
    action: "site_deployed",
    description: "Generated and deployed tailored AI demo concept website.",
    targetType: "lead",
    targetName: "Apex Dental Studio",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: "act-init-4",
    staffId: "staff-admin-ops",
    staffName: "Sarah Jenkins",
    staffEmail: "sarah@agency.os",
    staffRole: "admin",
    action: "proposal_sent",
    description: "Sent bespoke website proposal and pricing scope.",
    targetType: "deal",
    targetName: "Apex Dental — Bespoke Website & Local SEO",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

interface DatabaseSchema {
  leads: Lead[];
  settings: Settings;
  crmRecords: CRMRecord[];
  staff: StaffUser[];
  activities: StaffActivity[];
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
    this.data = { 
      leads: [], 
      settings: DEFAULT_SETTINGS, 
      crmRecords: INITIAL_CRM_RECORDS,
      staff: INITIAL_STAFF_USERS,
      activities: INITIAL_STAFF_ACTIVITIES
    };
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
          crmRecords: Array.isArray(parsed.crmRecords) && parsed.crmRecords.length > 0 ? parsed.crmRecords : INITIAL_CRM_RECORDS,
          staff: Array.isArray(parsed.staff) && parsed.staff.length > 0 ? parsed.staff : INITIAL_STAFF_USERS,
          activities: Array.isArray(parsed.activities) && parsed.activities.length > 0 ? parsed.activities : INITIAL_STAFF_ACTIVITIES
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
      this.data = { 
        leads: [], 
        settings: DEFAULT_SETTINGS, 
        crmRecords: INITIAL_CRM_RECORDS,
        staff: INITIAL_STAFF_USERS,
        activities: INITIAL_STAFF_ACTIVITIES
      };
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
        // Automatic pipeline deal creation in Stage 1: Discovery & Lead
        this.syncLeadToPipeline(lead);
      }
    }
    this.save();
    return added;
  }

  updateLead(id: string, updates: Partial<Lead>): Lead | undefined {
    const lead = this.getLead(id);
    if (lead) {
      Object.assign(lead, updates);
      // Automatically keep Pipeline Deal synchronized with changes (site deployed, outreach sent, etc.)
      this.syncLeadToPipeline(lead);
      this.save();
    }
    return lead;
  }

  deleteLead(id: string): boolean {
    const index = this.data.leads.findIndex(l => l.id === id);
    if (index !== -1) {
      const lead = this.data.leads[index];
      this.data.leads.splice(index, 1);
      // Clean up linked pipeline deal if still in discovery
      if (this.data.crmRecords) {
        this.data.crmRecords = this.data.crmRecords.filter(r => 
          !(r.type === 'lead' && (r.id === `deal-${lead.id}` || r.payload?.leadId === lead.id) && r.status === 'discovery')
        );
      }
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
    this.syncAllLeadsToPipeline();
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

  // --- Automatic Pipeline & End-to-End Delivery Methods ---

  syncLeadToPipeline(lead: Lead): CRMRecord {
    if (!this.data.crmRecords) this.data.crmRecords = [];
    const now = new Date().toISOString();
    const dealId = `deal-${lead.id}`;
    const clientId = `client-${lead.id}`;

    let deal = this.data.crmRecords.find(r => 
      r.type === 'lead' && (r.id === dealId || r.payload?.leadId === lead.id || r.payload?.outboundLeadId === lead.id)
    );

    const isContacted = lead.status === 'sent' || lead.whatsappStatus === 'contacted';
    const hasSite = !!lead.demoSiteUrl;

    if (!deal) {
      // Create new deal starting in Stage 1: Discovery & Lead (or Stage 2 if already contacted)
      const stage = isContacted ? 'proposal' : 'discovery';
      const probability = isContacted ? 60 : (hasSite ? 45 : 30);

      deal = {
        id: dealId,
        type: 'lead',
        name: `${lead.name} — Web Redesign & Growth`,
        clientId: clientId,
        status: stage,
        value: 220000, // £2,200 standard deal
        payload: {
          leadId: lead.id,
          outboundLeadId: lead.id,
          stage,
          category: lead.category || 'Local Business',
          website: lead.website || '',
          contactEmail: lead.email || '',
          contactPhone: lead.whatsapp || lead.phone || '',
          seoScore: lead.seoScore,
          demoSiteUrl: lead.demoSiteUrl || '',
          subdomain: lead.subdomain || '',
          probability,
          expectedClose: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          notes: lead.demoSiteUrl 
            ? `AI Concept site ready: ${lead.demoSiteUrl}` 
            : `Identified via Outbound Discovery Engine (${lead.category || 'Local Business'}).`,
          source: 'Outbound Discovery Engine',
          outreachStatus: lead.status,
          whatsappStatus: lead.whatsappStatus || 'not_contacted',
          sentAt: lead.sentAt
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(deal);
    } else {
      // Auto-advance or keep in sync with outreach activities:
      let nextStage = deal.status;
      let nextProb = deal.payload?.probability || 30;

      // Automatically advance to Stage 2: Proposal Sent if outreach sent
      if (deal.status === 'discovery' && isContacted) {
        nextStage = 'proposal';
        nextProb = 60;
      }

      deal.status = nextStage;
      deal.payload = {
        ...deal.payload,
        leadId: lead.id,
        stage: nextStage,
        category: lead.category || deal.payload?.category,
        website: lead.website || deal.payload?.website,
        contactEmail: lead.email || deal.payload?.contactEmail,
        contactPhone: lead.whatsapp || lead.phone || deal.payload?.contactPhone,
        seoScore: lead.seoScore !== undefined ? lead.seoScore : deal.payload?.seoScore,
        demoSiteUrl: lead.demoSiteUrl || deal.payload?.demoSiteUrl,
        subdomain: lead.subdomain || deal.payload?.subdomain,
        probability: nextProb,
        outreachStatus: lead.status,
        whatsappStatus: lead.whatsappStatus || deal.payload?.whatsappStatus || 'not_contacted',
        sentAt: lead.sentAt || deal.payload?.sentAt,
        notes: isContacted 
          ? (deal.payload?.notes || `Pitch proposal sent. Live demo: ${lead.demoSiteUrl || 'Deployed'}`)
          : (lead.demoSiteUrl ? `Demo site ready: ${lead.demoSiteUrl}` : deal.payload?.notes)
      };
      deal.updatedAt = now;
    }

    return deal;
  }

  syncAllLeadsToPipeline(): { totalLeads: number; dealsCount: number } {
    const leads = this.getLeads();
    for (const lead of leads) {
      this.syncLeadToPipeline(lead);
    }
    this.save();
    const deals = this.getCRMRecords('lead');
    return { totalLeads: leads.length, dealsCount: deals.length };
  }

  winDeal(dealId: string): { 
    deal: CRMRecord; 
    client: CRMRecord; 
    project: CRMRecord; 
    tasks: CRMRecord[]; 
    invoice: CRMRecord; 
    proposal: CRMRecord; 
  } | undefined {
    if (!this.data.crmRecords) this.data.crmRecords = [];
    const deal = this.data.crmRecords.find(r => r.type === 'lead' && r.id === dealId);
    if (!deal) return undefined;

    const now = new Date().toISOString();
    const rawName = deal.name.replace(/\s*—.*$/, '').replace(/\s*\(.*\)$/, '').trim();
    const clientName = rawName || 'Agency Client';
    const clientId = deal.clientId || `client-${deal.id.replace('deal-', '')}`;
    const dealValue = deal.value || 220000;

    // 1. Mark deal as Closed / Won (Stage 4)
    deal.status = 'won';
    deal.payload = {
      ...deal.payload,
      stage: 'won',
      probability: 100,
      wonAt: now
    };
    deal.updatedAt = now;

    // 2. Auto-Create or Activate Client
    let client = this.data.crmRecords.find(r => r.type === 'client' && (r.id === clientId || r.name.toLowerCase() === clientName.toLowerCase()));
    if (!client) {
      client = {
        id: clientId,
        type: 'client',
        name: clientName,
        clientId: null,
        status: 'active',
        value: dealValue,
        payload: {
          email: deal.payload?.contactEmail || '',
          phone: deal.payload?.contactPhone || '',
          website: deal.payload?.website || '',
          category: deal.payload?.category || 'Design & Digital Retainer',
          demoSiteUrl: deal.payload?.demoSiteUrl || '',
          dealId: deal.id,
          source: 'Pipeline Closed Won'
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(client);
    } else {
      client.status = 'active';
      client.value = Math.max(client.value || 0, dealValue);
      client.payload = {
        ...client.payload,
        email: deal.payload?.contactEmail || client.payload?.email,
        phone: deal.payload?.contactPhone || client.payload?.phone,
        website: deal.payload?.website || client.payload?.website,
        demoSiteUrl: deal.payload?.demoSiteUrl || client.payload?.demoSiteUrl,
        dealId: deal.id
      };
      client.updatedAt = now;
    }
    deal.clientId = client.id;

    // 3. Auto-Create Project in Delivery Desk
    const projectId = `proj-${deal.id.replace('deal-', '')}`;
    let project = this.data.crmRecords.find(r => r.type === 'project' && (r.id === projectId || r.payload?.dealId === deal.id));
    if (!project) {
      project = {
        id: projectId,
        type: 'project',
        name: `${client.name} — Web Platform & Growth`,
        clientId: client.id,
        status: 'in-progress',
        value: dealValue,
        payload: {
          dealId: deal.id,
          scope: 'Full responsive website redesign, custom UX build, SEO launch, and care plan setup.',
          demoSiteUrl: deal.payload?.demoSiteUrl || '',
          targetDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
          progress: 15
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(project);
    }

    // 4. Auto-Generate 5 Standard Agency Delivery Tasks
    const standardTasks = [
      { name: '1. Client Onboarding & Brand Asset Intake (Logos, DNS, Content)', dueDays: 3, priority: 'high' },
      { name: '2. Wireframe & High-Fidelity UI Layout Review', dueDays: 7, priority: 'medium' },
      { name: '3. Responsive Production Build & Interactive Booking/Forms', dueDays: 14, priority: 'high' },
      { name: '4. Client Staging Walkthrough & Revision Sign-off', dueDays: 17, priority: 'medium' },
      { name: '5. Live Production Domain Launch & Care Plan Retainer Handover', dueDays: 21, priority: 'high' }
    ];

    const tasks: CRMRecord[] = [];
    for (const tDef of standardTasks) {
      const existingTask = this.data.crmRecords.find(r => r.type === 'task' && r.payload?.projectId === project.id && r.name === tDef.name);
      if (!existingTask) {
        const task: CRMRecord = {
          id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'task',
          name: tDef.name,
          clientId: client.id,
          status: 'in-progress',
          value: 0,
          payload: {
            projectId: project.id,
            priority: tDef.priority,
            due: new Date(Date.now() + tDef.dueDays * 86400000).toISOString().slice(0, 10),
            owner: 'Lead Developer'
          },
          createdAt: now,
          updatedAt: now
        };
        this.data.crmRecords.unshift(task);
        tasks.push(task);
      }
    }

    // 5. Auto-Generate 50% Milestone Deposit Invoice
    const depositValue = Math.round(dealValue * 0.5);
    const invId = `inv-${deal.id.replace('deal-', '')}`;
    let invoice = this.data.crmRecords.find(r => r.type === 'invoice' && (r.id === invId || r.payload?.dealId === deal.id));
    if (!invoice) {
      const invNum = Math.floor(1000 + Math.random() * 9000);
      invoice = {
        id: invId,
        type: 'invoice',
        name: `INV-${new Date().getFullYear()}-${invNum} — ${client.name} Deposit`,
        clientId: client.id,
        status: 'open',
        value: depositValue,
        payload: {
          projectId: project.id,
          dealId: deal.id,
          paid: 0,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          lineItems: [
            { description: 'Bespoke Digital Experience (50% Milestone Deposit)', quantity: 1, rate: depositValue }
          ]
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(invoice);
    }

    // 6. Auto-Generate Accepted Proposal
    const propId = `prop-${deal.id.replace('deal-', '')}`;
    let proposal = this.data.crmRecords.find(r => r.type === 'proposal' && (r.id === propId || r.payload?.dealId === deal.id));
    if (!proposal) {
      proposal = {
        id: propId,
        type: 'proposal',
        name: `PROP-${new Date().getFullYear()} — ${client.name} Scoped Agreement`,
        clientId: client.id,
        status: 'accepted',
        value: dealValue,
        payload: {
          dealId: deal.id,
          projectId: project.id,
          acceptedAt: now,
          lineItems: [
            { description: 'Business Website & SEO System', quantity: 1, rate: dealValue }
          ]
        },
        createdAt: now,
        updatedAt: now
      };
      this.data.crmRecords.unshift(proposal);
    }

    // 7. Auto-Initialize Client Journey Onboarding
    const onboardingId = `onboard-${deal.id.replace('deal-', '')}`;
    const existingOnboarding = this.data.crmRecords.find(r => r.type === 'onboarding' && (r.id === onboardingId || r.payload?.dealId === deal.id));
    if (!existingOnboarding) {
      this.data.crmRecords.unshift({
        id: onboardingId,
        type: 'onboarding',
        name: `${client.name} Onboarding Checklist`,
        clientId: client.id,
        status: 'complete',
        value: 0,
        payload: {
          dealId: deal.id,
          projectId: project.id,
          notes: 'Won via Pipeline. Discovery & proposal completed.'
        },
        createdAt: now,
        updatedAt: now
      });
    }

    this.save();
    return { deal, client, project, tasks, invoice, proposal };
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

    // If deal is moved to 'won', automatically execute end-to-end downstream provisioning!
    if (existing.type === 'lead' && (updates.status === 'won' || updates.payload?.stage === 'won')) {
      const wonResult = this.winDeal(id);
      if (wonResult) {
        return wonResult.deal;
      }
    }

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

    // 2. Create or sync Sales Pipeline Deal
    const deal = this.syncLeadToPipeline(lead);
    deal.clientId = client.id;

    this.save();
    return { client, deal };
  }

  // --- Staff Onboarding, Roles & Activity Audit Methods ---

  getStaff(): StaffUser[] {
    const list = this.data.staff || INITIAL_STAFF_USERS;
    const records = this.data.crmRecords || [];

    // Calculate dynamic workload per staff member
    return list.map(member => {
      const assignedDeals = records.filter(r => r.type === 'lead' && (r.payload?.assignedStaffId === member.id || r.payload?.assignedStaffEmail === member.email));
      const assignedProjects = records.filter(r => r.type === 'project' && (r.payload?.assignedStaffId === member.id || r.payload?.assignedStaffEmail === member.email));
      const assignedTasks = records.filter(r => r.type === 'task' && (r.payload?.assignedStaffId === member.id || r.payload?.owner === member.name));

      return {
        ...member,
        assignedDealsCount: assignedDeals.length,
        assignedProjectsCount: assignedProjects.length,
        assignedTasksCount: assignedTasks.length
      } as any;
    });
  }

  getStaffMember(id: string): StaffUser | undefined {
    return (this.data.staff || []).find(s => s.id === id || s.email.toLowerCase() === id.toLowerCase());
  }

  authenticateStaff(email: string, password?: string): StaffUser | undefined {
    const cleanEmail = email.trim().toLowerCase();
    const staff = (this.data.staff || []).find(s => 
      s.email.toLowerCase() === cleanEmail ||
      (s.role === 'super_admin' && (cleanEmail === 'adeola@modedigital.co.uk' || cleanEmail === 'adeola@agency.os' || cleanEmail === 'admin'))
    );
    if (!staff) return undefined;

    // Check password if provided, or allow default demo pass ('admin' or 'staff123')
    if (password && staff.password && staff.password !== password.trim() && password.trim() !== 'admin' && password.trim() !== 'staff123') {
      return undefined;
    }

    staff.lastLoginAt = new Date().toISOString();
    this.save();

    // Log sign-in activity
    this.logActivity({
      staffId: staff.id,
      staffName: staff.name,
      staffEmail: staff.email,
      staffRole: staff.role,
      action: 'staff_login',
      description: `Staff member signed in to workspace: ${staff.name} (${staff.role.replace('_', ' ').toUpperCase()}).`
    });

    return staff;
  }

  addStaffMember(staffData: Partial<StaffUser> & { name: string; email: string; role?: StaffRole }): StaffUser {
    const now = new Date().toISOString();
    const cleanEmail = staffData.email.trim().toLowerCase();

    // Check if staff already exists
    let existing = (this.data.staff || []).find(s => s.email.toLowerCase() === cleanEmail);
    if (existing) {
      existing = {
        ...existing,
        ...staffData,
        email: cleanEmail
      };
      this.save();
      return existing;
    }

    const newStaff: StaffUser = {
      id: staffData.id || `staff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: staffData.name.trim(),
      email: cleanEmail,
      password: staffData.password?.trim() || 'staff123',
      role: staffData.role || 'staff',
      title: staffData.title?.trim() || 'Agency Specialist',
      department: staffData.department?.trim() || 'Outbound & Client Delivery',
      status: staffData.status || 'active',
      phone: staffData.phone?.trim() || '',
      createdAt: now
    };

    if (!this.data.staff) this.data.staff = [];
    this.data.staff.push(newStaff);
    this.save();

    // Log onboarding activity
    this.logActivity({
      staffId: newStaff.id,
      staffName: newStaff.name,
      staffEmail: newStaff.email,
      staffRole: newStaff.role,
      action: 'staff_onboarded',
      description: `New staff member onboarded: ${newStaff.name} as ${newStaff.role.replace('_', ' ').toUpperCase()} (${newStaff.title} - ${newStaff.department}).`
    });

    return newStaff;
  }

  updateStaffMember(id: string, updates: Partial<StaffUser>, actor?: StaffUser): StaffUser | undefined {
    if (!this.data.staff) return undefined;
    const index = this.data.staff.findIndex(s => s.id === id);
    if (index === -1) return undefined;

    const current = this.data.staff[index];
    const previousRole = current.role;
    const previousDept = current.department;

    const updated: StaffUser = {
      ...current,
      ...updates
    };
    this.data.staff[index] = updated;
    this.save();

    // Log role or department reassignment if changed
    if (updates.role && updates.role !== previousRole) {
      this.logActivity({
        staffId: actor?.id || updated.id,
        staffName: actor?.name || updated.name,
        staffEmail: actor?.email || updated.email,
        staffRole: actor?.role || updated.role,
        action: 'role_reassigned',
        description: `Role reassigned for ${updated.name}: from ${previousRole.toUpperCase()} to ${updates.role.toUpperCase()}${actor ? ` by Super Admin ${actor.name}` : ''}.`,
        targetType: 'staff',
        targetId: updated.id,
        targetName: updated.name
      });
    } else if (updates.department && updates.department !== previousDept) {
      this.logActivity({
        staffId: actor?.id || updated.id,
        staffName: actor?.name || updated.name,
        staffEmail: actor?.email || updated.email,
        staffRole: actor?.role || updated.role,
        action: 'department_reassigned',
        description: `Department updated for ${updated.name}: from "${previousDept}" to "${updates.department}".`,
        targetType: 'staff',
        targetId: updated.id,
        targetName: updated.name
      });
    }

    return updated;
  }

  deleteStaffMember(id: string, actor?: StaffUser): boolean {
    if (!this.data.staff) return false;
    const index = this.data.staff.findIndex(s => s.id === id);
    if (index !== -1) {
      const removed = this.data.staff[index];
      this.data.staff.splice(index, 1);
      this.save();

      this.logActivity({
        staffId: actor?.id || 'system',
        staffName: actor?.name || 'Super Admin',
        staffEmail: actor?.email || 'admin@agency.os',
        staffRole: actor?.role || 'super_admin',
        action: 'staff_removed',
        description: `Staff member ${removed.name} (${removed.email}) was removed from workspace.`
      });

      return true;
    }
    return false;
  }

  reassignWorkload(params: {
    targetType: 'deal' | 'project' | 'task';
    targetId: string;
    newStaffId: string;
    adminUser?: StaffUser;
  }): { targetRecord: CRMRecord; newStaff: StaffUser } | undefined {
    const { targetType, targetId, newStaffId, adminUser } = params;
    const target = this.getCRMRecord(targetId);
    const newStaff = this.getStaffMember(newStaffId);
    if (!target || !newStaff) return undefined;

    const previousAssignee = target.payload?.assignedStaffName || 'Unassigned';

    target.payload = {
      ...target.payload,
      assignedStaffId: newStaff.id,
      assignedStaffName: newStaff.name,
      assignedStaffEmail: newStaff.email,
      assignedStaffRole: newStaff.role
    };
    target.updatedAt = new Date().toISOString();
    this.save();

    // Log reassignment activity into full audit trail
    this.logActivity({
      staffId: adminUser?.id || newStaff.id,
      staffName: adminUser?.name || newStaff.name,
      staffEmail: adminUser?.email || newStaff.email,
      staffRole: adminUser?.role || 'super_admin',
      action: 'workload_reassigned',
      description: `${adminUser?.name || 'Super Admin'} reassigned ${targetType.toUpperCase()} "${target.name}" from ${previousAssignee} to ${newStaff.name} (${newStaff.role.toUpperCase()}).`,
      targetType,
      targetId: target.id,
      targetName: target.name,
      metadata: { previousAssignee, newStaffId: newStaff.id, newStaffName: newStaff.name }
    });

    return { targetRecord: target, newStaff };
  }

  logActivity(act: {
    staffId?: string;
    staffName?: string;
    staffEmail?: string;
    staffRole?: StaffRole;
    action: string;
    description: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    metadata?: Record<string, any>;
  }): StaffActivity {
    const activity: StaffActivity = {
      id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      staffId: act.staffId || 'system',
      staffName: act.staffName || 'System Automator',
      staffEmail: act.staffEmail || 'system@agency.os',
      staffRole: act.staffRole || 'staff',
      action: act.action,
      description: act.description,
      targetType: act.targetType,
      targetId: act.targetId,
      targetName: act.targetName,
      metadata: act.metadata,
      timestamp: new Date().toISOString()
    };

    if (!this.data.activities) this.data.activities = [];
    this.data.activities.unshift(activity);

    // Keep up to 500 latest activities in log
    if (this.data.activities.length > 500) {
      this.data.activities = this.data.activities.slice(0, 500);
    }

    this.save();
    return activity;
  }

  getActivities(filter?: { staffId?: string; action?: string; limit?: number }): StaffActivity[] {
    let list = this.data.activities || INITIAL_STAFF_ACTIVITIES;
    if (filter?.staffId && filter.staffId !== 'all') {
      list = list.filter(a => a.staffId === filter.staffId);
    }
    if (filter?.action && filter.action !== 'all') {
      list = list.filter(a => a.action === filter.action);
    }
    const limit = filter?.limit || 100;
    return list.slice(0, limit);
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
