import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { db, DEFAULT_SERVICES } from './db.js';
import { crawlWebsite, parseLeadsCSV, parseLeadsGorillaCSV, scrapeLeadsGorilla, discoverWebLeads } from './scraper.js';
import { generateColdEmail, generateWhatsAppPitch } from './composer.js';
import { sendColdEmail } from './gmail.js';
import { sanitizePhoneNumberForWhatsApp, getWhatsAppOutreachUrl } from './whatsapp.js';
import { createLeadSubdomain, deployLeadWebsite } from './hosting/manager.js';
import { getSitesDir } from './hosting/wildcardAdapter.js';
import { generateWebsiteHtml } from './siteBuilder.js';
import { getLeadPreviewUrl, sanitizeDemoUrl, getPreviewBaseUrl } from './previewUrl.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use('/debug', express.static(path.join(__dirname, 'debug')));
app.use('/sites', express.static(getSitesDir()));

// Serve frontend React application from client/dist (for Render & production deployments)
const clientDistCandidates = [
  path.join(__dirname, "..", "client", "dist"),
  path.join(process.cwd(), "..", "client", "dist"),
  path.join(process.cwd(), "client", "dist"),
  path.join(__dirname, "public", "client"),
  path.join(process.cwd(), "public", "client"),
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(path.join(p, "index.html")));

if (clientDistPath) {
  console.log(`[Static Frontend] Serving client SPA from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
} else {
  // If client/dist is not built, provide a clean, branded landing portal at root instead of Express 404
  app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Adeola &amp; Mode OS • Agency Suite</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 40px; max-width: 560px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center; }
    .badge { display: inline-block; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 28px; background: linear-gradient(135deg, #c084fc, #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .status { display: flex; align-items: center; justify-content: center; gap: 8px; color: #34d399; font-size: 13px; font-weight: 600; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 10px #34d399; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Adeola &amp; Mode OS</div>
    <h1>ColdReach Agency Engine</h1>
    <p>The outreach engine and website preview gateway is live and running on this domain. Demo redesign links sent to prospects are active at <code>/demo/:leadId</code>.</p>
    <div class="status"><span class="dot"></span> Server &amp; Gateway Operational</div>
  </div>
</body>
</html>`);
  });
}

export function cleanAiErrorMessage(error: any): string {
  if (!error) return "Unknown error occurred";

  let msg = "";
  let errorType = "";
  const statusCode = error?.status || error?.statusCode;

  if (error?.error?.message) {
    msg = error.error.message;
    errorType = error.error.type || "";
  } else if (error?.message) {
    msg = error.message;
  } else {
    msg = String(error);
  }

  // Parse embedded JSON like: 404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-3-7-sonnet-20250219"}}
  const jsonMatch = msg.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
      if (parsed?.error?.type) {
        errorType = parsed.error.type;
      }
    } catch {}
  }

  const lower = msg.toLowerCase();
  const typeLower = errorType.toLowerCase();

  if (lower.includes("anthropic-workspace-id") || lower.includes("scoped to a workspace")) {
    return "Anthropic Workspace Error: Your API key is an Organization-level key that requires a Workspace ID. Please enter your Anthropic Workspace ID in Settings (Settings > AI Engines > Anthropic Workspace ID, e.g. wrkspc_...), or create a Workspace-scoped key directly in console.anthropic.com/settings/workspaces.";
  }

  if (lower.includes("workspace") && (lower.includes("not found") || lower.includes("invalid") || lower.includes("does not exist") || lower.includes("does not have access"))) {
    return `Anthropic Workspace Error: The Workspace ID provided is invalid or this API key does not have access to it (${msg}). Please verify your Workspace ID in console.anthropic.com/settings/workspaces.`;
  }

  if (
    lower.startsWith("model:") || 
    lower.includes("model:") || 
    typeLower === "not_found_error" || 
    statusCode === 404
  ) {
    const rawModel = msg.replace(/^model:\s*/i, '').trim();
    return `Anthropic Model Access Error: "${rawModel}" is not provisioned or accessible for this workspace/account (requires Tier 2+ access or specific model enablement). Please select "Claude 3.5 Sonnet" or "Claude 3.5 Haiku" from the Claude Model dropdown, or check model permissions at console.anthropic.com.`;
  }

  if (lower.includes("credit balance") || lower.includes("plans & billing") || lower.includes("insufficient credits") || lower.includes("balance is too low")) {
    return "Anthropic Billing Error: Your Anthropic credit balance is too low or depleted. Please add credits at console.anthropic.com/settings/billing.";
  }

  if (lower.includes("api-key") || lower.includes("401") || lower.includes("authentication_error") || lower.includes("invalid x-api-key")) {
    return "Anthropic Authentication Error: The Anthropic API key provided is invalid. Please verify or re-generate your API key at console.anthropic.com/settings/keys.";
  }

  if (lower.includes("invalid x-api-key") || lower.includes("api_key_invalid") || lower.includes("authentication_error")) {
    return "Anthropic Auth Error: Invalid API key. Please check that you copied the complete Anthropic API key correctly.";
  }

  return msg;
}

export function resolveTemplateTokens(text: string, lead: any, demoUrl?: string, settings?: any): string {
  if (!text) return '';
  const cleanDemoUrl = sanitizeDemoUrl(demoUrl || lead?.demoSiteUrl, lead, settings);
  return text
    .replace(/\{\{\s*Business Name\s*\}\}/gi, lead?.name || '')
    .replace(/\{\{\s*Category\s*\}\}/gi, lead?.category || 'your business')
    .replace(/\{\{\s*SEO Score\s*\}\}/gi, lead?.seoScore ? `${lead.seoScore}/100` : 'N/A')
    .replace(/\{\{\s*GMB Rating\s*\}\}/gi, lead?.gmbRating ? `${lead.gmbRating}/5` : 'N/A')
    .replace(/\*+\{\{\s*Demo Website\s*\}\}\*+/gi, cleanDemoUrl)
    .replace(/\*+\{\{\s*demoSiteUrl\s*\}\}\*+/gi, cleanDemoUrl)
    .replace(/\{\{\s*Demo Website\s*\}\}/gi, cleanDemoUrl)
    .replace(/\{\{\s*demoSiteUrl\s*\}\}/gi, cleanDemoUrl);
}

