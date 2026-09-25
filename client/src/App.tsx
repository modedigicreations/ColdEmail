import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, Send, Settings as SettingsIcon, Users, Sparkles, Mail, 
  CheckCircle, Loader2, Globe, Trash2, Cpu, Edit,
  Play, RefreshCw, XCircle, Search, AlertCircle,
  Monitor, Smartphone, ExternalLink, LayoutTemplate, Server,
  Save, Download, MessageSquare, Phone, Copy, PlusCircle, Check,
  Target, FolderKanban, ReceiptText, BriefcaseBusiness, PackageCheck, UserPlus
} from 'lucide-react';
import { sanitizePhoneNumberForWhatsApp, getWhatsAppOutreachUrl, generateFallbackWhatsAppPitch } from './whatsapp.js';
import type { CRMRecord, AgencyService } from './crm/crmTypes';
import { PipelineView } from './crm/PipelineView';
import { ClientsView } from './crm/ClientsView';
import { ProjectsView } from './crm/ProjectsView';
import { BillingView } from './crm/BillingView';
import { ServicesView } from './crm/ServicesView';
import { JourneyView } from './crm/JourneyView';

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

interface Settings {
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
  // Navigation & Tabs (adeolaOS + ColdReach Agency Suite)
  const [activeTab, setActiveTab] = useState<'outbound' | 'leads' | 'pipeline' | 'clients' | 'projects' | 'billing' | 'journey' | 'services' | 'settings'>('outbound');
  const [activeSubTab, setActiveSubTab] = useState<'web_scrape' | 'leadsgorilla' | 'import' | 'manual'>('web_scrape');

