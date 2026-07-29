import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { db } from './db.js';
import { crawlWebsite, parseLeadsGorillaCSV, scrapeLeadsGorilla } from './scraper.js';
import { generateColdEmail } from './composer.js';
import { sendColdEmail } from './gmail.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Get all leads
app.get('/api/leads', (req, res) => {
  try {
    res.json(db.getLeads());
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