function resolveLeadSubdomainFromHost(rawHost: string, settings: any, leads: any[]): string {
  const normalizedHost = (rawHost || '').split(':')[0].toLowerCase().trim();
  if (!normalizedHost) return '';

  const baseDomain = (settings?.baseDomain || 'demo.modedigicreations.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/^\*+\./, '')
    .replace(/[*]/g, '')
    .trim()
    .toLowerCase();

  if (normalizedHost.endsWith(`.${baseDomain}`)) {
    return normalizedHost.replace(`.${baseDomain}`, '').trim();
  }

  if (normalizedHost.endsWith('.localhost')) {
    return normalizedHost.replace('.localhost', '').trim();
  }

  const hostParts = normalizedHost.split('.');
  if (hostParts.length > 2) {
    const firstLabel = hostParts[0]?.trim();
    const isWildcardHost = firstLabel && firstLabel !== 'www' && firstLabel !== 'api';
    if (isWildcardHost) {
      const leadMatch = leads.find(l => l.subdomain === firstLabel || l.id === firstLabel);
      if (leadMatch) return firstLabel;
    }
  }

  return '';
}

// Virtual Host middleware for custom subdomains (e.g. lead-subdomain.demo.domain.com or lead-subdomain.localhost)
app.use((req, res, next) => {
  // Pass API requests, static sites, and debug requests to normal routes
  if (req.path.startsWith('/api') || req.path.startsWith('/debug') || req.path.startsWith('/sites') || req.path.startsWith('/demo')) {
    return next();
  }

  const rawHost = (req.headers.host || '').split(':')[0].toLowerCase();
  const settings = db.getSettings();
  const leads = db.getLeads();
  const targetSubdomain = resolveLeadSubdomainFromHost(rawHost, settings, leads);

  if (targetSubdomain && targetSubdomain !== 'www' && targetSubdomain !== 'api') {
    const lead = leads.find(l => l.subdomain === targetSubdomain || l.id === targetSubdomain);
    let html = lead?.demoSiteHtml;
    if (!html && lead?.subdomain) {
      const diskPath = path.join(getSitesDir(), lead.subdomain, 'index.html');
      if (fs.existsSync(diskPath)) {
        try { html = fs.readFileSync(diskPath, 'utf-8'); } catch (_) {}
      }
    }
    if (!html) {
      const directDiskPath = path.join(getSitesDir(), targetSubdomain, 'index.html');
      if (fs.existsSync(directDiskPath)) {
        try { html = fs.readFileSync(directDiskPath, 'utf-8'); } catch (_) {}
      }
    }

    if (html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.removeHeader('X-Frame-Options');
      return res.send(html);
    }
  }

  next();
});

const upload = multer({ storage: multer.memoryStorage() });

// Get all leads
app.get('/api/leads', (req, res) => {
  try {
    res.json(db.getLeads());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync leads database from client
app.post('/api/leads/sync', (req, res) => {
  try {
    db.syncLeads(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a lead
app.patch('/api/leads/:id', (req, res) => {
  try {
    const updated = db.updateLead(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Lead not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a lead
app.delete('/api/leads/:id', (req, res) => {
  try {
    const deleted = db.deleteLead(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all leads
app.delete('/api/leads', (req, res) => {
  try {
    db.clearLeads();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload CSV export (Leads Gorilla or Generic CSV)
app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const csvContent = req.file.buffer.toString('utf-8');
    const parsedLeads = parseLeadsCSV(csvContent);
    const added = db.addLeads(parsedLeads);
    res.json({ 
      success: true, 
      count: added.length, 
      total: parsedLeads.length,
      skipped: parsedLeads.length - added.length
    });
  } catch (error: any) {
    console.error('CSV upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a single lead manually
app.post('/api/leads/manual', (req, res) => {
  try {
    const { name, email, website, phone, whatsapp, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Lead / Business Name is required.' });
    }
    const cleanPhone = phone ? phone.trim() : undefined;
    const cleanWhatsapp = (whatsapp && whatsapp.trim()) 
      ? (sanitizePhoneNumberForWhatsApp(whatsapp.trim()) || whatsapp.trim())
      : (cleanPhone ? (sanitizePhoneNumberForWhatsApp(cleanPhone) || undefined) : undefined);

    const added = db.addLeads([{
      name: name.trim(),
      email: email ? email.trim() : undefined,
      website: website ? website.trim() : undefined,
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
      category: category ? category.trim() : 'Local Business',
      seoScore: 70,
      gmbRating: 4.5,
      seoIssues: ['Needs mobile viewport optimization', 'Schema markup missing']
    }]);

    res.json({ success: true, lead: added[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

let isAutomating = false;

// Trigger lead discovery / scraping (Web & AI by default, Leads Gorilla optional)
app.post('/api/leads/scrape', async (req, res) => {
  const { engine = 'web', keyword, location, email, pass, limit = 10 } = req.body;
  if (!keyword || !location) {
    return res.status(400).json({ error: 'Keyword and Location are required.' });
  }

  const settings = db.getSettings();

  try {
    let scraped: any[] = [];
    if (engine === 'leadsgorilla') {
      if (!email || !pass) {
        return res.status(400).json({ error: 'Leads Gorilla Email and Password are required when using Leads Gorilla engine.' });
      }
      scraped = await scrapeLeadsGorilla({ email, pass }, { keyword, location });
    } else {
      // Default: Universal Web & AI discovery (No account required)
      scraped = await discoverWebLeads({
        keyword,
        location,
        limit: Number(limit) || 10,
        settings
      });
    }

    const added = db.addLeads(scraped);
    res.json({ success: true, count: added.length, leads: added });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET status of background automation
app.get('/api/leads/automate-all/status', (req, res) => {
  res.json({ isAutomating });
});

// POST start full background automation
app.post('/api/leads/automate-all', (req, res) => {
  const { engine = 'web', keyword, location, email, pass, subject, limit = 10 } = req.body;
  if (!keyword || !location || !subject) {
    return res.status(400).json({ error: 'Keyword, Location, and Subject template are required.' });
  }
  if (engine === 'leadsgorilla' && (!email || !pass)) {
    return res.status(400).json({ error: 'Leads Gorilla Email and Password are required when using Leads Gorilla engine.' });
  }

  if (isAutomating) {
    return res.status(400).json({ error: 'An automation run is already in progress.' });
  }

  isAutomating = true;
  res.json({ success: true, message: 'Fully automated outreach campaign started in the background.' });

  // Run the background worker pipeline
  (async () => {
    try {
      console.log(`[Automation] Starting scrape (${engine}) for "${keyword}" in "${location}"...`);
      const settings = db.getSettings();

      let scraped: any[] = [];
      if (engine === 'leadsgorilla') {
        scraped = await scrapeLeadsGorilla({ email, pass }, { keyword, location });
      } else {
        scraped = await discoverWebLeads({
          keyword,
          location,
          limit: Number(limit) || 10,
          settings
        });
      }

      const added = db.addLeads(scraped);
      console.log(`[Automation] Found ${scraped.length} leads. Added ${added.length} new unique leads.`);

      for (const lead of added) {
        try {
          // 1. Crawl website if it has a website and we haven't crawled it yet
          let crawledText = lead.crawledText || '';
          if (lead.website && !lead.crawledText) {
            db.updateLead(lead.id, { status: 'sending', error: undefined });
            try {
              console.log(`[Automation] Crawling website for lead: ${lead.name}`);
              const crawlRes = await crawlWebsite(lead.website);
              crawledText = typeof crawlRes === 'string' ? crawlRes : crawlRes.text;
              const emailUpdate = (!lead.email && typeof crawlRes !== 'string' && crawlRes.email) ? crawlRes.email : undefined;
              const phoneUpdate = (!lead.phone && typeof crawlRes !== 'string' && crawlRes.phone) ? crawlRes.phone : undefined;
              const whatsappUpdate = (!lead.whatsapp && typeof crawlRes !== 'string' && crawlRes.whatsapp) ? crawlRes.whatsapp : undefined;
              db.updateLead(lead.id, { 
                crawledText, 
                status: 'crawled',
                ...(emailUpdate ? { email: emailUpdate } : {}),
                ...(phoneUpdate ? { phone: phoneUpdate } : {}),
                ...(whatsappUpdate ? { whatsapp: whatsappUpdate } : {})
              });
            } catch (crawlErr: any) {
              console.error(`[Automation] Crawl failed for lead ${lead.name}:`, crawlErr.message);
              db.updateLead(lead.id, { 
                crawledText: `Failed to crawl website: ${crawlErr.message}`,
                status: 'crawled'
              });
            }
          }

          // Fetch fresh lead state
          let currentLead = db.getLead(lead.id)!;

          // 2. Provision Subdomain on Hosting Dashboard
          console.log(`[Automation] Creating subdomain for lead: ${currentLead.name}`);
          db.updateLead(currentLead.id, { siteStatus: 'subdomain_created' });
          const subResult = await createLeadSubdomain(currentLead, settings);
          if (subResult.success) {
            const previewUrl = getLeadPreviewUrl(currentLead, settings);
            db.updateLead(currentLead.id, { 
              subdomain: subResult.subdomain,
              demoSiteUrl: previewUrl || subResult.url
            });
            console.log(`[Automation] Subdomain ready: ${subResult.url} | Preview link: ${previewUrl || subResult.url}`);
          }
          currentLead = db.getLead(currentLead.id)!;

          // 3. Generate AI Custom Website
          console.log(`[Automation] Building tailored AI website for lead: ${currentLead.name}`);
          db.updateLead(currentLead.id, { siteStatus: 'building' });
          const siteHtml = await generateWebsiteHtml(currentLead, settings);
          db.updateLead(currentLead.id, { demoSiteHtml: siteHtml });

          // 4. Deploy Website to Subdomain
          console.log(`[Automation] Deploying website for: ${currentLead.name}`);
          if (currentLead.subdomain) {
            const deployRes = await deployLeadWebsite(currentLead.subdomain, siteHtml, settings);
            if (deployRes.success) {
              const previewUrl = getLeadPreviewUrl(currentLead, settings);
              db.updateLead(currentLead.id, { 
                siteStatus: 'deployed', 
                status: 'site_ready',
                demoSiteUrl: previewUrl || deployRes.url
              });
              console.log(`[Automation] Website deployed successfully: ${previewUrl || deployRes.url}`);
            }
          }
          currentLead = db.getLead(currentLead.id)!;

          // 5. Generate Email draft AND WhatsApp pitch with Live Demo Link
          console.log(`[Automation] Generating email & WhatsApp drafts for lead: ${currentLead.name}`);
          db.updateLead(currentLead.id, { status: 'sending' });
          const draft = await generateColdEmail(currentLead, settings);
          let waDraft = '';
          try {
            waDraft = await generateWhatsAppPitch(currentLead, settings);
          } catch (_) {}

          db.updateLead(currentLead.id, { 
            emailDraft: draft, 
            ...(waDraft ? { whatsappDraft: waDraft } : {}),
            status: 'drafted' 
          });

          // 6. Send outreach email if email is present
          currentLead = db.getLead(currentLead.id)!;
          if (currentLead.email) {
            console.log(`[Automation] Sending outreach email to: ${currentLead.email}`);
            const cleanDemoUrl = sanitizeDemoUrl(currentLead.demoSiteUrl, currentLead, settings);
            const rawSubject = subject || `Website Redesign Demo for ${currentLead.name}`;
            const resolvedSubject = resolveTemplateTokens(rawSubject, currentLead, cleanDemoUrl, settings);
            const resolvedBody = resolveTemplateTokens(draft, currentLead, cleanDemoUrl, settings);
            
            await sendColdEmail({
              to: currentLead.email,
              subject: resolvedSubject,
              body: resolvedBody
            }, settings);

            db.updateLead(currentLead.id, {
              status: 'sent',
              sentAt: new Date().toISOString()
            });
            console.log(`[Automation] Sent successfully to ${currentLead.email}`);
          } else {
            console.log(`[Automation] Completed preparation for ${currentLead.name} (Direct WhatsApp ready)`);
            db.updateLead(currentLead.id, {
              status: 'drafted'
            });
          }
        } catch (leadErr: any) {
          console.error(`[Automation] Action failed for lead ${lead.name}:`, leadErr.message);
          db.updateLead(lead.id, {
            status: 'failed',
            error: leadErr.message
          });
        }
      }
    } catch (err: any) {
      console.error('[Automation] Campaign run crashed:', err.message);
    } finally {
      console.log('[Automation] Background campaign run finished.');
      isAutomating = false;
    }
  })();
});

// Crawl lead website
app.post('/api/leads/:id/crawl', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found. Please refresh or select a lead.' });
    if (!lead.website) {
      db.updateLead(lead.id, { 
        status: 'failed', 
        error: 'No website URL available for this lead' 
      });
      return res.status(400).json({ error: 'Lead has no website' });
    }

    db.updateLead(lead.id, { status: 'sending', error: undefined });

    const crawlRes = await crawlWebsite(lead.website);
    const crawledText = typeof crawlRes === 'string' ? crawlRes : crawlRes.text;
    const emailUpdate = (!lead.email && typeof crawlRes !== 'string' && crawlRes.email) ? crawlRes.email : undefined;
    const phoneUpdate = (!lead.phone && typeof crawlRes !== 'string' && crawlRes.phone) ? crawlRes.phone : undefined;
    const whatsappUpdate = (!lead.whatsapp && typeof crawlRes !== 'string' && crawlRes.whatsapp) ? crawlRes.whatsapp : undefined;

    const updated = db.updateLead(lead.id, {
      crawledText,
      status: 'crawled',
      ...(emailUpdate ? { email: emailUpdate } : {}),
      ...(phoneUpdate ? { phone: phoneUpdate } : {}),
      ...(whatsappUpdate ? { whatsapp: whatsappUpdate } : {})
    });

    res.json(updated);
  } catch (error: any) {
    db.updateLead(req.params.id, { status: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Generate AI WhatsApp Pitch
app.post('/api/leads/:id/draft-whatsapp', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    const pitch = await generateWhatsAppPitch(lead, settings);

    const cleanPhone = lead.whatsapp || lead.phone;
    const sanitized = sanitizePhoneNumberForWhatsApp(cleanPhone);

    const updated = db.updateLead(lead.id, {
      whatsappDraft: pitch,
      ...(sanitized && !lead.whatsapp ? { whatsapp: sanitized } : {}),
      error: undefined
    });

    res.json(updated);
  } catch (error: any) {
    const cleanErr = cleanAiErrorMessage(error);
    db.updateLead(req.params.id, { error: cleanErr });
    res.status(500).json({ error: cleanErr });
  }
});

// Generate AI Email draft
app.post('/api/leads/:id/draft', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found. Please refresh or select a lead.' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    const draft = await generateColdEmail(lead, settings);

    const updated = db.updateLead(lead.id, {
      emailDraft: draft,
      status: 'drafted',
      error: undefined
    });

    res.json(updated);
  } catch (error: any) {
    const cleanErr = cleanAiErrorMessage(error);
    db.updateLead(req.params.id, { status: 'failed', error: cleanErr });
    res.status(500).json({ error: cleanErr });
  }
});

// Send cold email via Gmail / Resend
app.post('/api/leads/:id/send', async (req, res) => {
  const { subject, body } = req.body;

  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    const emailBody = body || lead.emailDraft;
    if (!emailBody) return res.status(400).json({ error: 'Email draft is not generated yet' });
    if (!lead.email) return res.status(400).json({ error: 'Lead email address is missing' });

    db.updateLead(lead.id, { status: 'sending', error: undefined });

    const cleanDemoUrl = sanitizeDemoUrl(lead.demoSiteUrl, lead, settings);
    const rawSubject = subject || `Website Redesign Demo for ${lead.name}`;
    const resolvedSubject = resolveTemplateTokens(rawSubject, lead, cleanDemoUrl, settings);
    const resolvedBody = resolveTemplateTokens(emailBody, lead, cleanDemoUrl, settings);

    await sendColdEmail({
      to: lead.email,
      subject: resolvedSubject,
      body: resolvedBody
    }, settings);

    const updated = db.updateLead(lead.id, {
      status: 'sent',
      sentAt: new Date().toISOString(),
      error: undefined
    });

    res.json(updated);
  } catch (error: any) {
    db.updateLead(req.params.id, { status: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create Subdomain on hosting dashboard for lead
app.post('/api/leads/:id/create-subdomain', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    const result = await createLeadSubdomain(lead, settings);

    if (result.success) {
      const updated = db.updateLead(lead.id, {
        subdomain: result.subdomain,
        demoSiteUrl: getLeadPreviewUrl(lead, settings) || result.url,
        siteStatus: 'subdomain_created',
        error: undefined
      });
      res.json(updated);
    } else {
      res.status(500).json({ error: result.error || 'Failed to create subdomain' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate AI website HTML
app.post('/api/leads/:id/generate-site', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    db.updateLead(lead.id, { siteStatus: 'building' });

    const html = await generateWebsiteHtml(lead, settings);
    const updated = db.updateLead(lead.id, {
      demoSiteHtml: html,
      siteStatus: 'building',
      error: undefined
    });

    res.json(updated);
  } catch (error: any) {
    db.updateLead(req.params.id, { siteStatus: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Deploy website to subdomain
app.post('/api/leads/:id/deploy-site', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.demoSiteHtml) return res.status(400).json({ error: 'Website HTML has not been generated yet' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    const subdomain = lead.subdomain || (await createLeadSubdomain(lead, settings)).subdomain;

    const result = await deployLeadWebsite(subdomain, lead.demoSiteHtml, settings);
    if (result.success) {
      const updated = db.updateLead(lead.id, {
        subdomain,
        demoSiteUrl: getLeadPreviewUrl(lead, settings) || result.url,
        siteStatus: 'deployed',
        status: 'site_ready',
        error: undefined
      });
      res.json(updated);
    } else {
      res.status(500).json({ error: result.error || 'Failed to deploy website' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Build & Deploy All-in-One for a single lead
app.post('/api/leads/:id/build-and-deploy', async (req, res) => {
  try {
    let lead = db.getLead(req.params.id);
    if (!lead && req.body?.lead) {
      db.syncLeads([...db.getLeads(), req.body.lead]);
      lead = db.getLead(req.params.id);
    }
    if (!lead) return res.status(404).json({ error: 'Lead not found. Please refresh or select a lead.' });

    const settings = { ...db.getSettings(), ...(req.body?.settings || {}) };
    if (req.body?.settings) {
      db.saveSettings(settings);
    }

    db.updateLead(lead.id, { siteStatus: 'building', error: undefined });

    // 1. Subdomain
    const subRes = await createLeadSubdomain(lead, settings);
    const subdomain = subRes.subdomain;

    // 2. Generate HTML
    const html = await generateWebsiteHtml(lead, settings);

    // 3. Deploy
    const deployRes = await deployLeadWebsite(subdomain, html, settings);

    const updated = db.updateLead(lead.id, {
      subdomain,
      demoSiteHtml: html,
      demoSiteUrl: getLeadPreviewUrl(lead, settings) || deployRes.url,
      siteStatus: 'deployed',
      status: 'site_ready',
      error: undefined
    });

    res.json(updated);
  } catch (error: any) {
    const cleanErr = cleanAiErrorMessage(error);
    db.updateLead(req.params.id, { siteStatus: 'failed', error: cleanErr });
    res.status(500).json({ error: cleanErr });
  }
});

// Preview generated website directly in iframe
app.get('/api/leads/:id/site-preview', (req, res) => {
  try {
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).send('Lead not found');

    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");

    let html = lead.demoSiteHtml;
    if (!html && lead.subdomain) {
      const sitePath = path.join(getSitesDir(), lead.subdomain, 'index.html');
      if (fs.existsSync(sitePath)) {
        try { html = fs.readFileSync(sitePath, 'utf-8'); } catch (_) {}
      }
    }

    if (html) {
      return res.send(html);
    }

    res.send('<!DOCTYPE html><html><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h3>No demo website generated for this lead yet.</h3></body></html>');
  } catch (error: any) {
    res.status(500).send(`Preview error: ${error.message}`);
  }
});

// Direct full-screen live demo site preview route
app.get('/demo/:subdomainOrId', (req, res) => {
  try {
    const rawParam = (req.params.subdomainOrId || '').trim();
    const param = rawParam.replace(/\.html$/i, '');
    const leads = db.getLeads();
    const lead = leads.find(l => 
      l.id === param || 
      l.subdomain === param ||
      l.id.toLowerCase() === param.toLowerCase() ||
      (l.subdomain && l.subdomain.toLowerCase() === param.toLowerCase())
    );
    let html = lead?.demoSiteHtml;
    if (!html && lead?.subdomain) {
      const diskPath = path.join(getSitesDir(), lead.subdomain, 'index.html');
      if (fs.existsSync(diskPath)) {
        try { html = fs.readFileSync(diskPath, 'utf-8'); } catch (_) {}
      }
    }
    if (!html) {
      const directDiskPath = path.join(getSitesDir(), param, 'index.html');
      if (fs.existsSync(directDiskPath)) {
        try { html = fs.readFileSync(directDiskPath, 'utf-8'); } catch (_) {}
      }
    }

    if (!html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send('<!DOCTYPE html><html><body style="background:#020617;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Demo Preview Not Found</h2><p style="color:#64748b;">The demo redesign for this business is either still generating or was moved.</p></div></body></html>');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    return res.send(html);
  } catch (err: any) {
    res.status(500).send(`Demo error: ${err.message}`);
  }
});

// Test AI Provider Connection
app.post('/api/settings/test-ai', async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Please enter an API key to test.' });
    }

    if (provider === 'gemini') {
      const cleanKey = apiKey.trim();

      // Query Google ModelService to list and verify exact models accessible to this key
      try {
        const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`, {
          timeout: 15000
        });
        const allModels = listRes.data?.models || [];
        const contentModels: string[] = allModels
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));

        if (contentModels.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'API key is valid, but no text generation models are enabled. Ensure Generative Language API is enabled at https://aistudio.google.com/app/apikey.'
          });
        }

        // Auto-select model prioritizing gemini-3.8-flash, then gemini-3.6-flash
        let chosen = '';
        if (model && contentModels.includes(model)) {
          chosen = model;
        } else if (contentModels.includes('gemini-3.8-flash')) {
          chosen = 'gemini-3.8-flash';
        } else if (contentModels.includes('gemini-3.6-flash')) {
          chosen = 'gemini-3.6-flash';
        } else if (contentModels.find(m => m.includes('3.8-flash'))) {
          chosen = contentModels.find(m => m.includes('3.8-flash'))!;
        } else if (contentModels.find(m => m.includes('3.6-flash'))) {
          chosen = contentModels.find(m => m.includes('3.6-flash'))!;
        } else if (contentModels.find(m => m.includes('flash'))) {
          chosen = contentModels.find(m => m.includes('flash'))!;
        } else if (contentModels.find(m => m.includes('pro'))) {
          chosen = contentModels.find(m => m.includes('pro'))!;
        } else {
          chosen = contentModels[0];
        }

        const genAI = new GoogleGenerativeAI(cleanKey);
        const geminiModel = genAI.getGenerativeModel({ model: chosen });
        await geminiModel.generateContent('Return only "OK".');

        return res.json({ 
          success: true, 
          message: `Google Gemini connected successfully! Active model: "${chosen}".`,
          verifiedModel: chosen
        });
      } catch (err: any) {
        // Direct candidate fallback attempt
        const fallbackCandidates = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
        let lastErr: any = null;
        for (const fb of fallbackCandidates) {
          try {
            const genAI = new GoogleGenerativeAI(cleanKey);
            const geminiModel = genAI.getGenerativeModel({ model: fb });
            await geminiModel.generateContent('Return only "OK".');
            return res.json({
              success: true,
              message: `Google Gemini connected successfully! (Model: ${fb})`,
              verifiedModel: fb
            });
          } catch (directErr: any) {
            lastErr = directErr;
          }
        }

        const apiError = err.response?.data?.error || lastErr?.response?.data?.error;
        if (apiError) {
          return res.status(400).json({
            success: false,
            error: `Google API Error (${apiError.status || apiError.code}): ${apiError.message}`
          });
        }
        return res.status(500).json({ success: false, error: lastErr?.message || err.message });
      }
    } else if (provider === 'openai') {
      const cleanKey = apiKey.trim();
      const modelName = model || 'gpt-4o';
      const isReasoning = modelName.startsWith('o1') || modelName.startsWith('o3');

      try {
        const payload: any = {
          model: modelName,
          messages: [{ role: 'user', content: 'Say OK' }]
        };
        if (isReasoning) {
          payload.max_completion_tokens = 25;
        } else {
          payload.max_tokens = 5;
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        });

        if (response.data?.choices?.[0]?.message?.content) {
          return res.json({
            success: true,
            message: `ChatGPT / OpenAI connected successfully! Active model: "${modelName}"`,
            verifiedModel: modelName
          });
        }
        return res.json({ success: true, message: `ChatGPT / OpenAI connected! (Model: ${modelName})` });
      } catch (err: any) {
        const apiError = err.response?.data?.error;
        if (apiError) {
          return res.status(400).json({
            success: false,
            error: `OpenAI API Error (${apiError.type || apiError.code}): ${apiError.message}`
          });
        }
        return res.status(500).json({ success: false, error: err.message });
      }
    } else if (provider === 'deepseek') {
      const modelName = model || 'deepseek-chat';
      const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: modelName,
        messages: [{ role: 'user', content: 'Return only "OK"' }],
        max_tokens: 10
      }, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      return res.json({ 
        success: true, 
        message: `DeepSeek connected successfully! Active model: "${modelName}"`,
        verifiedModel: modelName
      });
    } else {
      // Claude (Anthropic)
      const workspaceId = (req.body?.anthropicWorkspaceId || db.getSettings().anthropicWorkspaceId || '').trim();
      const requestedModel = (model || req.body?.model || db.getSettings().anthropicModel || 'claude-3-5-sonnet-20241022').trim();

      const anthropic = new Anthropic({ 
        apiKey: apiKey.trim(),
        defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined
      });
      const requestOptions = workspaceId ? { headers: { 'anthropic-workspace-id': workspaceId } } : undefined;

      // 1. Try querying models.list() to get active accessible models for this key & workspace
      let discoveredModels: string[] = [];
      try {
        const page = await anthropic.models.list(requestOptions);
        if (page && Array.isArray(page.data)) {
          discoveredModels = page.data.map((m: any) => m.id);
        }
      } catch (listErr: any) {
        const errMsg = (listErr?.message || String(listErr)).toLowerCase();
        // If credentials, workspace, or billing failed during discovery, report it immediately
        if (
          errMsg.includes('api-key') ||
          errMsg.includes('401') ||
          errMsg.includes('authentication_error') ||
          errMsg.includes('anthropic-workspace-id') ||
          errMsg.includes('credit balance') ||
          errMsg.includes('balance is too low') ||
          errMsg.includes('permission_error')
        ) {
          return res.status(400).json({
            success: false,
            error: cleanAiErrorMessage(listErr)
          });
        }
      }

      // Build prioritized candidate models
      const candidateModels: string[] = [];

      if (discoveredModels.length > 0) {
        if (discoveredModels.includes(requestedModel)) {
          candidateModels.push(requestedModel);
        }
        const preferred = [
          discoveredModels.find(m => m.includes('3-7-sonnet')),
          discoveredModels.find(m => m.includes('3-5-sonnet')),
          discoveredModels.find(m => m.includes('3-5-haiku')),
          discoveredModels.find(m => m.includes('haiku')),
          ...discoveredModels
        ].filter(Boolean) as string[];

        for (const p of preferred) {
          if (!candidateModels.includes(p)) candidateModels.push(p);
        }
      } else {
        // Fallback candidate sequence: test requested first, then 3.5 Sonnet, 3.5 Haiku, 3 Haiku, 3.7 Sonnet
        const defaults = [
          requestedModel,
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-haiku-20240307',
          'claude-3-7-sonnet-20250219'
        ];
        for (const d of defaults) {
          if (!candidateModels.includes(d)) candidateModels.push(d);
        }
      }

      let connectedModel = '';
      let billingOrAuthError: any = null;
      let modelAccessErrors: string[] = [];

      for (const mName of candidateModels) {
        try {
          await anthropic.messages.create({
            model: mName,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say OK' }]
          }, requestOptions);
          connectedModel = mName;
          break;
        } catch (cErr: any) {
          const errMsg = (cErr?.message || String(cErr)).toLowerCase();

          // Stop early if authentication, workspace, or credit balance is dead
          if (
            errMsg.includes('api-key') ||
            errMsg.includes('401') ||
            errMsg.includes('authentication_error') ||
            errMsg.includes('anthropic-workspace-id') ||
            errMsg.includes('credit balance') ||
            errMsg.includes('balance is too low') ||
            errMsg.includes('permission_error')
          ) {
            billingOrAuthError = cErr;
            break;
          }

          modelAccessErrors.push(mName);
        }
      }

      if (!connectedModel) {
        if (billingOrAuthError) {
          return res.status(400).json({
            success: false,
            error: cleanAiErrorMessage(billingOrAuthError)
          });
        }
        return res.status(400).json({
          success: false,
          error: `Anthropic Model Access Error: None of the standard Claude models (${modelAccessErrors.join(', ')}) are provisioned for this workspace or account tier. Please check your model access permissions or credit tier at console.anthropic.com.`
        });
      }

      const isFallback = connectedModel !== requestedModel;
      const fallbackNote = isFallback
        ? ` (Notice: "${requestedModel}" requires Tier 2+ access and is not provisioned for this workspace, so the active model has been automatically switched to "${connectedModel}".)`
        : '';

      return res.json({ 
        success: true, 
        message: `Anthropic Claude connected successfully! Active model: "${connectedModel}"${workspaceId ? ` (Workspace: ${workspaceId})` : ''}.${fallbackNote}`,
        verifiedModel: connectedModel
      });
    }
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: cleanAiErrorMessage(error) 
    });
  }
});

// Test cPanel UAPI Connection
app.post('/api/settings/test-cpanel', async (req, res) => {
  try {
    const settings = { ...db.getSettings(), ...req.body };
    let host = (settings.cpanelHost || '').trim();
    const user = settings.cpanelUser?.trim();
    const token = settings.cpanelApiToken?.trim();

    if (!host || !user || !token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please enter cPanel Host URL, Username, and API Token.' 
      });
    }

    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'https://' + host;
    }
    host = host.replace(/\/+$/, '');
    if (!host.includes(':2083') && !host.includes(':2082') && !host.includes('cpanel.')) {
      host = `${host}:2083`;
    }
    host = host.replace(/\/+$/, '');

    const cleanUser = user.trim();
    const cleanToken = token.trim().replace(/^['"]|['"]$/g, '');

    // 1. Probe cPanel Variables/get_user_information (Universal token verification endpoint)
    let verifiedUser = '';
    let lastError: any = null;

    try {
      const userEndpoint = `${host}/execute/Variables/get_user_information`;
      const uRes = await axios.get(userEndpoint, {
        headers: {
          'Authorization': `cpanel ${cleanUser}:${cleanToken}`
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 12000
      });
      if (uRes.data && (uRes.data.status === 1 || uRes.data.data)) {
        verifiedUser = uRes.data.data?.user || cleanUser;
      }
    } catch (err: any) {
      lastError = err;
    }

    // 2. If user info succeeded or we want to verify subdomains
    if (verifiedUser) {
      try {
        const subEndpoint = `${host}/execute/SubDomain/get_subdomains`;
        await axios.get(subEndpoint, {
          headers: {
            'Authorization': `cpanel ${cleanUser}:${cleanToken}`
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          timeout: 12000
        });
      } catch (_) {}
      return res.json({ 
        success: true, 
        message: `cPanel connection verified! Authenticated as "${verifiedUser}". Subdomain provisioning is ready.` 
      });
    }

    // 3. Probe SubDomain endpoint directly if user info was restricted
    try {
      const endpoint = `${host}/execute/SubDomain/get_subdomains`;
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `cpanel ${cleanUser}:${cleanToken}`
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 12000
      });
      if (response.data && (response.data.status === 1 || Array.isArray(response.data.data))) {
        return res.json({ 
          success: true, 
          message: `cPanel connection verified! Authenticated as "${cleanUser}". Subdomain management is ready.` 
        });
      }
    } catch (err: any) {
      lastError = err;
    }

    // 4. If port 2083 failed, probe WHM administrative port 2087
    try {
      const whmHost = host.replace(/:\d+$/, '') + ':2087';
      const whmEndpoint = `${whmHost}/json-api/version?api.version=1`;
      const whmRes = await axios.get(whmEndpoint, {
        headers: {
          'Authorization': `whm ${cleanUser}:${cleanToken}`
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 10000
      });
      if (whmRes.data && whmRes.data.version) {
        return res.json({
          success: true,
          message: `WHM Connection Verified! Authenticated via WHM API on port 2087 as "${cleanUser}".`
        });
      }
    } catch (_) {}

    // 5. Diagnostic failure guidance
    return res.status(400).json({ 
      success: false, 
      error: `cPanel at ${host} rejected authentication for "${cleanUser}". Please ensure: 1) The token was generated in cPanel -> Security -> Manage API Tokens with Full Access. 2) If using adeola.media, Host URL must be https://adeola.media:2083. (Or switch to "Wildcard Subdomain & Local Static" which needs no cPanel API!)` 
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: `Could not connect to cPanel: ${error.message}` 
    });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  try {
    res.json(db.getSettings());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save settings
app.post('/api/settings', (req, res) => {
  try {
    const updated = db.saveSettings(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CRM & Pipeline Endpoints ---

// Get all CRM records or filter by type
app.get('/api/crm', (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const records = db.getCRMRecords(type);
    res.json({ records, count: records.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get agency services catalog
app.get('/api/crm/services', (_req, res) => {
  try {
    res.json(DEFAULT_SERVICES);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get CRM summary stats
app.get('/api/crm/summary', (_req, res) => {
  try {
    const summary = db.getCRMSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create CRM record
app.post('/api/crm', (req, res) => {
  try {
    const { type, name, clientId, status, value, payload } = req.body;
    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }
    const record = db.addCRMRecord({
      type,
      name,
      clientId,
      status,
      value,
      payload
    });
    res.status(201).json({ record });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update CRM record
app.patch('/api/crm/:id', (req, res) => {
  try {
    const updated = db.updateCRMRecord(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ record: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete CRM record
app.delete('/api/crm/:id', (req, res) => {
  try {
    const success = db.deleteCRMRecord(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seamless bridge: Convert Outbound Lead into CRM Client & Sales Deal
app.post('/api/crm/convert-lead/:id', (req, res) => {
  try {
    const result = db.convertLeadToCRM(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Outbound lead not found' });
    }
    res.json({
      success: true,
      message: `Lead converted to CRM Client "${result.client.name}" and Deal created in Pipeline!`,
      client: result.client,
      deal: result.deal
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Automatic Pipeline Reconciliation: Synchronize all outbound leads into Pipeline
app.post('/api/crm/pipeline/sync-all', (_req, res) => {
  try {
    const result = db.syncAllLeadsToPipeline();
    const records = db.getCRMRecords();
    res.json({
      success: true,
      message: `Synchronized ${result.totalLeads} discovery leads with sales pipeline (${result.dealsCount} deals total).`,
      ...result,
      records
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Automatic Pipeline End-to-End Deal Win: Win deal & auto-provision Client, Project, Sprint Tasks, Deposit Invoice, and Journey
app.post('/api/crm/deals/:id/win', (req, res) => {
  try {
    const result = db.winDeal(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Sales deal not found in pipeline' });
    }
    res.json({
      success: true,
      message: `🎉 Deal Closed & Won! Auto-provisioned Client "${result.client.name}", Project "${result.project.name}", 5 Delivery Sprint Tasks, 50% Milestone Deposit Invoice, and Journey Milestones!`,
      ...result,
      records: db.getCRMRecords()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Staff Authentication, Roles & Activity Audit Routes ---

// Staff Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    const staff = db.authenticateStaff(email, password);
    if (!staff) {
      return res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
    }
    res.json({
      success: true,
      message: `Welcome back, ${staff.name}! (${staff.role.replace('_', ' ').toUpperCase()})`,
      user: staff
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Staff Onboarding (Self or Admin-driven)
app.post('/api/auth/onboard', (req, res) => {
  try {
    const { name, email, password, role = 'staff', title, department, phone, actorId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const actor = actorId ? db.getStaffMember(actorId) : undefined;
    // Non super-admins cannot onboard super-admins
    const assignedRole = (role === 'super_admin' && (!actor || actor.role !== 'super_admin')) ? 'staff' : role;

    const newStaff = db.addStaffMember({
      name,
      email,
      password: password || 'staff123',
      role: assignedRole,
      title: title || (assignedRole === 'super_admin' ? 'Agency Executive' : assignedRole === 'admin' ? 'Operations Lead' : 'Growth Specialist'),
      department: department || 'Agency Suite',
      phone: phone || ''
    });

    res.status(201).json({
      success: true,
      message: `Staff member "${newStaff.name}" successfully onboarded as ${newStaff.role.toUpperCase()}!`,
      user: newStaff
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all staff members with their workloads
app.get('/api/staff', (_req, res) => {
  try {
    const staff = db.getStaff();
    res.json({ staff, count: staff.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Staff (Edit profile, email, password, or Super Admin role reassignment)
app.patch('/api/staff/:id', (req, res) => {
  try {
    const { name, email, password, phone, role, title, department, status, actorId } = req.body;
    const actor = actorId ? db.getStaffMember(actorId) : undefined;
    const targetStaff = db.getStaffMember(req.params.id);

    if (!targetStaff) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    const isSelf = actor && actor.id === req.params.id;
    const isSuperAdmin = actor && actor.role === 'super_admin';

    // Role changes require Super Admin
    if (role && role !== targetStaff.role && !isSuperAdmin) {
      return res.status(403).json({ error: 'Permission denied: Only a Super Admin can change staff roles.' });
    }

    // Editing another staff member requires Super Admin
    if (actor && !isSelf && !isSuperAdmin) {
      return res.status(403).json({ error: 'Permission denied: You can only edit your own profile and security credentials.' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (password !== undefined && password.trim()) updates.password = password.trim();
    if (phone !== undefined) updates.phone = phone;
    if (title !== undefined) updates.title = title;
    if (department !== undefined) updates.department = department;
    if (status !== undefined) updates.status = status;
    if (role !== undefined && (isSuperAdmin || !actor)) updates.role = role;

    const updated = db.updateStaffMember(req.params.id, updates, actor);
    if (!updated) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    res.json({
      success: true,
      message: `Profile and credentials for ${updated.name} updated successfully!`,
      staff: updated
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove staff member
app.delete('/api/staff/:id', (req, res) => {
  try {
    const actorId = req.query.actorId as string | undefined;
    const actor = actorId ? db.getStaffMember(actorId) : undefined;

    if (actor && actor.role !== 'super_admin') {
      return res.status(403).json({ error: 'Permission denied: Only a Super Admin can remove staff members.' });
    }

    const success = db.deleteStaffMember(req.params.id, actor);
    if (!success) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }
    res.json({ success: true, message: 'Staff member removed from agency.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Workload Reassignment: Assign / Reassign Deal, Project, or Task to a Staff Member
app.post('/api/staff/reassign', (req, res) => {
  try {
    const { targetType, targetId, newStaffId, actorId } = req.body;
    if (!targetType || !targetId || !newStaffId) {
      return res.status(400).json({ error: 'targetType, targetId, and newStaffId are required.' });
    }

    const actor = actorId ? db.getStaffMember(actorId) : undefined;
    const result = db.reassignWorkload({ targetType, targetId, newStaffId, adminUser: actor });
    if (!result) {
      return res.status(404).json({ error: 'Target record or staff member not found.' });
    }

    res.json({
      success: true,
      message: `${targetType.toUpperCase()} successfully assigned to ${result.newStaff.name} (${result.newStaff.role.toUpperCase()})!`,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Super Admin Activity Stream: See every activity of every staff member
app.get('/api/staff/activities', (req, res) => {
  try {
    const staffId = req.query.staffId as string | undefined;
    const action = req.query.action as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const activities = db.getActivities({ staffId, action, limit });
    res.json({ activities, count: activities.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Synchronize all existing leads into pipeline on server initialization
try {
  const initSync = db.syncAllLeadsToPipeline();
  console.log(`[Pipeline Engine] Initialized: ${initSync.dealsCount} pipeline deals active across ${initSync.totalLeads} leads.`);
} catch (syncErr: any) {
  console.warn('[Pipeline Engine] Initial sync warning:', syncErr.message);
}

// Auto-sanitize existing lead demoSiteUrls on server initialization
try {
  const leads = db.getLeads();
  const settings = db.getSettings();
  let fixedCount = 0;
  leads.forEach(l => {
    if (l.demoSiteUrl && !l.demoSiteUrl.includes('/demo/')) {
      const fixedUrl = getLeadPreviewUrl(l, settings);
      db.updateLead(l.id, { demoSiteUrl: fixedUrl });
      fixedCount++;
    }
  });
  if (fixedCount > 0) {
    console.log(`[Migration] Auto-sanitized ${fixedCount} lead demoSiteUrls to direct preview format.`);
  }
} catch (e: any) {
  console.warn('[Migration] Notice during demoSiteUrl check:', e.message);
}

// Client SPA route fallback for browser page refreshes
if (clientDistPath) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/demo') || req.path.startsWith('/sites') || req.path.startsWith('/debug')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});