  // Leads & Data States
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const cached = localStorage.getItem('coldreach_leads');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [settings, setSettings] = useState<Settings>({
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
    systemPrompt: '',
    emailSignature: '',
    whatsappPromptTemplate: '',
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
  const [leadDrawerTab, setLeadDrawerTab] = useState<'website' | 'email' | 'whatsapp'>('website');
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Scraping Parameters
  const [scrapeParams, setScrapeParams] = useState(() => {
    try {
      const cached = localStorage.getItem('coldreach_scrape_params');
      return cached ? JSON.parse(cached) : {
        keyword: 'Dental Clinics',
        location: 'Lagos, Nigeria',
        limit: 10,
        email: '',
        pass: ''
      };
    } catch {
      return {
        keyword: 'Dental Clinics',
        location: 'Lagos, Nigeria',
        limit: 10,
        email: '',
        pass: ''
      };
    }
  });

  // Manual Lead Form State
  const [manualLead, setManualLead] = useState({
    name: '',
    category: '',
    website: '',
    phone: '',
    whatsapp: '',
    email: ''
  });

  // WhatsApp Pitch Edit & Loading States
  const [editedWhatsappPitch, setEditedWhatsappPitch] = useState('');
  const [isDraftingWhatsapp, setIsDraftingWhatsapp] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // adeolaOS Agency CRM States
  const [crmRecords, setCrmRecords] = useState<CRMRecord[]>([]);
  const [crmServices, setCrmServices] = useState<AgencyService[]>([]);
  const [crmSummary, setCrmSummary] = useState<any>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('coldreach_scrape_params', JSON.stringify(scrapeParams));
    } catch {}
  }, [scrapeParams]);

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
    fetchCRMData();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      setEditedBody(selectedLead.emailDraft || '');
      setEditedWhatsappPitch(selectedLead.whatsappDraft || '');
    } else {
      setEditedBody('');
      setEditedWhatsappPitch('');
    }
  }, [selectedLeadId, leads]);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Save leads to localStorage whenever they change
  useEffect(() => {
    if (leads && leads.length > 0) {
      try {
        localStorage.setItem('coldreach_leads', JSON.stringify(leads));
      } catch {}
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

  // adeolaOS CRM & Agency Operations Handlers
  const fetchCRMData = async () => {
    try {
      const [recRes, servRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}/crm`),
        fetch(`${API_BASE}/crm/services`),
        fetch(`${API_BASE}/crm/summary`)
      ]);
      if (recRes.ok) {
        const records = await recRes.json();
        setCrmRecords(records);
      }
      if (servRes.ok) {
        const services = await servRes.json();
        setCrmServices(services);
      }
      if (sumRes.ok) {
        const summary = await sumRes.json();
        setCrmSummary(summary);
      }
    } catch (err) {
      console.error('Failed to fetch CRM data:', err);
    }
  };

  const handleCreateCRMRecord = async (data: Partial<CRMRecord>) => {
    try {
      const res = await fetch(`${API_BASE}/crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const created = await res.json();
        setCrmRecords(prev => [created, ...prev]);
        showMsg(`Created ${data.type || 'record'} successfully!`);
        fetchCRMData();
      } else {
        showMsg('Failed to create CRM record', 'error');
      }
    } catch (err) {
      showMsg('Failed to create CRM record', 'error');
    }
  };

  const handleUpdateCRMRecord = async (id: string, updates: Partial<CRMRecord>) => {
    try {
      const res = await fetch(`${API_BASE}/crm/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setCrmRecords(prev => prev.map(r => r.id === id ? updated : r));
        fetchCRMData();
      } else {
        showMsg('Failed to update CRM record', 'error');
      }
    } catch (err) {
      showMsg('Failed to update CRM record', 'error');
    }
  };

  const handleDeleteCRMRecord = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/crm/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCrmRecords(prev => prev.filter(r => r.id !== id));
        showMsg('Record deleted from CRM');
        fetchCRMData();
      } else {
        showMsg('Failed to delete CRM record', 'error');
      }
    } catch (err) {
      showMsg('Failed to delete CRM record', 'error');
    }
  };

  const handleConvertLeadToCRM = async (leadId: string) => {
    setConvertingLeadId(leadId);
    try {
      const res = await fetch(`${API_BASE}/crm/convert-lead/${leadId}`, {
        method: 'POST'
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showMsg(`Lead converted to Client "${result.client?.name}" & added to Pipeline!`);
        await fetchCRMData();
        setActiveTab('pipeline');
      } else {
        showMsg(result.error || 'Failed to convert lead to CRM', 'error');
      }
    } catch (err: any) {
      showMsg(`Conversion error: ${err.message}`, 'error');
    } finally {
      setConvertingLeadId(null);
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
                     settings.aiProvider === 'openai' ? settings.openaiApiKey :
                     settings.aiProvider === 'deepseek' ? settings.deepseekApiKey :
                     settings.anthropicApiKey;
      const model = settings.aiProvider === 'openai' ? settings.openaiModel : settings.geminiModel;
      const res = await fetch(`${API_BASE}/settings/test-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.aiProvider,
          apiKey,
          model
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiTestResult({ success: true, message: data.message });
        if (data.verifiedModel) {
          if (settings.aiProvider === 'openai') {
            setSettings(prev => ({ ...prev, openaiModel: data.verifiedModel }));
          } else if (settings.aiProvider === 'gemini') {
            setSettings(prev => ({ ...prev, geminiModel: data.verifiedModel }));
          }
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

  // Scraping Handler (Universal Web & AI Discovery or Optional Leads Gorilla)
  const handleScrapeSubmit = async (e: React.FormEvent, engine: 'web' | 'leadsgorilla' = 'web') => {
    e.preventDefault();
    if (!scrapeParams.keyword || !scrapeParams.location) {
      showMsg('Keyword and Location are required.', 'error');
      return;
    }
    if (engine === 'leadsgorilla' && (!scrapeParams.email || !scrapeParams.pass)) {
      showMsg('Leads Gorilla Email and Password are required when using Leads Gorilla.', 'error');
      return;
    }

    setIsScraping(true);
    showMsg(engine === 'leadsgorilla' ? 'Starting Leads Gorilla browser search...' : 'Starting Web & AI lead discovery...', 'success');
    try {
      const res = await fetch(`${API_BASE}/leads/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          keyword: scrapeParams.keyword,
          location: scrapeParams.location,
          limit: scrapeParams.limit || 10,
          email: scrapeParams.email,
          pass: scrapeParams.pass
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Discovery complete! Added ${data.count} new leads.`);
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

  // Launch Fully Automated Outreach Campaign (Scrape -> Subdomain -> Site -> Drafts -> Send)
  const handleFullAutomationSubmit = async (e: React.MouseEvent, engine: 'web' | 'leadsgorilla' = 'web') => {
    e.preventDefault();
    if (!scrapeParams.keyword || !scrapeParams.location) {
      showMsg('Keyword and Location are required.', 'error');
      return;
    }
    if (engine === 'leadsgorilla' && (!scrapeParams.email || !scrapeParams.pass)) {
      showMsg('Keyword, Location, and Leads Gorilla credentials are required.', 'error');
      return;
    }

    setIsFullAutomating(true);
    showMsg(`Launching full pipeline (${engine === 'leadsgorilla' ? 'Leads Gorilla' : 'Web & AI Discovery'} -> Subdomain -> AI Site -> Drafts)...`, 'success');
    try {
      const res = await fetch(`${API_BASE}/leads/automate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          keyword: scrapeParams.keyword,
          location: scrapeParams.location,
          limit: scrapeParams.limit || 10,
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

  // Add Lead Manually
  const handleManualLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLead.name.trim()) {
      showMsg('Business / Lead Name is required.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leads/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualLead)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Lead "${manualLead.name}" added successfully!`, 'success');
        setManualLead({ name: '', category: '', website: '', phone: '', whatsapp: '', email: '' });
        fetchLeads();
      } else {
        showMsg(data.error || 'Failed to add lead', 'error');
      }
    } catch (err) {
      showMsg('Network error adding lead', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate AI WhatsApp Pitch for a Lead
  const draftLeadWhatsapp = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    setIsDraftingWhatsapp(true);
    setLoadingLeadId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}/draft-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead, settings })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to draft WhatsApp pitch');
      }
      const updatedLead = await res.json();
      setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
      if (selectedLeadId === id) {
        setEditedWhatsappPitch(updatedLead.whatsappDraft || '');
      }
      showMsg('WhatsApp outreach pitch generated with AI!');
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setIsDraftingWhatsapp(false);
      setLoadingLeadId(null);
    }
  };

  // Save edited WhatsApp Pitch
  const saveEditedWhatsappDraft = async (id: string) => {
    setLoadingLeadId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappDraft: editedWhatsappPitch })
      });
      if (res.ok) {
        showMsg('WhatsApp pitch saved');
        fetchLeads();
      }
    } catch (e) {
      showMsg('Failed to update WhatsApp draft', 'error');
    } finally {
      setLoadingLeadId(null);
    }
  };

  // Lead Actions
  const crawlLead = async (id: string) => {
    setLoadingLeadId(id);
    try {
      const leadData = leads.find(l => l.id === id);
      const res = await fetch(`${API_BASE}/leads/${id}/crawl`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: leadData, settings })
      });
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
      const leadData = leads.find(l => l.id === id);
      const res = await fetch(`${API_BASE}/leads/${id}/build-and-deploy`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: leadData, settings })
      });
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
      const leadData = leads.find(l => l.id === id);
      const res = await fetch(`${API_BASE}/leads/${id}/draft`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: leadData, settings })
      });
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
        body: JSON.stringify({ subject: resolvedSubject, lead, settings })
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

  const handleSaveLeadsManually = async () => {
    if (leads.length === 0) return;
    try {
      localStorage.setItem('coldreach_leads', JSON.stringify(leads));
      await fetch(`${API_BASE}/leads/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      });
      showMsg(`Successfully saved ${leads.length} leads to storage & synced with backend!`, 'success');
    } catch {
      showMsg(`Saved ${leads.length} leads to browser storage!`, 'success');
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = ['Business Name', 'Category', 'Website', 'Email', 'Phone', 'WhatsApp', 'SEO Score', 'GMB Rating', 'Subdomain', 'Demo Site URL', 'Site Status', 'Outreach Status'];
    const rows = leads.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${(l.website || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.whatsapp || '').replace(/"/g, '""')}"`,
      `"${l.seoScore || ''}"`,
      `"${l.gmbRating || ''}"`,
      `"${(l.subdomain || '').replace(/"/g, '""')}"`,
      `"${(l.demoSiteUrl || '').replace(/"/g, '""')}"`,
      `"${(l.siteStatus || '').replace(/"/g, '""')}"`,
      `"${(l.status || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `coldreach-leads-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearAllLeads = async () => {
    if (!confirm('This will delete all leads in the database. Continue?')) return;
    try {
      const res = await fetch(`${API_BASE}/leads`, { method: 'DELETE' });
      if (res.ok) {
        localStorage.removeItem('coldreach_leads');
        setLeads([]);
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
        let currentLeadState = lead;
        if (lead.website) {
          setLoadingLeadId(lead.id);
          const crawlRes = await fetch(`${API_BASE}/leads/${lead.id}/crawl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead: currentLeadState, settings })
          });
          if (crawlRes.ok) {
            const updatedLead = await crawlRes.json();
            currentLeadState = updatedLead;
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
          }
        }
        
        if (!isAutomatingRef.current) break;

        // Draft AI Email
        setLoadingLeadId(lead.id);
        const draftRes = await fetch(`${API_BASE}/leads/${lead.id}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead: currentLeadState, settings })
        });
        if (draftRes.ok) {
          const updatedLead = await draftRes.json();
          currentLeadState = updatedLead;
          setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }

        // Draft AI WhatsApp Pitch
        try {
          const waRes = await fetch(`${API_BASE}/leads/${lead.id}/draft-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead: currentLeadState, settings })
          });
          if (waRes.ok) {
            const updatedLead = await waRes.json();
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
          }
        } catch (_) {}
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
        const buildRes = await fetch(`${API_BASE}/leads/${lead.id}/build-and-deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead, settings })
        });
        if (buildRes.ok) {
          const updated = await buildRes.json();
          setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
        }
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
          body: JSON.stringify({ subject: resolvedSubject, lead, settings })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Send failed');
        }

        const resData = await res.json();
        if (resData.lead) {
          setLeads(prev => prev.map(l => l.id === resData.lead.id ? resData.lead : l));
        }
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
      {/* Navbar Header (adeolaOS + ColdReach Agency Suite) */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)' }}>
            <BriefcaseBusiness size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="text-gradient" style={{ fontSize: '24px', margin: 0, fontWeight: 800 }}>Adeola & Mode OS</h1>
              <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600 }}>Agency Suite</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px', margin: 0 }}>
              Lead Discovery • AI Sites • Cold Outreach • CRM Pipeline • Invoicing • Client Delivery
              {crmSummary && (
                <span style={{ marginLeft: '8px', color: '#c084fc', fontSize: '12px', fontWeight: 600 }}>
                  (Pipeline: £{((crmSummary.pipelineValuePence || 0) / 100).toLocaleString()} • {crmSummary.totalClients || 0} Clients)
                </span>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button 
            className={`btn ${activeTab === 'outbound' || activeTab === 'leads' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: (activeTab === 'outbound' || activeTab === 'leads') ? undefined : 'none' }}
            onClick={() => setActiveTab('outbound')}
          >
            <Users size={14} /> Outbound Leads
          </button>
          <button 
            className={`btn ${activeTab === 'pipeline' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'pipeline' ? undefined : 'none' }}
            onClick={() => setActiveTab('pipeline')}
          >
            <Target size={14} /> Pipeline
          </button>
          <button 
            className={`btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'clients' ? undefined : 'none' }}
            onClick={() => setActiveTab('clients')}
          >
            <BriefcaseBusiness size={14} /> Clients
          </button>
          <button 
            className={`btn ${activeTab === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'projects' ? undefined : 'none' }}
            onClick={() => setActiveTab('projects')}
          >
            <FolderKanban size={14} /> Delivery Desk
          </button>
          <button 
            className={`btn ${activeTab === 'billing' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'billing' ? undefined : 'none' }}
            onClick={() => setActiveTab('billing')}
          >
            <ReceiptText size={14} /> Invoices & Proposals
          </button>
          <button 
            className={`btn ${activeTab === 'journey' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'journey' ? undefined : 'none' }}
            onClick={() => setActiveTab('journey')}
          >
            <PackageCheck size={14} /> Client Journey
          </button>
          <button 
            className={`btn ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'services' ? undefined : 'none' }}
            onClick={() => setActiveTab('services')}
          >
            <Sparkles size={14} /> Services
          </button>
          <button 
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 11px', fontSize: '12px', border: activeTab === 'settings' ? undefined : 'none' }}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={14} /> Settings
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
                      checked={settings.aiProvider === 'openai'}
                      onChange={() => setSettings({ ...settings, aiProvider: 'openai' })}
                    />
                    ChatGPT (OpenAI GPT-4o / Mini)
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
                      value={settings.geminiModel || 'gemini-3.8-flash'}
                      onChange={e => setSettings({ ...settings, geminiModel: e.target.value })}
                    >
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recommended / Latest)</option>
                      <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
                    </select>
                  </div>
                </div>
              )}

              {settings.aiProvider === 'openai' && (
                <div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>ChatGPT / OpenAI API Key</label>
                      <a 
                        href="https://platform.openai.com/api-keys" 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '12px', color: 'var(--info)', textDecoration: 'none' }}
                      >
                        Get API key at OpenAI Platform &rarr;
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={settings.openaiApiKey || ''}
                        onChange={e => setSettings({ ...settings, openaiApiKey: e.target.value })}
                        placeholder="sk-..."
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={handleTestAi}
                        disabled={testingAi || !settings.openaiApiKey}
                        style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 12px' }}
                      >
                        {testingAi ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} Test Key
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: '340px' }}>
                    <label>ChatGPT Model</label>
                    <select 
                      className="form-control"
                      value={settings.openaiModel || 'gpt-4o-mini'}
                      onChange={e => setSettings({ ...settings, openaiModel: e.target.value })}
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-Effective - Recommended)</option>
                      <option value="gpt-4o">GPT-4o (Flagship Omnimodal / Elite Copy)</option>
                      <option value="chatgpt-4o-latest">ChatGPT-4o Latest</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy Fast)</option>
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
                  <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <div style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px' }}>
                      🔑 How to generate a valid cPanel API Token:
                    </div>
                    <ol style={{ margin: '0 0 8px 16px', padding: 0 }}>
                      <li>Log in to cPanel at <code>https://macedigital.co.uk:2083</code> with user <code>adeolame</code>.</li>
                      <li>Go to <strong>Security &rarr; Manage API Tokens</strong> (or search "API Tokens" in cPanel).</li>
                      <li>Click <strong>+ Create API Token</strong>, name it <code>ColdReach</code>, and check <strong>Full Access</strong> (or select Subdomains & Fileman).</li>
                      <li>Click <strong>Create</strong>, copy the generated token, and paste it into the field above.</li>
                    </ol>
                    <div style={{ color: 'var(--info)' }}>
                      💡 <em>Note: If you don't want to use cPanel API, simply switch <strong>Hosting Integration Provider</strong> to <strong>"Wildcard Subdomain & Local Static"</strong> above. It works instantly without needing any tokens!</em>
                    </div>
                  </div>
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
                  placeholder="Instructions for ChatGPT / Gemini / Claude / DeepSeek on designing the demo websites..."
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
              <label>AI WhatsApp Outreach Pitch Prompt</label>
              <textarea 
                className="form-control" 
                rows={3}
                value={settings.whatsappPromptTemplate || ''}
                onChange={e => setSettings({ ...settings, whatsappPromptTemplate: e.target.value })}
                placeholder="Write a concise, conversational, high-converting WhatsApp pitch (under 60 words)..."
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tip: Keep WhatsApp pitches punchy and conversational. Supports <code>{"{{Business Name}}"}</code> and <code>{"{{Demo Website}}"}</code>.
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
      ) : activeTab === 'pipeline' ? (
        <PipelineView 
          records={crmRecords} 
          onUpdateRecord={handleUpdateCRMRecord} 
          onCreateRecord={handleCreateCRMRecord} 
          onDeleteRecord={handleDeleteCRMRecord}
        />
      ) : activeTab === 'clients' ? (
        <ClientsView 
          records={crmRecords} 
          onCreateRecord={handleCreateCRMRecord} 
          onUpdateRecord={handleUpdateCRMRecord}
          onDeleteRecord={handleDeleteCRMRecord}
        />
      ) : activeTab === 'projects' ? (
        <ProjectsView 
          records={crmRecords} 
          onCreateRecord={handleCreateCRMRecord} 
          onUpdateRecord={handleUpdateCRMRecord}
          onDeleteRecord={handleDeleteCRMRecord}
        />
      ) : activeTab === 'billing' ? (
        <BillingView 
          records={crmRecords} 
          services={crmServices}
          onCreateRecord={handleCreateCRMRecord} 
          onUpdateRecord={handleUpdateCRMRecord}
          onDeleteRecord={handleDeleteCRMRecord}
        />
      ) : activeTab === 'journey' ? (
        <JourneyView 
          records={crmRecords} 
          onUpdateRecord={handleUpdateCRMRecord}
          onCreateRecord={handleCreateCRMRecord}
        />
      ) : activeTab === 'services' ? (
        <ServicesView 
          services={crmServices}
          onSelectService={(service: AgencyService) => {
            setActiveTab('billing');
            showMsg(`Selected "${service.name}" — create a proposal in Invoices & Proposals.`);
          }}
        />
      ) : (
        /* Outbound Leads & Discovery Dashboard Tab */
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
              <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
                <button 
                  type="button"
                  className={`tab-btn ${activeSubTab === 'web_scrape' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('web_scrape')}
                >
                  <Globe size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Instant Web & AI Discovery (Free)
                </button>
                <button 
                  type="button"
                  className={`tab-btn ${activeSubTab === 'leadsgorilla' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('leadsgorilla')}
                >
                  <Cpu size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Leads Gorilla (Optional)
                </button>
                <button 
                  type="button"
                  className={`tab-btn ${activeSubTab === 'import' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('import')}
                >
                  <UploadCloud size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CSV Import
                </button>
                <button 
                  type="button"
                  className={`tab-btn ${activeSubTab === 'manual' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('manual')}
                >
                  <PlusCircle size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Add Lead Manually
                </button>
              </div>

              {activeSubTab === 'web_scrape' && (
                <form onSubmit={(e) => handleScrapeSubmit(e, 'web')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Target Niche / Keyword</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Dentists, Real Estate, Law Firms"
                      value={scrapeParams.keyword}
                      onChange={e => setScrapeParams({ ...scrapeParams, keyword: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Location / City</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Lagos, London, Austin TX"
                      value={scrapeParams.location}
                      onChange={e => setScrapeParams({ ...scrapeParams, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Max Leads</label>
                    <select
                      className="form-control"
                      value={scrapeParams.limit || 10}
                      onChange={e => setScrapeParams({ ...scrapeParams, limit: Number(e.target.value) })}
                    >
                      <option value={5}>5 leads</option>
                      <option value={10}>10 leads</option>
                      <option value={15}>15 leads</option>
                      <option value={20}>20 leads</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 3', display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '12px', marginTop: '6px' }}>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={isScraping || isFullAutomating}
                    >
                      {isScraping ? <Loader2 className="animate-spin" size={16} /> : <><Sparkles size={14} style={{ marginRight: '4px' }} /> Discover Leads Only</>}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ background: '#22c55e', borderColor: '#22c55e', color: '#000', fontWeight: 600 }}
                      disabled={isScraping || isFullAutomating}
                      onClick={(e) => handleFullAutomationSubmit(e, 'web')}
                    >
                      {isFullAutomating ? <Loader2 className="animate-spin" size={16} /> : 'Launch Full Pipeline (Discover → Site → Email & WhatsApp)'}
                    </button>
                  </div>
                </form>
              )}

              {activeSubTab === 'leadsgorilla' && (
                <form onSubmit={(e) => handleScrapeSubmit(e, 'leadsgorilla')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Keyword</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Plumbers"
                      value={scrapeParams.keyword}
                      onChange={e => setScrapeParams({ ...scrapeParams, keyword: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Location</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. New York, NY"
                      value={scrapeParams.location}
                      onChange={e => setScrapeParams({ ...scrapeParams, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Leads Gorilla Email</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={scrapeParams.email}
                      onChange={e => setScrapeParams({ ...scrapeParams, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={scrapeParams.pass}
                      onChange={e => setScrapeParams({ ...scrapeParams, pass: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '12px', marginTop: '6px' }}>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={isScraping || isFullAutomating}
                    >
                      {isScraping ? <Loader2 className="animate-spin" size={16} /> : 'Scrape with Leads Gorilla'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ background: '#22c55e', borderColor: '#22c55e', color: '#000', fontWeight: 600 }}
                      disabled={isScraping || isFullAutomating}
                      onClick={(e) => handleFullAutomationSubmit(e, 'leadsgorilla')}
                    >
                      {isFullAutomating ? <Loader2 className="animate-spin" size={16} /> : 'Launch Full Pipeline with Leads Gorilla'}
                    </button>
                  </div>
                </form>
              )}

              {activeSubTab === 'import' && (
                <div>
                  <div className="upload-zone" onClick={() => document.getElementById('csv-input')?.click()}>
                    <UploadCloud size={32} color="var(--primary)" style={{ margin: '0 auto 10px' }} />
                    <p style={{ fontWeight: 500, fontSize: '14px' }}>Click to select or drag & drop CSV file (Leads Gorilla or Universal)</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Supported columns: Name, Email, Website, Phone / WhatsApp, Category, SEO Score</p>
                    <input 
                      type="file" 
                      id="csv-input" 
                      accept=".csv" 
                      style={{ display: 'none' }}
                      onChange={handleCSVUpload}
                    />
                  </div>
                </div>
              )}

              {activeSubTab === 'manual' && (
                <form onSubmit={handleManualLeadSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Business / Lead Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Apex Dental Studio"
                      value={manualLead.name}
                      onChange={e => setManualLead({ ...manualLead, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Category / Niche</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Healthcare & Dentistry"
                      value={manualLead.category}
                      onChange={e => setManualLead({ ...manualLead, category: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Website URL</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. apexdental.com"
                      value={manualLead.website}
                      onChange={e => setManualLead({ ...manualLead, website: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="e.g. contact@apexdental.com"
                      value={manualLead.email}
                      onChange={e => setManualLead({ ...manualLead, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Phone Number (WhatsApp Target)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. +234 801 234 5678 or 08012345678"
                      value={manualLead.phone}
                      onChange={e => setManualLead({ ...manualLead, phone: e.target.value, whatsapp: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Custom WhatsApp / Mobile (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Overrides phone if different"
                      value={manualLead.whatsapp}
                      onChange={e => setManualLead({ ...manualLead, whatsapp: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', marginTop: '6px' }}>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={isLoading || !manualLead.name.trim()}
                      style={{ width: '100%' }}
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><PlusCircle size={15} style={{ marginRight: '6px' }} /> Add Lead to Campaign Dashboard</>}
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
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleSaveLeadsManually}
                        disabled={leads.length === 0}
                        style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                        title="Save leads to browser storage and sync with backend"
                      >
                        <Save size={14} /> Save Leads
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleExportCSV}
                        disabled={leads.length === 0}
                        title="Download leads as CSV"
                      >
                        <Download size={14} /> Export CSV
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
                        <th>Contact & Channels</th>
                        <th>Subdomain & Demo</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => {
                        const waNumber = lead.whatsapp || lead.phone;
                        const waUrl = getWhatsAppOutreachUrl(
                          waNumber,
                          lead.whatsappDraft || generateFallbackWhatsAppPitch(lead.name, lead.demoSiteUrl)
                        );
                        return (
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
                            <div style={{ marginTop: '3px' }} onClick={e => e.stopPropagation()}>
                              {waUrl ? (
                                <a 
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    fontSize: '11px',
                                    color: '#4ade80',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(34, 197, 94, 0.25)'
                                  }}
                                  title="1-Click WhatsApp Outreach"
                                >
                                  <MessageSquare size={11} color="#22c55e" /> {waNumber}
                                </a>
                              ) : (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No WhatsApp</span>
                              )}
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
                                style={{ padding: '6px 8px', fontSize: '12px', borderColor: '#22c55e', color: '#22c55e' }}
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  setLeadDrawerTab('whatsapp');
                                }}
                                title="WhatsApp Outreach Pitch"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 8px', fontSize: '12px', borderColor: '#a855f7', color: '#c084fc' }}
                                onClick={() => handleConvertLeadToCRM(lead.id)}
                                disabled={convertingLeadId === lead.id}
                                title="Push Lead to CRM Pipeline (Client & Deal)"
                              >
                                {convertingLeadId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
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
                        );
                      })}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong>WhatsApp:</strong>
                    <input 
                      type="text" 
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
                      value={selectedLead.whatsapp || selectedLead.phone || ''} 
                      onChange={(e) => {
                        const newPhone = e.target.value;
                        setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, whatsapp: newPhone, phone: newPhone } : l));
                      }}
                      onBlur={async (e) => {
                        try {
                          await fetch(`${API_BASE}/leads/${selectedLead.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ whatsapp: e.target.value, phone: e.target.value })
                          });
                        } catch (err) {
                          console.error('Failed to sync updated phone/whatsapp', err);
                        }
                      }}
                      placeholder="e.g. +234 801 234 5678"
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

                {/* 1-Click Convert & Push to CRM Pipeline Button */}
                <button
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    marginBottom: '16px',
                    borderColor: '#a855f7',
                    background: 'rgba(168, 85, 247, 0.1)',
                    color: '#c084fc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    padding: '8px 14px',
                    fontWeight: 600
                  }}
                  onClick={() => handleConvertLeadToCRM(selectedLead.id)}
                  disabled={convertingLeadId === selectedLead.id}
                  title="Promote this lead to CRM Client & create Deal in Pipeline"
                >
                  {convertingLeadId === selectedLead.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Push Lead to CRM Pipeline
                </button>

                {/* Right Drawer Tab Switcher: Demo Website vs Cold Email vs WhatsApp */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <button 
                    onClick={() => setLeadDrawerTab('website')}
                    style={{ 
                      flex: 1, 
                      padding: '8px 8px', 
                      background: 'transparent', 
                      border: 'none', 
                      borderBottom: leadDrawerTab === 'website' ? '2px solid #c084fc' : '2px solid transparent',
                      color: leadDrawerTab === 'website' ? '#c084fc' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Globe size={13} /> Live Demo
                  </button>
                  <button 
                    onClick={() => setLeadDrawerTab('email')}
                    style={{ 
                      flex: 1, 
                      padding: '8px 8px', 
                      background: 'transparent', 
                      border: 'none', 
                      borderBottom: leadDrawerTab === 'email' ? '2px solid var(--primary)' : '2px solid transparent',
                      color: leadDrawerTab === 'email' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Mail size={13} /> Cold Email
                  </button>
                  <button 
                    onClick={() => setLeadDrawerTab('whatsapp')}
                    style={{ 
                      flex: 1, 
                      padding: '8px 8px', 
                      background: 'transparent', 
                      border: 'none', 
                      borderBottom: leadDrawerTab === 'whatsapp' ? '2px solid #22c55e' : '2px solid transparent',
                      color: leadDrawerTab === 'whatsapp' ? '#22c55e' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <MessageSquare size={13} /> WhatsApp
                  </button>
                </div>

                {/* Lead Pipeline Notice / Error Alert */}
                {selectedLead.error && (
                  <div style={{ 
                    padding: '10px 14px', 
                    marginBottom: '14px', 
                    borderRadius: '6px', 
                    background: 'rgba(239, 68, 68, 0.12)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    color: '#f87171', 
                    fontSize: '12px', 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '8px' 
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Action Error:</strong> {selectedLead.error}
                    </div>
                  </div>
                )}

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
                          <button 
                            className="btn btn-secondary"
                            onClick={() => setLeadDrawerTab('whatsapp')}
                            style={{ width: '100%', marginTop: '10px', borderColor: '#22c55e', color: '#4ade80' }}
                          >
                            Next: Open WhatsApp Outreach Pitch →
                          </button>
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

                {/* TAB 3: WhatsApp Outreach */}
                {leadDrawerTab === 'whatsapp' && (
                  <div>
                    {/* Target WhatsApp Phone Header */}
                    <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Phone size={16} color="#22c55e" />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4ade80' }}>
                              {selectedLead.whatsapp || selectedLead.phone ? (
                                `Target: ${sanitizePhoneNumberForWhatsApp(selectedLead.whatsapp || selectedLead.phone) || selectedLead.whatsapp || selectedLead.phone}`
                              ) : (
                                'No WhatsApp Number Set'
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {sanitizePhoneNumberForWhatsApp(selectedLead.whatsapp || selectedLead.phone) ? 'E.164 Validated • Ready for 1-Click Chat' : 'Add phone number above to enable 1-click WhatsApp messaging'}
                            </div>
                          </div>
                        </div>

                        {getWhatsAppOutreachUrl(selectedLead.whatsapp || selectedLead.phone, editedWhatsappPitch || selectedLead.whatsappDraft || generateFallbackWhatsAppPitch(selectedLead.name, selectedLead.demoSiteUrl)) && (
                          <a
                            href={getWhatsAppOutreachUrl(selectedLead.whatsapp || selectedLead.phone, editedWhatsappPitch || selectedLead.whatsappDraft || generateFallbackWhatsAppPitch(selectedLead.name, selectedLead.demoSiteUrl))!}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ background: '#22c55e', borderColor: '#22c55e', color: '#000', fontWeight: 600, fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <MessageSquare size={13} /> Chat on WhatsApp
                          </a>
                        )}
                      </div>
                    </div>

                    {/* AI Pitch Composer & Editor */}
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>AI WhatsApp Pitch Message</label>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={() => {
                            const pitchToCopy = editedWhatsappPitch || selectedLead.whatsappDraft || generateFallbackWhatsAppPitch(selectedLead.name, selectedLead.demoSiteUrl);
                            navigator.clipboard.writeText(pitchToCopy);
                            setCopiedPitch(true);
                            setTimeout(() => setCopiedPitch(false), 2500);
                            showMsg('WhatsApp pitch copied to clipboard!');
                          }}
                        >
                          {copiedPitch ? <><Check size={12} color="#22c55e" /> Copied!</> : <><Copy size={12} /> Copy Pitch</>}
                        </button>
                      </div>

                      <textarea 
                        className="form-control" 
                        rows={8} 
                        style={{ fontSize: '13px', lineHeight: '1.45', fontFamily: 'monospace' }}
                        value={editedWhatsappPitch || selectedLead.whatsappDraft || ''}
                        onChange={e => setEditedWhatsappPitch(e.target.value)}
                        placeholder="Click below to generate a tailored WhatsApp pitch with AI, or type custom message..."
                      />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => saveEditedWhatsappDraft(selectedLead.id)}
                          disabled={loadingLeadId === selectedLead.id || isDraftingWhatsapp}
                        >
                          <Edit size={14} /> Save Pitch Draft
                        </button>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => draftLeadWhatsapp(selectedLead.id)}
                          disabled={loadingLeadId === selectedLead.id || isDraftingWhatsapp}
                          style={{ borderColor: '#22c55e', color: '#4ade80' }}
                        >
                          {isDraftingWhatsapp ? <Loader2 className="animate-spin" size={14} /> : <><Sparkles size={14} /> Compose Pitch with AI</>}
                        </button>
                      </div>

                      {/* Primary WhatsApp Direct Outreach Action Button */}
                      {getWhatsAppOutreachUrl(selectedLead.whatsapp || selectedLead.phone, editedWhatsappPitch || selectedLead.whatsappDraft || generateFallbackWhatsAppPitch(selectedLead.name, selectedLead.demoSiteUrl)) ? (
                        <a
                          href={getWhatsAppOutreachUrl(selectedLead.whatsapp || selectedLead.phone, editedWhatsappPitch || selectedLead.whatsappDraft || generateFallbackWhatsAppPitch(selectedLead.name, selectedLead.demoSiteUrl))!}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ 
                            width: '100%', 
                            marginTop: '16px', 
                            background: '#22c55e', 
                            borderColor: '#22c55e', 
                            color: '#000', 
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            textDecoration: 'none',
                            padding: '10px 16px',
                            borderRadius: '8px'
                          }}
                          onClick={() => {
                            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, whatsappStatus: 'contacted' } : l));
                            fetch(`${API_BASE}/leads/${selectedLead.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ whatsappStatus: 'contacted', whatsappDraft: editedWhatsappPitch || selectedLead.whatsappDraft })
                            }).catch(() => {});
                          }}
                        >
                          <MessageSquare size={16} /> Open WhatsApp Chat with Pre-filled Pitch
                        </a>
                      ) : (
                        <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Add a phone number for {selectedLead.name} above to launch direct 1-click WhatsApp chat.
                          </p>
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
