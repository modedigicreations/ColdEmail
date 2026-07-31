import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, Send, Settings as SettingsIcon, Users, Sparkles, Mail, 
  CheckCircle, Loader2, Globe, Trash2, Cpu, Edit,
  Play, RefreshCw, XCircle, Search, AlertCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

interface Lead {
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

interface Settings {
  anthropicApiKey: string;
  gmailEmail: string;
  gmailAppPassword: string;
  systemPrompt: string;
}

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'leads' | 'settings'>('leads');
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'scrape'>('import');

  // Leads & Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings>({
    anthropicApiKey: '',
    gmailEmail: '',
    gmailAppPassword: '',
    systemPrompt: ''
  });
  
  // Selection
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Scraping Parameters
  const [scrapeParams, setScrapeParams] = useState({
    keyword: 'Dental Clinics',
    location: 'Lagos, Nigeria',
    email: '',
    pass: ''
  });

  // Action Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [isAutomating, setIsAutomating] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [automationProgress, setAutomationProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const isAutomatingRef = useRef(false);
  const isBulkSendingRef = useRef(false);
  
  // Custom Email Subject & Body Edit
  const [emailSubject, setEmailSubject] = useState('Improvement Audit for {{Business Name}}');
  const [editedBody, setEditedBody] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchLeads();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      setEditedBody(selectedLead.emailDraft || '');
    } else {
      setEditedBody('');
    }
  }, [selectedLeadId, leads]);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${API_BASE}/leads`);
      const data = await res.json();
      setLeads(data);
    } catch (e) {
      console.error(e);
      showMsg('Failed to load leads from backend', 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      setSettings(data);
      showMsg('Settings saved successfully');
    } catch (e) {
      showMsg('Failed to save settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Drag/Drop
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const res = await fetch(`${API_BASE}/leads/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Imported ${data.count} new leads out of ${data.total} parsed.`);
        fetchLeads();
      } else {
        showMsg(data.error || 'CSV upload failed', 'error');
      }
    } catch (err) {
      showMsg('Network error during file upload', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Puppeteer Scraping
  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScraping(true);
    try {
      const res = await fetch(`${API_BASE}/leads/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapeParams)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Scraping complete. Added ${data.count} leads.`);
        fetchLeads();
      } else {
        showMsg(data.error || 'Scraping failed', 'error');
      }
    } catch (err) {
      showMsg('Network error during scraping', 'error');
    } finally {
      setIsScraping(false);
    }
  };

  // Lead Actions
  const crawlLead = async (id: string) => {
    setLoadingLeadId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}/crawl`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Crawl failed');
      }
      showMsg('Website crawled successfully');
      fetchLeads();
    } catch (e: any) {
      showMsg(e.message, 'error');
      fetchLeads();
    } finally {
      setLoadingLeadId(null);
    }
  };

  const draftLead = async (id: string) => {
    setLoadingLeadId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}/draft`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Claude AI draft failed');
      }
      showMsg('Email draft generated');
      fetchLeads();
    } catch (e: any) {
      showMsg(e.message, 'error');
      fetchLeads();
    } finally {
      setLoadingLeadId(null);
    }
  };

  const saveEditedDraft = async (id: string) => {
    setLoadingLeadId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDraft: editedBody })
      });
      if (res.ok) {
        showMsg('Draft updated successfully');
        fetchLeads();
      }
    } catch (e) {
      showMsg('Failed to update draft', 'error');
    } finally {
      setLoadingLeadId(null);
    }
  };

  const resolveSubject = (subjectTemplate: string, lead: Lead) => {
    return subjectTemplate
      .replace(/\{\{\s*Business Name\s*\}\}/g, lead.name)
      .replace(/\{\{\s*Category\s*\}\}/g, lead.category || 'your business')
      .replace(/\{\{\s*SEO Score\s*\}\}/g, lead.seoScore ? `${lead.seoScore}/100` : 'N/A')
      .replace(/\{\{\s*GMB Rating\s*\}\}/g, lead.gmbRating ? `${lead.gmbRating}/5` : 'N/A');
  };

  const sendLeadEmail = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    
    setLoadingLeadId(id);
    const resolvedSubject = resolveSubject(emailSubject, lead);

    try {
      const res = await fetch(`${API_BASE}/leads/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: resolvedSubject })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Send failed');
      }
      showMsg(`Cold email sent to ${lead.email}!`);
      fetchLeads();
    } catch (e: any) {
      showMsg(e.message, 'error');
      fetchLeads();
    } finally {
      setLoadingLeadId(null);
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await fetch(`${API_BASE}/leads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMsg('Lead deleted');
        if (selectedLeadId === id) setSelectedLeadId(null);
        fetchLeads();
      }
    } catch (e) {
      showMsg('Failed to delete lead', 'error');
    }
  };

  const clearAllLeads = async () => {
    if (!confirm('This will delete all leads in the database. Continue?')) return;
    try {
      const res = await fetch(`${API_BASE}/leads`, { method: 'DELETE' });
      if (res.ok) {
        showMsg('All leads cleared');
        setSelectedLeadId(null);
        fetchLeads();
      }
    } catch (e) {
      showMsg('Failed to clear database', 'error');
    }
  };

  // Bulk Automation Runner (Crawl & AI Compose)
  const startBulkAutomation = async () => {
    const targetLeads = leads.filter(l => l.status === 'not_started' || l.status === 'failed');
    if (targetLeads.length === 0) {
      showMsg('No pending leads found to automate.', 'error');
      return;
    }

    isAutomatingRef.current = true;
    setIsAutomating(true);
    setAutomationProgress({ current: 0, total: targetLeads.length, label: 'Initializing Automation' });

    let processedCount = 0;
    for (const lead of targetLeads) {
      if (!isAutomatingRef.current) {
        break;
      }
      
      setAutomationProgress({ 
        current: processedCount + 1, 
        total: targetLeads.length, 
        label: `Processing: ${lead.name}` 
      });

      try {
        // Step 1: Crawl website if it exists
        if (lead.website) {
          setLoadingLeadId(lead.id);
          const crawlRes = await fetch(`${API_BASE}/leads/${lead.id}/crawl`, { method: 'POST' });
          if (!crawlRes.ok) throw new Error('Crawl failed');
        }
        
        if (!isAutomatingRef.current) break;

        // Step 2: Draft AI Email
        setLoadingLeadId(lead.id);
        const draftRes = await fetch(`${API_BASE}/leads/${lead.id}/draft`, { method: 'POST' });
        if (!draftRes.ok) throw new Error('Claude drafting failed');

        // Refresh leads
        const updateRes = await fetch(`${API_BASE}/leads`);
        const freshData = await updateRes.json();
        setLeads(freshData);
      } catch (err: any) {
        console.error(`Error processing lead ${lead.name}:`, err.message);
      }
      processedCount++;
    }

    setLoadingLeadId(null);
    isAutomatingRef.current = false;
    setIsAutomating(false);
    setAutomationProgress(null);
    showMsg('Bulk automation complete!');
    fetchLeads();
  };

  const stopBulkAutomation = () => {
    isAutomatingRef.current = false;
    setIsAutomating(false);
    setAutomationProgress(null);
    showMsg('Stopping bulk automation...', 'error');
  };

  // Bulk Email Outbox Dispatcher
  const startBulkSending = async () => {
    const draftedLeads = leads.filter(l => l.status === 'drafted' && l.email);
    if (draftedLeads.length === 0) {
      showMsg('No drafted leads with valid email addresses found to send.', 'error');
      return;
    }

    isBulkSendingRef.current = true;
    setIsBulkSending(true);
    setAutomationProgress({ current: 0, total: draftedLeads.length, label: 'Initializing Email Send' });

    let processedCount = 0;
    for (const lead of draftedLeads) {
      if (!isBulkSendingRef.current) {
        break;
      }

      setAutomationProgress({
        current: processedCount + 1,
        total: draftedLeads.length,
        label: `Sending outreach: ${lead.name} (${lead.email})`
      });

      setLoadingLeadId(lead.id);
      const resolvedSubject = resolveSubject(emailSubject, lead);

      try {
        const res = await fetch(`${API_BASE}/leads/${lead.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: resolvedSubject })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Send failed');
        }

        // Refresh leads
        const updateRes = await fetch(`${API_BASE}/leads`);
        const freshData = await updateRes.json();
        setLeads(freshData);
      } catch (err: any) {
        console.error(`Error sending email to ${lead.name}:`, err.message);
      }

      // 2-second rate-limiting delay between dispatches
      await new Promise(resolve => setTimeout(resolve, 2000));
      processedCount++;
    }

    setLoadingLeadId(null);
    isBulkSendingRef.current = false;
    setIsBulkSending(false);
    setAutomationProgress(null);
    showMsg('Bulk email outreach sending complete!');
    fetchLeads();
  };

  const stopBulkSending = () => {
    isBulkSendingRef.current = false;
    setIsBulkSending(false);
    setAutomationProgress(null);
    showMsg('Stopping bulk sending...', 'error');
  };

  // Stats computation
  const stats = {
    total: leads.length,
    crawled: leads.filter(l => l.status === 'crawled').length,
    drafted: leads.filter(l => l.status === 'drafted').length,
    sent: leads.filter(l => l.status === 'sent').length,
    failed: leads.filter(l => l.status === 'failed').length
  };

  // Filtered leads listing
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.category && lead.category.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      {/* Navbar Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '32px', margin: 0, fontWeight: 800 }}>ColdReach AI</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Leads Gorilla & Gmail Cold Outreach Agent System</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${activeTab === 'leads' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('leads')}
          >
            <Users size={16} /> Dashboard
          </button>
          <button 
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} /> API Settings
          </button>
        </div>
      </header>

      {/* Global Notification Banner */}
      {message && (
        <div className="glass-card" style={{ 
          padding: '12px 18px', 
          marginBottom: '20px', 
          borderColor: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {message.type === 'success' ? <CheckCircle color="var(--success)" size={18} /> : <AlertCircle color="var(--danger)" size={18} />}
          <span style={{ fontSize: '14px' }}>{message.text}</span>
        </div>
      )}

      {activeTab === 'settings' ? (
        /* Settings Tab */
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingsIcon size={22} color="var(--primary)" /> API & Email Settings
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Configure your AI models and Gmail dispatch credentials. These configurations are stored locally in the database.
          </p>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label>Claude Anthropic API Key</label>
              <input 
                type="password" 
                className="form-control" 
                value={settings.anthropicApiKey}
                onChange={e => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used by the composer agent to read scraped context and write highly personalized cold outreach emails.
              </p>
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label>Gmail Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={settings.gmailEmail}
                  onChange={e => setSettings({ ...settings, gmailEmail: e.target.value })}
                  placeholder="name@gmail.com"
                />
              </div>
              <div>
                <label>Gmail App Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={settings.gmailAppPassword}
                  onChange={e => setSettings({ ...settings, gmailAppPassword: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx"
                />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '16px' }}>
              Gmail App Passwords can be generated in your Google Account Security settings under 2-Step Verification.
            </p>

            <div className="form-group">
              <label>AI Personalization Prompt (System Prompt)</label>
              <textarea 
                className="form-control" 
                rows={5}
                value={settings.systemPrompt}
                onChange={e => setSettings({ ...settings, systemPrompt: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Save Configurations'}
            </button>
          </form>
        </div>
      ) : (
        /* Leads Dashboard Tab */
        <div className="dashboard-grid">
          {/* Main Dashboard Section (Left Column) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Stats Row */}
            <div className="stats-row">
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Total Leads</p>
                <p className="stat-val">{stats.total}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Crawled Website</p>
                <p className="stat-val" style={{ color: 'var(--info)' }}>{stats.crawled}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Drafts Ready</p>
                <p className="stat-val" style={{ color: 'var(--warning)' }}>{stats.drafted}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Emails Sent</p>
                <p className="stat-val" style={{ color: 'var(--success)' }}>{stats.sent}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Failed</p>
                <p className="stat-val" style={{ color: 'var(--danger)' }}>{stats.failed}</p>
              </div>
            </div>

            {/* Ingestion & Scrape Card */}
            <div className="glass-card">
              <div className="tabs">
                <button 
                  className={`tab-btn ${activeSubTab === 'import' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('import')}
                >
                  <UploadCloud size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> CSV Import (Leads Gorilla)
                </button>
                <button 
                  className={`tab-btn ${activeSubTab === 'scrape' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('scrape')}
                >
                  <Cpu size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Automated Puppeteer Scraper
                </button>
              </div>

              {activeSubTab === 'import' ? (
                <div>
                  <div className="upload-zone" onClick={() => document.getElementById('csv-input')?.click()}>
                    <UploadCloud size={32} color="var(--primary)" style={{ margin: '0 auto 10px' }} />
                    <p style={{ fontWeight: 500, fontSize: '14px' }}>Click to select or drag & drop Leads Gorilla CSV export</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Supported fields: Name, Email, Website, Category, SEO Score, SEO Issues</p>
                    <input 
                      type="file" 
                      id="csv-input" 
                      accept=".csv" 
                      style={{ display: 'none' }}
                      onChange={handleCSVUpload}
                    />
                  </div>
                </div>
              ) : (
                <form onSubmit={handleScrapeSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Keyword</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={scrapeParams.keyword}
                      onChange={e => setScrapeParams({ ...scrapeParams, keyword: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={scrapeParams.location}
                      onChange={e => setScrapeParams({ ...scrapeParams, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Leads Gorilla Email</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={scrapeParams.email}
                      onChange={e => setScrapeParams({ ...scrapeParams, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={scrapeParams.pass}
                      onChange={e => setScrapeParams({ ...scrapeParams, pass: e.target.value })}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={isScraping}
                    style={{ gridColumn: 'span 2' }}
                  >
                    {isScraping ? <Loader2 className="animate-spin" size={16} /> : 'Start Puppeteer Browser Scrape'}
                  </button>
                </form>
              )}
            </div>

            {/* Leads Listing Section */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <h2>Leads List</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {isAutomating ? (
                    <button 
                      className="btn btn-danger" 
                      onClick={stopBulkAutomation}
                    >
                      <XCircle size={14} /> Stop Crawl/Compose
                    </button>
                  ) : isBulkSending ? (
                    <button 
                      className="btn btn-danger" 
                      onClick={stopBulkSending}
                    >
                      <XCircle size={14} /> Stop Bulk Sending
                    </button>
                  ) : (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        onClick={startBulkAutomation}
                        disabled={leads.length === 0}
                        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                      >
                        <Play size={14} /> Bulk Crawl & AI Compose
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={startBulkSending}
                        disabled={leads.filter(l => l.status === 'drafted' && l.email).length === 0}
                        style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                      >
                        <Send size={14} /> Bulk Send Drafts
                      </button>
                    </>
                  )}
                  <button 
                    className="btn btn-danger" 
                    onClick={clearAllLeads}
                    disabled={leads.length === 0 || isAutomating || isBulkSending}
                  >
                    <Trash2 size={14} /> Clear All
                  </button>
                </div>
              </div>

              {/* Progress Tracker UI */}
              {automationProgress && (
                <div style={{ 
                  background: 'rgba(139, 92, 246, 0.05)', 
                  border: '1px solid var(--border-glow)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  marginBottom: '16px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {automationProgress.label}
                    </span>
                    <span>
                      {automationProgress.current} / {automationProgress.total} Leads
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      background: 'var(--primary)', 
                      height: '100%', 
                      width: `${(automationProgress.current / automationProgress.total) * 100}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* Filters & Search */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '36px' }}
                    placeholder="Search by name, email, niche..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <select 
                  className="form-control"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="crawled">Crawled</option>
                  <option value="drafted">Drafted</option>
                  <option value="sending">Sending</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Leads Table */}
              <div className="table-container">
                {filteredLeads.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leads found matching current filters.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Lead Name / Niche</th>
                        <th>Website & Email</th>
                        <th>SEO Issues</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => (
                        <tr 
                          key={lead.id} 
                          onClick={() => setSelectedLeadId(lead.id)}
                          style={{ cursor: 'pointer', background: selectedLeadId === lead.id ? 'rgba(139,92,246,0.05)' : '' }}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>{lead.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{lead.category || 'N/A'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '13px' }}>
                              {lead.website ? (
                                <a href={`https://${lead.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Globe size={12} /> {lead.website}
                                </a>
                              ) : 'No Web'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{lead.email || 'No Email'}</div>
                          </td>
                          <td>
                            {lead.seoIssues && lead.seoIssues.length > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {lead.seoIssues.slice(0, 2).map((iss, i) => (
                                  <span key={i} style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                    {iss}
                                  </span>
                                ))}
                                {lead.seoIssues.length > 2 && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{lead.seoIssues.length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge badge-${lead.status}`}>
                              {lead.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {lead.website && (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                  onClick={() => crawlLead(lead.id)}
                                  disabled={loadingLeadId === lead.id}
                                  title="Crawl business website"
                                >
                                  {loadingLeadId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                                </button>
                              )}
                              <button 
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '12px', borderColor: 'var(--warning)', color: '#fde047' }}
                                onClick={() => draftLead(lead.id)}
                                disabled={loadingLeadId === lead.id}
                                title="Draft cold email with Claude"
                              >
                                {loadingLeadId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              </button>
                              <button 
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                onClick={() => deleteLead(lead.id)}
                                title="Delete Lead"
                              >
                                <Trash2 size={12} color="var(--danger)" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* AI Outreach Pane & Composer (Right Column) */}
          <div className="glass-card" style={{ height: 'fit-content', position: 'sticky', top: '24px' }}>
            {!selectedLead ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Mail size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <h3>No Lead Selected</h3>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>Select a lead from the dashboard to preview, write, or send personalized outreach emails.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px' }}>{selectedLead.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{selectedLead.category || 'Local Business'}</p>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px' }}
                    onClick={() => setSelectedLeadId(null)}
                  >
                    Close
                  </button>
                </div>

                {/* Lead Parameters */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div><strong>SEO Score:</strong> {selectedLead.seoScore ? `${selectedLead.seoScore}/100` : 'N/A'}</div>
                    <div><strong>GMB Rating:</strong> {selectedLead.gmbRating ? `${selectedLead.gmbRating}/5` : 'N/A'}</div>
                  </div>
                  <div><strong>Email:</strong> {selectedLead.email || <span style={{ color: 'var(--danger)' }}>Missing (Need Email to Send)</span>}</div>
                  {selectedLead.website && (
                    <div style={{ marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>Website:</strong> <a href={`https://${selectedLead.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>{selectedLead.website}</a>
                    </div>
                  )}
                  {selectedLead.seoIssues && selectedLead.seoIssues.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Identified SEO Issues:</strong>
                      <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                        {selectedLead.seoIssues.map((iss, i) => <li key={i}>{iss}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Crawled Website Meta */}
                {selectedLead.crawledText && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Crawled Website Context</label>
                    <textarea 
                      className="form-control" 
                      style={{ fontSize: '12px', background: 'rgba(255,255,255,0.01)', resize: 'none' }} 
                      rows={3} 
                      value={selectedLead.crawledText} 
                      readOnly 
                    />
                  </div>
                )}

                {/* Email Subject Selector */}
                <div className="form-group">
                  <label>Email Subject</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                  />
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Subject resolves <code>{"{{Business Name}}"}</code> automatically.
                  </p>
                </div>

                {/* Email Template Preview / Draft */}
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    AI-Personalized Cold Email Draft
                  </label>

                  {!selectedLead.emailDraft ? (
                    <div style={{ border: '1px dashed var(--border-color)', padding: '24px', textAlign: 'center', borderRadius: '8px' }}>
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>No email draft generated yet.</p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => draftLead(selectedLead.id)}
                        disabled={loadingLeadId === selectedLead.id}
                        style={{ width: '100%' }}
                      >
                        {loadingLeadId === selectedLead.id ? (
                          <>
                            <Loader2 className="animate-spin" size={16} /> Crawling website & composing...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} /> Compose Email with Claude AI
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <textarea 
                        className="form-control" 
                        rows={10} 
                        style={{ fontSize: '14px', lineHeight: '1.4', fontFamily: 'monospace' }}
                        value={editedBody}
                        onChange={e => setEditedBody(e.target.value)}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => saveEditedDraft(selectedLead.id)}
                          disabled={loadingLeadId === selectedLead.id || editedBody === selectedLead.emailDraft}
                        >
                          <Edit size={14} /> Save Edits
                        </button>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => draftLead(selectedLead.id)}
                          disabled={loadingLeadId === selectedLead.id}
                        >
                          <RefreshCw size={14} /> Regenerate
                        </button>
                      </div>

                      <button 
                        className="btn btn-primary"
                        onClick={() => sendLeadEmail(selectedLead.id)}
                        disabled={loadingLeadId === selectedLead.id || !selectedLead.email}
                        style={{ width: '100%', marginTop: '16px', background: 'var(--success)' }}
                      >
                        {loadingLeadId === selectedLead.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <>
                            <Send size={16} /> Send Cold Outreach Email
                          </>
                        )}
                      </button>
                      {!selectedLead.email && (
                        <p style={{ color: 'var(--danger)', fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>
                          Email address is missing. Cannot send outreach mail.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Log error if failed */}
                  {selectedLead.status === 'failed' && selectedLead.error && (
                    <div style={{ marginTop: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', display: 'flex', gap: '8px', color: '#fca5a5' }}>
                      <XCircle size={16} style={{ flexShrink: 0 }} />
                      <div>
                        <strong>Action Failed:</strong> {selectedLead.error}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
