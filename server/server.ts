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

// Virtual Host middleware for custom subdomains (e.g. lead-subdomain.demo.domain.com or lead-subdomain.localhost)
app.use((req, res, next) => {
  // Pass API requests, static sites, and debug requests to normal routes
  if (req.path.startsWith('/api') || req.path.startsWith('/debug') || req.path.startsWith('/sites') || req.path.startsWith('/demo')) {
    return next();
  }

  const rawHost = (req.headers.host || '').split(':')[0].toLowerCase();
  const settings = db.getSettings();
  const baseDomain = (settings.baseDomain || 'demo.modedigicreations.com').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

  let targetSubdomain = '';
  if (rawHost.endsWith(`.${baseDomain}`)) {
    targetSubdomain = rawHost.replace(`.${baseDomain}`, '').trim();
  } else if (rawHost.endsWith('.localhost')) {
    targetSubdomain = rawHost.replace('.localhost', '').trim();
  }

  if (targetSubdomain && targetSubdomain !== 'www' && targetSubdomain !== 'api') {
    const leads = db.getLeads();
    const lead = leads.find(l => l.subdomain === targetSubdomain || l.id === targetSubdomain);
    if (lead && lead.demoSiteHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.removeHeader('X-Frame-Options');
      return res.send(lead.demoSiteHtml);
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
    res.json({ success: true, count: added.length, total: parsedLeads.length });
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
            db.updateLead(currentLead.id, { 
              subdomain: subResult.subdomain, 
              demoSiteUrl: subResult.url 
            });
            console.log(`[Automation] Subdomain ready: ${subResult.url}`);
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
              db.updateLead(currentLead.id, { 
                siteStatus: 'deployed', 
                status: 'site_ready',
                demoSiteUrl: deployRes.url
              });
              console.log(`[Automation] Website deployed successfully: ${deployRes.url}`);
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
            const resolvedSubject = subject
              .replace(/\{\{\s*Business Name\s*\}\}/gi, currentLead.name)
              .replace(/\{\{\s*Demo Website\s*\}\}/gi, currentLead.demoSiteUrl || '')
              .replace(/\{\{\s*demoSiteUrl\s*\}\}/gi, currentLead.demoSiteUrl || '');
            
            await sendColdEmail({
              to: currentLead.email,
              subject: resolvedSubject,
              body: draft
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
    db.updateLead(req.params.id, { error: error.message });
    res.status(500).json({ error: error.message });
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
    db.updateLead(req.params.id, { status: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
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

    const rawSubject = subject || `Website Redesign Demo for ${lead.name}`;
    const resolvedSubject = rawSubject
      .replace(/\{\{\s*Business Name\s*\}\}/gi, lead.name)
      .replace(/\{\{\s*Category\s*\}\}/gi, lead.category || 'your business')
      .replace(/\{\{\s*SEO Score\s*\}\}/gi, lead.seoScore ? `${lead.seoScore}/100` : 'N/A')
      .replace(/\{\{\s*GMB Rating\s*\}\}/gi, lead.gmbRating ? `${lead.gmbRating}/5` : 'N/A')
      .replace(/\{\{\s*Demo Website\s*\}\}/gi, lead.demoSiteUrl || '')
      .replace(/\{\{\s*demoSiteUrl\s*\}\}/gi, lead.demoSiteUrl || '');

    await sendColdEmail({
      to: lead.email,
      subject: resolvedSubject,
      body: emailBody
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
        demoSiteUrl: result.url,
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
        demoSiteUrl: result.url,
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
      demoSiteUrl: deployRes.url,
      siteStatus: 'deployed',
      status: 'site_ready',
      error: undefined
    });

    res.json(updated);
  } catch (error: any) {
    db.updateLead(req.params.id, { siteStatus: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
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

    if (lead.demoSiteHtml) {
      return res.send(lead.demoSiteHtml);
    }

    res.send('<!DOCTYPE html><html><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h3>No demo website generated for this lead yet.</h3></body></html>');
  } catch (error: any) {
    res.status(500).send(`Preview error: ${error.message}`);
  }
});

// Direct full-screen live demo site preview route
app.get('/demo/:subdomainOrId', (req, res) => {
  try {
    const param = req.params.subdomainOrId;
    const leads = db.getLeads();
    const lead = leads.find(l => l.id === param || l.subdomain === param);
    if (!lead || !lead.demoSiteHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send('<!DOCTYPE html><html><body style="background:#020617;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h3>Demo website not found or still generating.</h3></body></html>');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    return res.send(lead.demoSiteHtml);
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
      const modelName = model || 'gpt-4o-mini';
      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: modelName,
          messages: [{ role: 'user', content: 'Return only "OK"' }],
          max_tokens: 5
        }, {
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        if (response.data?.choices?.[0]?.message?.content) {
          return res.json({
            success: true,
            message: `ChatGPT / OpenAI connected successfully! (Model: ${modelName})`,
            verifiedModel: modelName
          });
        }
        return res.json({ success: true, message: 'ChatGPT / OpenAI API connection verified successfully!' });
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
      await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Return only "OK"' }],
        max_tokens: 5
      }, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
        timeout: 15000
      });
      return res.json({ success: true, message: 'DeepSeek API connection verified successfully!' });
    } else {
      // Claude
      const anthropic = new Anthropic({ apiKey: apiKey.trim() });
      await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Return only "OK"' }]
      });
      return res.json({ success: true, message: 'Anthropic Claude connected successfully!' });
    }
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
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

// Update Staff (Super Admin assign / reassign role, department, title, or status)
app.patch('/api/staff/:id', (req, res) => {
  try {
    const { role, title, department, status, actorId } = req.body;
    const actor = actorId ? db.getStaffMember(actorId) : undefined;

    // Enforce Super Admin role permissions for assigning/reassigning roles
    if (role && actor && actor.role !== 'super_admin') {
      return res.status(403).json({ error: 'Permission denied: Only a Super Admin can assign or reassign staff roles.' });
    }

    const updated = db.updateStaffMember(req.params.id, { role, title, department, status }, actor);
    if (!updated) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    res.json({
      success: true,
      message: `Staff profile for ${updated.name} updated successfully! Role: ${updated.role.toUpperCase()}`,
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});
