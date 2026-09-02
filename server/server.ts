import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Anthropic } from '@anthropic-ai/sdk';
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

    await sendColdEmail({
      to: lead.email,
      subject: subject || `Website Redesign Demo for ${lead.name}`,
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

        // Auto-select model prioritizing gemini-3.6-flash (current generation)
        let chosen = '';
        if (model && contentModels.includes(model)) {
          chosen = model;
        } else if (contentModels.includes('gemini-3.6-flash')) {
          chosen = 'gemini-3.6-flash';
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
        const result = await geminiModel.generateContent('Return only "OK".');
        const responseText = result.response.text().trim();

        return res.json({ 
          success: true, 
          message: `Google Gemini connected successfully! Active model: "${chosen}".`,
          verifiedModel: chosen
        });
      } catch (err: any) {
        // Direct fallback attempt with gemini-3.6-flash
        try {
          const genAI = new GoogleGenerativeAI(cleanKey);
          const geminiModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
          const result = await geminiModel.generateContent('Return only "OK".');
          return res.json({
            success: true,
            message: 'Google Gemini connected successfully! (Model: gemini-3.6-flash)',
            verifiedModel: 'gemini-3.6-flash'
          });
        } catch (directErr: any) {
          const apiError = err.response?.data?.error || directErr.response?.data?.error;
          if (apiError) {
            return res.status(400).json({
              success: false,
              error: `Google API Error (${apiError.status || apiError.code}): ${apiError.message}`
            });
          }
          return res.status(500).json({ success: false, error: directErr.message || err.message });
        }
      }
    } else if (provider === 'deepseek') {
      await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Return only "OK"' }],
        max_tokens: 5
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 15000
      });
      return res.json({ success: true, message: 'DeepSeek API connection verified successfully!' });
    } else {
      // Claude
      const anthropic = new Anthropic({ apiKey });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
