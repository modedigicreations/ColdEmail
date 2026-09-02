import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, Send, Settings as SettingsIcon, Users, Sparkles, Mail, 
  CheckCircle, Loader2, Globe, Trash2, Cpu, Edit,
  Play, RefreshCw, XCircle, Search, AlertCircle,
  Monitor, Smartphone, ExternalLink, LayoutTemplate, Server
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001/api'
    : '/api'
);

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
  subdomain?: string;
  demoSiteUrl?: string;
  demoSiteHtml?: string;
  siteStatus?: 'not_started' | 'subdomain_created' | 'building' | 'deployed' | 'failed';
  emailDraft?: string;
  status: 'not_started' | 'crawled' | 'site_ready' | 'drafted' | 'sending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
}

interface Settings {
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
  // Hosting & Subdomain
  hostingProvider: 'wildcard' | 'cpanel' | 'cloudflare' | 'puppeteer_dashboard';
  baseDomain: string;
  cpanelHost?: string;
  cpanelUser?: string;
  cpanelApiToken?: string;
  cloudflareApiToken?: string;
  cloudflareZoneId?: string;
  websitePromptTemplate: string;
}

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'leads' | 'settings'>('leads');
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'scrape'>('import');

  // Leads & Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings>({
    aiProvider: 'claude',
    anthropicApiKey: '',
    deepseekApiKey: '',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    emailProvider: 'gmail',
    gmailEmail: '',
    gmailAppPassword: '',
    resendApiKey: '',
    resendFromEmail: 'onboarding@resend.dev',
    systemPrompt: '',
    emailSignature: '',
    hostingProvider: 'wildcard',
    baseDomain: 'demo.modedigicreations.com',
    cpanelHost: '',
    cpanelUser: '',
    cpanelApiToken: '',
    cloudflareApiToken: '',
    cloudflareZoneId: '',
    websitePromptTemplate: ''
  });
  
  // Selection
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Right Drawer Tab & Viewport
  const [leadDrawerTab, setLeadDrawerTab] = useState<'website' | 'email'>('website');
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'mobile'>('desktop');

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
  const [isBuildingSiteId, setIsBuildingSiteId] = useState<string | null>(null);
  const [isAutomating, setIsAutomating] = useState(false);
  const [isBulkBuilding, setIsBulkBuilding] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isFullAutomating, setIsFullAutomating] = useState(false);
  const [automationProgress, setAutomationProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const isAutomatingRef = useRef(false);
  const isBulkBuildingRef = useRef(false);
  const isBulkSendingRef = useRef(false);
  
  // Custom Email Subject & Body Edit
  const [emailSubject, setEmailSubject] = useState('New Concept Website Redesign for {{Business Name}}');
  const [editedBody, setEditedBody] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchLeads();
    fetchSettings();
    checkAutomationStatus();
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

  // Save leads to localStorage whenever they change
  useEffect(() => {
    if (leads && leads.length > 0) {
      localStorage.setItem('coldreach_leads', JSON.stringify(leads));
    } else if (leads && leads.length === 0) {
      localStorage.removeItem('coldreach_leads');
    }
  }, [leads]);

  // Poll leads list and status every 5 seconds if background automation is running
  useEffect(() => {
    let interval: any;
    if (isFullAutomating) {
      interval = setInterval(() => {
        fetchLeads();
        checkAutomationStatus();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFullAutomating]);

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${API_BASE}/leads`);
      const data = await res.json();
      
      // If backend database has no leads, but we have cached leads, restore them automatically
      if (Array.isArray(data) && data.length === 0) {
        const localLeadsStr = localStorage.getItem('coldreach_leads');
        if (localLeadsStr) {
          try {
            const localLeads = JSON.parse(localLeadsStr);
            if (Array.isArray(localLeads) && localLeads.length > 0) {
              console.log('Restoring leads from localStorage to server database...');
              await fetch(`${API_BASE}/leads/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localLeads)
              });
              setLeads(localLeads);
              return;
            }
          } catch (parseErr) {
            console.error('Failed to parse local leads', parseErr);
          }
        }
      }
      setLeads(data);
    } catch (e) {
      console.error(e);
      const localLeadsStr = localStorage.getItem('coldreach_leads');
      if (localLeadsStr) {
        try {
          const localLeads = JSON.parse(localLeadsStr);
          setLeads(localLeads);
          showMsg('Offline Mode: Loaded leads from browser storage', 'success');
          return;
        } catch {}
      }
      showMsg('Failed to load leads from backend', 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      const data = await res.json();
      
      // Restore settings to backend if missing on startup
      if (!data.gmailEmail && !data.anthropicApiKey && !data.deepseekApiKey && !data.resendApiKey) {
        const localSettingsStr = localStorage.getItem('coldreach_settings');
        if (localSettingsStr) {
          try {
            const localSettings = JSON.parse(localSettingsStr);
            console.log('Restoring settings from localStorage to server...');
            await fetch(`${API_BASE}/settings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localSettings)
            });
            setSettings(localSettings);
            return;
          } catch {}
        }
      }
      setSettings(data);
    } catch (e) {
      console.error(e);
      const localSettingsStr = localStorage.getItem('coldreach_settings');
      if (localSettingsStr) {
        try {
          setSettings(JSON.parse(localSettingsStr));
        } catch {}
      }
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
      localStorage.setItem('coldreach_settings', JSON.stringify(data));
      showMsg('Settings saved successfully');
    } catch (e) {
      console.error(e);
      showMsg('Failed to save settings to server. Saving locally.', 'error');
      localStorage.setItem('coldreach_settings', JSON.stringify(settings));
    } finally {
      setIsLoading(false);
    }
  };

  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingCpanel, setTestingCpanel] = useState(false);
  const [cpanelTestResult, setCpanelTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const apiKey = settings.aiProvider === 'gemini' ? settings.geminiApiKey :
                     settings.aiProvider === 'deepseek' ? settings.deepseekApiKey :
                     settings.anthropicApiKey;
      const res = await fetch(`${API_BASE}/settings/test-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.aiProvider,
          apiKey,
          model: settings.geminiModel
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiTestResult({ success: true, message: data.message });
        if (data.verifiedModel) {
          setSettings(prev => ({ ...prev, geminiModel: data.verifiedModel }));
        }
      } else {
        setAiTestResult({ success: false, message: data.error || 'Connection test failed.' });
      }
    } catch (err: any) {
      setAiTestResult({ success: false, message: err.message });
    } finally {
      setTestingAi(false);
    }
  };

  const handleTestCpanel = async () => {
    setTestingCpanel(true);
    setCpanelTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/settings/test-cpanel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpanelHost: settings.cpanelHost,
          cpanelUser: settings.cpanelUser,
          cpanelApiToken: settings.cpanelApiToken
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCpanelTestResult({ success: true, message: data.message });
      } else {
        setCpanelTestResult({ success: false, message: data.error || 'Connection test failed.' });
      }
    } catch (err: any) {
      setCpanelTestResult({ success: false, message: err.message });
    } finally {
      setTestingCpanel(false);
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

  const checkAutomationStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/leads/automate-all/status`);
      const data = await res.json();
      setIsFullAutomating(data.isAutomating);
    } catch (err) {
      console.error('Failed to fetch automation status', err);
    }
  };

  // Puppeteer Scraping
  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScraping(true);
    showMsg('Starting Leads Gorilla search...', 'success');
    try {
      const res = await fetch(`${API_BASE}/leads/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapeParams)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Scrape completed. Added ${data.count} leads.`);
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

  // Launch Fully Automated Outreach Campaign (Scrape -> Subdomain -> Site -> Draft -> Send)
  const handleFullAutomationSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!scrapeParams.keyword || !scrapeParams.location || !scrapeParams.email || !scrapeParams.pass) {
      showMsg('Keyword, Location, and Leads Gorilla credentials are required.', 'error');
      return;
    }

    setIsFullAutomating(true);
    showMsg('Launching full pipeline: Scrape -> Subdomain -> AI Site -> Draft -> Send...', 'success');
    try {
      const res = await fetch(`${API_BASE}/leads/automate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: scrapeParams.keyword,
          location: scrapeParams.location,
          email: scrapeParams.email,
          pass: scrapeParams.pass,
          subject: emailSubject
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message || 'Campaign pipeline started in background!', 'success');
        fetchLeads();
      } else {
        showMsg(data.error || 'Failed to start campaign', 'error');
        setIsFullAutomating(false);
      }
    } catch (err) {
      showMsg('Network error starting campaign', 'error');
      setIsFullAutomating(false);
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

  // Build & Deploy Demo Website for a single lead
  const buildAndDeployLeadSite = async (id: string) => {
    setIsBuildingSiteId(id);
    showMsg('Allocating subdomain, building AI website, and deploying...', 'success');
    try {
      const res = await fetch(`${API_BASE}/leads/${id}/build-and-deploy`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Website build failed');
      }
      const updated = await res.json();
      showMsg(`Website deployed to ${updated.demoSiteUrl || updated.subdomain}!`, 'success');
      fetchLeads();
      setLeadDrawerTab('website');
    } catch (e: any) {
      showMsg(e.message, 'error');
      fetchLeads();
    } finally {
      setIsBuildingSiteId(null);
    }
  };

  const draftLead = async (id: string) => {
    setLoadingLeadId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}/draft`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI draft generation failed');
      }
      showMsg('Email draft generated with demo website link!');
      fetchLeads();
      setLeadDrawerTab('email');
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
      .replace(/\{\{\s*Business Name\s*\}\}/gi, lead.name)
      .replace(/\{\{\s*Category\s*\}\}/gi, lead.category || 'your business')
      .replace(/\{\{\s*SEO Score\s*\}\}/gi, lead.seoScore ? `${lead.seoScore}/100` : 'N/A')
      .replace(/\{\{\s*GMB Rating\s*\}\}/gi, lead.gmbRating ? `${lead.gmbRating}/5` : 'N/A')
      .replace(/\{\{\s*Demo Website\s*\}\}/gi, lead.demoSiteUrl || '')
      .replace(/\{\{\s*demoSiteUrl\s*\}\}/gi, lead.demoSiteUrl || '');
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
    setAutomationProgress({ current: 0, total: targetLeads.length, label: 'Initializing Lead Enrichment' });

    let processedCount = 0;
    for (const lead of targetLeads) {
      if (!isAutomatingRef.current) break;
      
      setAutomationProgress({ 
        current: processedCount + 1, 
        total: targetLeads.length, 
        label: `Crawl & Draft: ${lead.name}` 
      });

      try {
        if (lead.website) {
          setLoadingLeadId(lead.id);
          await fetch(`${API_BASE}/leads/${lead.id}/crawl`, { method: 'POST' });
        }
        
        if (!isAutomatingRef.current) break;

        // Draft AI Email
        setLoadingLeadId(lead.id);
        await fetch(`${API_BASE}/leads/${lead.id}/draft`, { method: 'POST' });

        const updateRes = await fetch(`${API_BASE}/leads`);
        setLeads(await updateRes.json());
      } catch (err: any) {
        console.error(`Error processing lead ${lead.name}:`, err.message);
      }
      processedCount++;
    }

    setLoadingLeadId(null);
    isAutomatingRef.current = false;
    setIsAutomating(false);
    setAutomationProgress(null);
    showMsg('Bulk enrichment complete!');
    fetchLeads();
  };

  // Bulk Build & Deploy Websites for all leads lacking one
  const startBulkSiteBuilding = async () => {
    const targetLeads = leads.filter(l => l.siteStatus !== 'deployed');
    if (targetLeads.length === 0) {
      showMsg('All leads already have live deployed websites!', 'success');
      return;
    }

    isBulkBuildingRef.current = true;
    setIsBulkBuilding(true);
    setAutomationProgress({ current: 0, total: targetLeads.length, label: 'Building Demo Websites' });

    let processedCount = 0;
    for (const lead of targetLeads) {
      if (!isBulkBuildingRef.current) break;

      setAutomationProgress({
        current: processedCount + 1,
        total: targetLeads.length,
        label: `Building & Deploying: ${lead.name}`
      });

      setIsBuildingSiteId(lead.id);
      try {
        await fetch(`${API_BASE}/leads/${lead.id}/build-and-deploy`, { method: 'POST' });
        const updateRes = await fetch(`${API_BASE}/leads`);
        setLeads(await updateRes.json());
      } catch (err: any) {
        console.error(`Error building site for ${lead.name}:`, err.message);
      }
      processedCount++;
    }

    setIsBuildingSiteId(null);
    isBulkBuildingRef.current = false;
    setIsBulkBuilding(false);
    setAutomationProgress(null);
    showMsg('Bulk website deployment complete!');
    fetchLeads();
  };

  const stopBulkSiteBuilding = () => {
    isBulkBuildingRef.current = false;
    setIsBulkBuilding(false);
    setAutomationProgress(null);
    showMsg('Stopping bulk site deployment...', 'error');
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
      if (!isBulkSendingRef.current) break;

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

        const updateRes = await fetch(`${API_BASE}/leads`);
        setLeads(await updateRes.json());
      } catch (err: any) {
        console.error(`Error sending email to ${lead.name}:`, err.message);
      }

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
    sitesDeployed: leads.filter(l => l.siteStatus === 'deployed').length,
    drafted: leads.filter(l => l.status === 'drafted').length,
    sent: leads.filter(l => l.status === 'sent').length,
    failed: leads.filter(l => l.status === 'failed').length
  };

  // Filtered leads listing
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.category && lead.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lead.subdomain && lead.subdomain.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter || 
      (statusFilter === 'site_ready' && lead.siteStatus === 'deployed');
    
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      {/* Navbar Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '32px', margin: 0, fontWeight: 800 }}>ColdReach AI</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Autonomous Lead-to-Website-to-Email Cold Outreach Engine
          </p>
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
            <SettingsIcon size={16} /> Hosting & API Settings
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
        <div className="glass-card" style={{ maxWidth: '880px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingsIcon size={22} color="var(--primary)" /> System & Hosting Configuration
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Configure your AI Models, Hosting Dashboard for Subdomain Creation, and Email Dispatching.
          </p>

          <form onSubmit={handleSaveSettings}>
            {/* 1. AI Provider Selection */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="var(--primary)" /> AI Copywriter & Web Designer Provider
              </h3>
              <div className="form-group">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input 
                      type="radio" 
                      name="aiProvider"
                      checked={settings.aiProvider === 'gemini'}
                      onChange={() => setSettings({ ...settings, aiProvider: 'gemini' })}
                    />
                    Google Gemini (Recommended / Fast)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input 
                      type="radio" 
                      name="aiProvider"
                      checked={settings.aiProvider === 'claude'}
                      onChange={() => setSettings({ ...settings, aiProvider: 'claude' })}
                    />
                    Claude 3.5 Sonnet (Anthropic)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input 
                      type="radio" 
                      name="aiProvider"
                      checked={settings.aiProvider === 'deepseek'}
                      onChange={() => setSettings({ ...settings, aiProvider: 'deepseek' })}
                    />
                    DeepSeek V3 / R1
                  </label>
                </div>
              </div>

              {settings.aiProvider === 'gemini' && (
                <div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>Google Gemini API Key</label>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '12px', color: 'var(--info)', textDecoration: 'none' }}
                      >
                        Get free API key at Google AI Studio &rarr;
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={settings.geminiApiKey || ''}
                        onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={handleTestAi}
                        disabled={testingAi || !settings.geminiApiKey}
                        style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 12px' }}
                      >
                        {testingAi ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Test Key
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: '340px' }}>
                    <label>Gemini Model</label>
                    <select 
                      className="form-control"
                      value={settings.geminiModel || 'gemini-3.6-flash'}
                      onChange={e => setSettings({ ...settings, geminiModel: e.target.value })}
                    >
                      <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended / Latest)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
                    </select>
                  </div>
                </div>
              )}

              {settings.aiProvider === 'claude' && (
                <div className="form-group">
                  <label>Claude Anthropic API Key</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={settings.anthropicApiKey}
                      onChange={e => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                      placeholder="sk-ant-..."
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={handleTestAi}
                      disabled={testingAi || !settings.anthropicApiKey}
                      style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 12px' }}
                    >
                      {testingAi ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Test Key
                    </button>
                  </div>
                </div>
              )}

              {settings.aiProvider === 'deepseek' && (
                <div className="form-group">
                  <label>DeepSeek API Key</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={settings.deepseekApiKey}
                      onChange={e => setSettings({ ...settings, deepseekApiKey: e.target.value })}
                      placeholder="sk-..."
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={handleTestAi}
                      disabled={testingAi || !settings.deepseekApiKey}
                      style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 12px' }}
                    >
                      {testingAi ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Test Key
                    </button>
                  </div>
                </div>
              )}

              {aiTestResult && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  fontSize: '12px',
                  background: aiTestResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${aiTestResult.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  color: aiTestResult.success ? '#4ade80' : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {aiTestResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {aiTestResult.message}
                </div>
              )}
            </div>

            {/* 2. Hosting Dashboard & Subdomain Settings */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--info)" /> Hosting Dashboard & Subdomain Provisioner
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Each lead will receive a custom demo website hosted on a personalized subdomain (e.g. <code>lead-name.demo.yourdomain.com</code>).
              </p>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label>Hosting Integration Provider</label>
                  <select 
                    className="form-control"
                    value={settings.hostingProvider || 'wildcard'}
                    onChange={e => setSettings({ ...settings, hostingProvider: e.target.value as any })}
                  >
                    <option value="wildcard">Wildcard Subdomain & Local Static (Fastest / Recommended)</option>
                    <option value="cpanel">cPanel / WHM API (Auto UAPI Subdomain & File Upload)</option>
                    <option value="cloudflare">Cloudflare DNS API (Automated CNAME records)</option>
                  </select>
                </div>
                <div>
                  <label>Base Domain for Demos</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={settings.baseDomain}
                    onChange={e => setSettings({ ...settings, baseDomain: e.target.value })}
                    placeholder="demo.modedigicreations.com"
                  />
                </div>
              </div>

              {settings.hostingProvider === 'cpanel' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', margin: 0, color: 'var(--text-main)' }}>cPanel API Connection</h4>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={handleTestCpanel}
                      disabled={testingCpanel || !settings.cpanelHost || !settings.cpanelUser || !settings.cpanelApiToken}
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {testingCpanel ? <RefreshCw size={12} className="spin" /> : <Play size={12} />} Test cPanel Connection
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px' }}>cPanel Host URL</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={settings.cpanelHost || ''}
                        onChange={e => setSettings({ ...settings, cpanelHost: e.target.value })}
                        placeholder="https://macedigital.co.uk:2083"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px' }}>cPanel Username</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={settings.cpanelUser || ''}
                        onChange={e => setSettings({ ...settings, cpanelUser: e.target.value })}
                        placeholder="mycpaneluser"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px' }}>cPanel API Token</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={settings.cpanelApiToken || ''}
                        onChange={e => setSettings({ ...settings, cpanelApiToken: e.target.value })}
                        placeholder="API Token or cPanel Password"
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
                    💡 <strong>Tips:</strong> 1) Host URL must be without a trailing slash (e.g. <code>https://macedigital.co.uk:2083</code>). 2) You can enter either your <strong>cPanel API Token</strong> or your <strong>cPanel account password</strong>.
                  </p>
                  {cpanelTestResult && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      fontSize: '12px',
                      background: cpanelTestResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${cpanelTestResult.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                      color: cpanelTestResult.success ? '#4ade80' : '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {cpanelTestResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      {cpanelTestResult.message}
                    </div>
                  )}
                </div>
              )}

              {settings.hostingProvider === 'cloudflare' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-main)' }}>Cloudflare DNS Connection</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px' }}>Cloudflare API Token (Edit Zone DNS)</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={settings.cloudflareApiToken || ''}
                        onChange={e => setSettings({ ...settings, cloudflareApiToken: e.target.value })}
                        placeholder="Cloudflare API Token"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px' }}>Cloudflare Zone ID</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={settings.cloudflareZoneId || ''}
                        onChange={e => setSettings({ ...settings, cloudflareZoneId: e.target.value })}
                        placeholder="32-character Zone ID from overview page"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>AI Website Prompt Customizer</label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  value={settings.websitePromptTemplate}
                  onChange={e => setSettings({ ...settings, websitePromptTemplate: e.target.value })}
                  placeholder="Instructions for Claude / DeepSeek on designing the demo websites..."
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  The AI builds a modern, single-page responsive website addressing each lead's specific SEO and design weaknesses.
                </p>
              </div>
            </div>

            {/* 3. Email Delivery Settings */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} color="var(--warning)" /> Email Delivery Provider
              </h3>
              <div className="form-group">
                <select 
                  className="form-control"
                  value={settings.emailProvider || 'gmail'}
                  onChange={e => setSettings({ ...settings, emailProvider: e.target.value as 'gmail' | 'resend' })}
                >
                  <option value="gmail">Gmail SMTP (Direct Delivery)</option>
                  <option value="resend">Resend API (HTTP Delivery — Bypasses Port Blocks)</option>
                </select>
              </div>

              {(settings.emailProvider === 'gmail' || !settings.emailProvider) ? (
                <>
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
                </>
              ) : (
                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label>Resend API Key</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={settings.resendApiKey}
                      onChange={e => setSettings({ ...settings, resendApiKey: e.target.value })}
                      placeholder="re_..."
                    />
                  </div>
                  <div>
                    <label>Resend From Email</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={settings.resendFromEmail}
                      onChange={e => setSettings({ ...settings, resendFromEmail: e.target.value })}
                      placeholder="onboarding@resend.dev"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Outreach Prompts & Signature */}
            <div className="form-group">
              <label>AI Cold Email Personalization Prompt</label>
              <textarea 
                className="form-control" 
                rows={4}
                value={settings.systemPrompt}
                onChange={e => setSettings({ ...settings, systemPrompt: e.target.value })}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tip: The AI automatically embeds the live demo subdomain link (<code>{"{{Demo Website}}"}</code>) directly into the email body.
              </p>
            </div>

            <div className="form-group">
              <label>Email Signature (Concludes all outreach emails)</label>
              <textarea 
                className="form-control" 
                rows={3}
                value={settings.emailSignature}
                onChange={e => setSettings({ ...settings, emailSignature: e.target.value })}
                placeholder="Best regards,&#10;&#10;John Smith&#10;Mode Webhost & Digital Creations"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '12px' }}>
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Save System Configurations'}
            </button>
          </form>
        </div>
      ) : (
        /* Leads Dashboard Tab */
        <div className="dashboard-grid">
          {/* Main Dashboard Section (Left Column) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
            {/* Stats Row */}
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Total Leads</p>
                <p className="stat-val">{stats.total}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Crawled</p>
                <p className="stat-val" style={{ color: 'var(--info)' }}>{stats.crawled}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Demo Sites Live</p>
                <p className="stat-val" style={{ color: '#c084fc' }}>{stats.sitesDeployed}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Drafts Ready</p>
                <p className="stat-val" style={{ color: 'var(--warning)' }}>{stats.drafted}</p>
              </div>
              <div className="stat-item">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Emails Sent</p>
                <p className="stat-val" style={{ color: 'var(--success)' }}>{stats.sent}</p>
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
                  <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={isScraping || isFullAutomating}
                    >
                      {isScraping ? <Loader2 className="animate-spin" size={16} /> : 'Scrape Leads Only'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ background: '#22c55e', borderColor: '#22c55e', color: '#000', fontWeight: 600 }}
                      disabled={isScraping || isFullAutomating}
                      onClick={handleFullAutomationSubmit}
                    >
                      {isFullAutomating ? <Loader2 className="animate-spin" size={16} /> : 'Launch Full Pipeline (Scrape -> Subdomain -> Site -> Send)'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Leads Listing Section */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <h2>Leads List</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {isFullAutomating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: 'rgba(34,197,94,0.1)', color: '#4ade80', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <Loader2 size={12} className="animate-spin" /> Background Pipeline Active...
                    </div>
                  )}
                  {isAutomating ? (
                    <button className="btn btn-danger" onClick={stopBulkAutomation}>
                      <XCircle size={14} /> Stop Crawl/Draft
                    </button>
                  ) : isBulkBuilding ? (
                    <button className="btn btn-danger" onClick={stopBulkSiteBuilding}>
                      <XCircle size={14} /> Stop Site Builds
                    </button>
                  ) : isBulkSending ? (
                    <button className="btn btn-danger" onClick={stopBulkSending}>
                      <XCircle size={14} /> Stop Sending
                    </button>
                  ) : (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        onClick={startBulkSiteBuilding}
                        disabled={leads.length === 0}
                        style={{ borderColor: '#c084fc', color: '#c084fc' }}
                        title="Generate and deploy subdomains & demo websites for all leads"
                      >
                        <Globe size={14} /> Bulk Build Websites
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={startBulkAutomation}
                        disabled={leads.length === 0}
                        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                      >
                        <Play size={14} /> Bulk Draft Emails
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
                    disabled={leads.length === 0 || isAutomating || isBulkSending || isBulkBuilding}
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
                    placeholder="Search by name, email, niche, subdomain..."
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
                  <option value="site_ready">Site Ready / Deployed</option>
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
                        <th>Subdomain & Demo</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => (
                        <tr 
                          key={lead.id} 
                          onClick={() => setSelectedLeadId(lead.id)}
                          style={{ cursor: 'pointer', background: selectedLeadId === lead.id ? 'rgba(139,92,246,0.08)' : '' }}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>{lead.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{lead.category || 'N/A'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              {lead.website ? (
                                <a href={`https://${lead.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Globe size={12} /> {lead.website}
                                </a>
                              ) : 'No Web'}
                            </div>
                            <div 
                              style={{ marginTop: '2px' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <input 
                                type="email"
                                style={{
                                  fontSize: '11px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderBottom: '1px dashed rgba(255,255,255,0.15)',
                                  color: lead.email ? 'var(--text-main)' : 'var(--danger)',
                                  padding: '1px 0px',
                                  width: '100%',
                                  maxWidth: '180px',
                                }}
                                value={lead.email || ''}
                                onChange={(e) => {
                                  const newEmail = e.target.value;
                                  setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, email: newEmail } : l));
                                }}
                                onBlur={async (e) => {
                                  try {
                                    await fetch(`${API_BASE}/leads/${lead.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ email: e.target.value })
                                    });
                                  } catch (err) {
                                    console.error('Failed to sync updated email', err);
                                  }
                                }}
                                placeholder="Add test email"
                              />
                            </div>
                          </td>
                          <td>
                            {lead.demoSiteUrl || lead.subdomain ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px', whiteSpace: 'nowrap' }}>
                                  {lead.subdomain || 'Allocated'}
                                </span>
                                {lead.siteStatus === 'deployed' && (
                                  <a 
                                    href={lead.demoSiteUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ color: '#c084fc' }}
                                    title="Open live website in new tab"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge badge-${lead.siteStatus === 'deployed' && lead.status === 'crawled' ? 'site_ready' : lead.status}`}>
                              {lead.siteStatus === 'deployed' ? 'Site Deployed' : lead.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {lead.website && (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  onClick={() => crawlLead(lead.id)}
                                  disabled={loadingLeadId === lead.id}
                                  title="Crawl business website"
                                >
                                  {loadingLeadId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                                </button>
                              )}
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 8px', fontSize: '12px', borderColor: '#c084fc', color: '#c084fc' }}
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  buildAndDeployLeadSite(lead.id);
                                }}
                                disabled={isBuildingSiteId === lead.id}
                                title="Build & Deploy AI Demo Website"
                              >
                                {isBuildingSiteId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <LayoutTemplate size={12} />}
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'var(--warning)', color: '#fde047' }}
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  draftLead(lead.id);
                                }}
                                disabled={loadingLeadId === lead.id}
                                title="Draft cold email with AI"
                              >
                                {loadingLeadId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 8px', fontSize: '12px' }}
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

          {/* AI Outreach & Website Preview Pane (Right Column) */}
          <div className="glass-card" style={{ height: 'fit-content', position: 'sticky', top: '24px', minWidth: 0 }}>
            {!selectedLead ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <LayoutTemplate size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <h3>No Lead Selected</h3>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>Select a lead from the dashboard to preview, build their custom demo site, or dispatch cold outreach.</p>
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
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => setSelectedLeadId(null)}
                  >
                    Close
                  </button>
                </div>

                {/* Lead Summary Info */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                    <div><strong>SEO Score:</strong> {selectedLead.seoScore ? `${selectedLead.seoScore}/100` : 'N/A'}</div>
                    <div><strong>GMB Rating:</strong> {selectedLead.gmbRating ? `${selectedLead.gmbRating}/5` : 'N/A'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong>Email:</strong>
                    <input 
                      type="email" 
                      className="form-control" 
                      style={{ 
                        flex: 1,
                        padding: '2px 8px', 
                        fontSize: '12px', 
                        height: '24px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-main)'
                      }}
                      value={selectedLead.email || ''} 
                      onChange={(e) => {
                        const newEmail = e.target.value;
                        setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, email: newEmail } : l));
                      }}
                      onBlur={async (e) => {
                        try {
                          await fetch(`${API_BASE}/leads/${selectedLead.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: e.target.value })
                          });
                        } catch (err) {
                          console.error('Failed to sync updated email', err);
                        }
                      }}
                      placeholder="Enter target email"
                    />
                  </div>
                  {selectedLead.demoSiteUrl && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <strong>Subdomain:</strong>{' '}
                        <a href={selectedLead.demoSiteUrl} target="_blank" rel="noreferrer" style={{ color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                          {selectedLead.subdomain} <ExternalLink size={12} />
                        </a>
                      </div>
                      {selectedLead.demoSiteHtml && (
                        <div>
                          <a 
                            href={`${API_BASE.replace(/\/api$/, '')}/demo/${selectedLead.id}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ color: 'var(--info)', fontSize: '11px', textDecoration: 'none', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Direct link works immediately even if DNS is still propagating"
                          >
                            Direct Server Link <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Drawer Tab Switcher: Demo Website vs Cold Email */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <button 
                    onClick={() => setLeadDrawerTab('website')}
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      background: 'transparent', 
                      border: 'none', 
                      borderBottom: leadDrawerTab === 'website' ? '2px solid #c084fc' : '2px solid transparent',
                      color: leadDrawerTab === 'website' ? '#c084fc' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Globe size={14} /> Live Demo Website
                  </button>
                  <button 
                    onClick={() => setLeadDrawerTab('email')}
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      background: 'transparent', 
                      border: 'none', 
                      borderBottom: leadDrawerTab === 'email' ? '2px solid var(--primary)' : '2px solid transparent',
                      color: leadDrawerTab === 'email' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Mail size={14} /> Cold Outreach Email
                  </button>
                </div>

                {/* TAB 1: Live Demo Website */}
                {leadDrawerTab === 'website' && (
                  <div>
                    {/* Viewport & Subdomain Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary"
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '11px',
                            background: deviceViewport === 'desktop' ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                            borderColor: deviceViewport === 'desktop' ? '#c084fc' : 'var(--border-color)',
                            color: deviceViewport === 'desktop' ? '#c084fc' : 'var(--text-muted)'
                          }}
                          onClick={() => setDeviceViewport('desktop')}
                        >
                          <Monitor size={12} /> Desktop
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '11px',
                            background: deviceViewport === 'mobile' ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                            borderColor: deviceViewport === 'mobile' ? '#c084fc' : 'var(--border-color)',
                            color: deviceViewport === 'mobile' ? '#c084fc' : 'var(--text-muted)'
                          }}
                          onClick={() => setDeviceViewport('mobile')}
                        >
                          <Smartphone size={12} /> Mobile
                        </button>
                      </div>

                      {selectedLead.demoSiteUrl && (
                        <a 
                          href={selectedLead.demoSiteUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', color: '#c084fc', borderColor: '#c084fc' }}
                        >
                          <ExternalLink size={12} /> Open Subdomain
                        </a>
                      )}
                    </div>

                    {/* Iframe Preview Container */}
                    <div style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)', 
                      overflow: 'hidden',
                      marginBottom: '14px',
                      display: 'flex',
                      justifyContent: 'center'
                    }}>
                      {selectedLead.demoSiteHtml ? (
                        <iframe 
                          key={selectedLead.id + '-' + (selectedLead.siteStatus || '') + '-' + (selectedLead.demoSiteHtml?.length || 0)}
                          src={`${API_BASE}/leads/${selectedLead.id}/site-preview?t=${encodeURIComponent(selectedLead.subdomain || '')}`}
                          title={`Preview for ${selectedLead.name}`}
                          style={{ 
                            width: deviceViewport === 'mobile' ? '375px' : '100%', 
                            height: '480px', 
                            border: 'none',
                            background: '#020617',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      ) : (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <LayoutTemplate size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                          <p style={{ fontSize: '13px' }}>No demo website built yet for this lead.</p>
                          <p style={{ fontSize: '11px', marginTop: '4px' }}>Click below to create the subdomain and build a bespoke AI landing page.</p>
                        </div>
                      )}
                    </div>

                    {/* Build & Deploy Action Buttons */}
                    <button 
                      className="btn btn-primary"
                      onClick={() => buildAndDeployLeadSite(selectedLead.id)}
                      disabled={isBuildingSiteId === selectedLead.id}
                      style={{ width: '100%', background: '#c084fc', borderColor: '#c084fc', color: '#000', fontWeight: 600 }}
                    >
                      {isBuildingSiteId === selectedLead.id ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> Creating Subdomain & Building AI Website...
                        </>
                      ) : (
                        <>
                          <Globe size={16} /> {selectedLead.demoSiteHtml ? 'Regenerate & Redeploy Demo Site' : 'Build & Deploy Demo Website'}
                        </>
                      )}
                    </button>

                    {selectedLead.demoSiteHtml && (
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          if (!selectedLead.emailDraft) {
                            draftLead(selectedLead.id);
                          }
                          setLeadDrawerTab('email');
                        }}
                        style={{ width: '100%', marginTop: '8px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                      >
                        Next: Review Cold Outreach Email Draft →
                      </button>
                    )}
                  </div>
                )}

                {/* TAB 2: Cold Outreach Email */}
                {leadDrawerTab === 'email' && (
                  <div>
                    {/* Email Subject Selector */}
                    <div className="form-group">
                      <label>Email Subject</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={emailSubject}
                        onChange={e => setEmailSubject(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span 
                          onClick={() => setEmailSubject(prev => prev + ' {{Business Name}}')}
                          style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                        >
                          + {"{{Business Name}}"}
                        </span>
                        <span 
                          onClick={() => setEmailSubject(prev => prev + ' {{Demo Website}}')}
                          style={{ fontSize: '10px', background: 'rgba(192,132,252,0.1)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(192,132,252,0.3)' }}
                        >
                          + {"{{Demo Website}}"}
                        </span>
                      </div>
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
                                <Loader2 className="animate-spin" size={16} /> Composing personalized cold email...
                              </>
                            ) : (
                              <>
                                <Sparkles size={16} /> Compose Email with AI (Includes Demo Link)
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <textarea 
                            className="form-control" 
                            rows={10} 
                            style={{ fontSize: '13px', lineHeight: '1.4', fontFamily: 'monospace' }}
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
                              Email address is missing. Add test email above to send.
                            </p>
                          )}
                        </div>
                      )}

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
            )}
          </div>
        </div>
      )}
    </>
  );
}
