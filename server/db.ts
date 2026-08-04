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
  emailDraft?: string;
  status: 'not_started' | 'crawled' | 'drafted' | 'sending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
}

export interface Settings {
  aiProvider: 'claude' | 'deepseek';
  anthropicApiKey: string;
  deepseekApiKey: string;
  emailProvider: 'gmail' | 'resend';
  gmailEmail: string;
  gmailAppPassword: string;
  resendApiKey: string;
  resendFromEmail: string;
  systemPrompt: string;
}

interface DatabaseSchema {
  leads: Lead[];
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'claude',
  anthropicApiKey: '',
  deepseekApiKey: '',
  emailProvider: 'gmail',
  gmailEmail: '',
  gmailAppPassword: '',
  resendApiKey: '',
  resendFromEmail: 'onboarding@resend.dev',
  systemPrompt: `You are a cold outreach specialist. Compose a highly personalized, compelling, and professional cold email to the business. 
Reference their specific SEO or Google Business Profile issues (like slow website speed, missing SSL, low ratings) if available.
Keep it brief (under 150 words), conversational, and offer direct value. Do not sound spammy. Use a friendly tone and close with a clear call to action.`
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
