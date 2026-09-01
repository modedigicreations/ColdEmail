import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { db } from './db.js';
import { crawlWebsite, parseLeadsGorillaCSV, scrapeLeadsGorilla } from './scraper.js';
import { generateColdEmail } from './composer.js';
import { sendColdEmail } from './gmail.js';
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

// Upload Leads Gorilla CSV export
app.post('/api/leads/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const csvContent = req.file.buffer.toString('utf-8');
    const parsedLeads = parseLeadsGorillaCSV(csvContent);
    const added = db.addLeads(parsedLeads);
    res.json({ success: true, count: added.length, total: parsedLeads.length });
  } catch (error: any) {
    console.error('CSV upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

let isAutomating = false;

// Trigger automated scraping (Puppeteer)
app.post('/api/leads/scrape', async (req, res) => {
  const { keyword, location, email, pass } = req.body;
  if (!keyword || !location || !email || !pass) {
    return res.status(400).json({ error: 'Keyword, Location, Leads Gorilla Email and Password are required.' });
  }

  try {
    const scraped = await scrapeLeadsGorilla({ email, pass }, { keyword, location });
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
  const { keyword, location, email, pass, subject } = req.body;
  if (!keyword || !location || !email || !pass || !subject) {
    return res.status(400).json({ error: 'Keyword, Location, Leads Gorilla Email/Password, and Subject template are required.' });
  }

  if (isAutomating) {
    return res.status(400).json({ error: 'An automation run is already in progress.' });
  }

  isAutomating = true;
  res.json({ success: true, message: 'Fully automated outreach campaign started in the background.' });

  // Run the background worker pipeline
  (async () => {
    try {
      console.log(`[Automation] Starting scrape for "${keyword}" in "${location}"...`);
      const scraped = await scrapeLeadsGorilla({ email, pass }, { keyword, location });
      const added = db.addLeads(scraped);
      console.log(`[Automation] Found ${scraped.length} leads. Added ${added.length} new unique leads.`);
      
      const settings = db.getSettings();

      for (const lead of added) {
        try {
          // 1. Crawl website if it has a website and we haven't crawled it yet
          let crawledText = lead.crawledText || '';
          if (lead.website && !lead.crawledText) {
            db.updateLead(lead.id, { status: 'sending', error: undefined });
            try {
              console.log(`[Automation] Crawling website for lead: ${lead.name}`);
              crawledText = await crawlWebsite(lead.website);
              db.updateLead(lead.id, { crawledText, status: 'crawled' });
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

          // 5. Generate Email draft with Live Demo Link
          console.log(`[Automation] Generating email draft with demo link for lead: ${currentLead.name}`);
          db.updateLead(currentLead.id, { status: 'sending' });
          const draft = await generateColdEmail(currentLead, settings);
          db.updateLead(currentLead.id, { emailDraft: draft, status: 'drafted' });

          // 6. Send outreach email
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
            console.log(`[Automation] Skipped sending to ${currentLead.name}: No email address found`);
            db.updateLead(currentLead.id, {
              status: 'failed',
              error: 'Outreach skipped: No email address found for this lead.'
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
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.website) {
      db.updateLead(lead.id, { 
        status: 'failed', 
        error: 'No website URL available for this lead' 
      });
      return res.status(400).json({ error: 'Lead has no website' });
    }

    db.updateLead(lead.id, { status: 'sending', error: undefined });

    const crawledText = await crawlWebsite(lead.website);
    const updated = db.updateLead(lead.id, {
      crawledText,
      status: 'crawled'
    });

    res.json(updated);
  } catch (error: any) {
    db.updateLead(req.params.id, { status: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Generate AI Email draft
app.post('/api/leads/:id/draft', async (req, res) => {
  try {
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = db.getSettings();
    const draft = await generateColdEmail(lead, settings);

    const updated = db.updateLead(lead.id, {
      emailDraft: draft,
      status: 'drafted'
    });

    res.json(updated);
  } catch (error: any) {
    db.updateLead(req.params.id, { status: 'failed', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Send cold email via Gmail
app.post('/api/leads/:id/send', async (req, res) => {
  const { subject } = req.body;
  if (!subject) return res.status(400).json({ error: 'Subject is required' });

  try {
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.emailDraft) return res.status(400).json({ error: 'Email draft is not generated yet' });
    if (!lead.email) return res.status(400).json({ error: 'Lead email address is missing' });

    const settings = db.getSettings();
    db.updateLead(lead.id, { status: 'sending', error: undefined });

    await sendColdEmail({
      to: lead.email,
      subject,
      body: lead.emailDraft
    }, settings);

    const updated = db.updateLead(lead.id, {
      status: 'sent',
      sentAt: new Date().toISOString()
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
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = db.getSettings();
    const result = await createLeadSubdomain(lead, settings);

    if (result.success) {
      const updated = db.updateLead(lead.id, {
        subdomain: result.subdomain,
        demoSiteUrl: result.url,
        siteStatus: 'subdomain_created'
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
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = db.getSettings();
    db.updateLead(lead.id, { siteStatus: 'building' });

    const html = await generateWebsiteHtml(lead, settings);
    const updated = db.updateLead(lead.id, {
      demoSiteHtml: html,
      siteStatus: 'building'
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
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.demoSiteHtml) return res.status(400).json({ error: 'Website HTML has not been generated yet' });

    const settings = db.getSettings();
    const subdomain = lead.subdomain || (await createLeadSubdomain(lead, settings)).subdomain;

    const result = await deployLeadWebsite(subdomain, lead.demoSiteHtml, settings);
    if (result.success) {
      const updated = db.updateLead(lead.id, {
        subdomain,
        demoSiteUrl: result.url,
        siteStatus: 'deployed',
        status: 'site_ready'
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
    const lead = db.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = db.getSettings();
    db.updateLead(lead.id, { siteStatus: 'building' });

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
      status: 'site_ready'
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
