import React, { useState } from 'react';
import { 
  Users, Plus, Globe, Mail, Phone, MessageSquare, ExternalLink, 
  Search, Trash2, FolderKanban, ReceiptText, Sparkles 
} from 'lucide-react';
import type { CRMRecord } from './crmTypes';
import { money } from './crmTypes';
import { getWhatsAppOutreachUrl } from '../whatsapp';

interface ClientsViewProps {
  records: CRMRecord[];
  onCreateRecord: (r: Partial<CRMRecord> & { type: string; name: string }) => Promise<void>;
  onUpdateRecord: (id: string, updates: Partial<CRMRecord>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onNavigateToTab?: (tab: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  records,
  onCreateRecord,
  onDeleteRecord,
  onNavigateToTab
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const clients = records.filter(r => r.type === 'client');
  const projects = records.filter(r => r.type === 'project');
  const invoices = records.filter(r => r.type === 'invoice' || r.type === 'proposal');
  const deals = records.filter(r => r.type === 'lead');

  const filteredClients = clients.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.payload?.email && c.payload.email.toLowerCase().includes(q)) ||
      (c.payload?.category && c.payload.category.toLowerCase().includes(q));
  });

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreateRecord({
        type: 'client',
        name,
        clientId: null,
        status: 'active',
        value: 0,
        payload: {
          category,
          website,
          email,
          phone,
          notes,
          source: 'Manual Client Entry'
        }
      });
      setName('');
      setCategory('');
      setWebsite('');
      setEmail('');
      setPhone('');
      setNotes('');
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="var(--primary)" /> Clients & Accounts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Directory of agency clients, associated deals, live websites, and commercial contracts.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          className="form-control" 
          style={{ paddingLeft: '36px' }}
          placeholder="Search clients by name, email, niche..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Clients Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filteredClients.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No clients found. Add a client above or convert an outbound lead from the Outbound Engine tab.
          </div>
        ) : (
          filteredClients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);
            const clientInvoices = invoices.filter(i => i.clientId === client.id);
            const clientDeals = deals.filter(d => d.clientId === client.id);
            const waUrl = getWhatsAppOutreachUrl(client.payload?.phone);
            const demoSiteUrl = client.payload?.demoSiteUrl;

            return (
              <div 
                key={client.id} 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px', 
                  padding: '18px',
                  background: 'var(--bg-card)'
                }}
              >
                {/* Client Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{client.name}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {client.payload?.category || 'Agency Client'}
                    </span>
                  </div>

                  <button 
                    onClick={() => onDeleteRecord(client.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                    title="Delete Client"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Contact Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  {client.payload?.website && (
                    <a 
                      href={client.payload.website.startsWith('http') ? client.payload.website : `https://${client.payload.website}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--info)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Globe size={13} /> {client.payload.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}

                  {client.payload?.email && (
                    <a 
                      href={`mailto:${client.payload.email}`}
                      style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Mail size={13} color="var(--text-muted)" /> {client.payload.email}
                    </a>
                  )}

                  {client.payload?.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={13} /> {client.payload.phone}
                      </span>
                      {waUrl && (
                        <a 
                          href={waUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ 
                            color: '#22c55e', 
                            fontSize: '11px', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            textDecoration: 'none'
                          }}
                          title="Chat on WhatsApp"
                        >
                          <MessageSquare size={11} /> WhatsApp
                        </a>
                      )}
                    </div>
                  )}

                  {demoSiteUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <a 
                        href={demoSiteUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ 
                          fontSize: '11px', 
                          color: '#c084fc', 
                          textDecoration: 'none', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          background: 'rgba(192, 132, 252, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(192, 132, 252, 0.25)'
                        }}
                      >
                        <Sparkles size={11} /> View Concept Demo Site <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Metrics Badges */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '8px', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '10px', 
                  marginTop: '4px' 
                }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Projects</span>
                    <strong style={{ fontSize: '12px' }}>{clientProjects.length}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Billing</span>
                    <strong style={{ fontSize: '12px' }}>{clientInvoices.length}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Deals</span>
                    <strong style={{ fontSize: '12px', color: '#c084fc' }}>
                      {clientDeals.length > 0 ? money(clientDeals.reduce((acc, d) => acc + (d.value || 0), 0)) : '0'}
                    </strong>
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {onNavigateToTab && (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, padding: '5px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        onClick={() => onNavigateToTab('billing')}
                      >
                        <ReceiptText size={12} /> New Proposal
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, padding: '5px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderColor: '#c084fc', color: '#c084fc' }}
                        onClick={() => onNavigateToTab('projects')}
                      >
                        <FolderKanban size={12} /> Open Projects
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Client Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', position: 'relative' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Add Agency Client</h3>
            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Company / Client Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Sterling Real Estate Partners"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Industry / Category</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Commercial Property & Architecture"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Website URL</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. sterlingpartners.co.uk"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Primary Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="contact@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Phone / WhatsApp</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="+44 7911 123456"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Notes</label>
                <textarea 
                  className="form-control" 
                  rows={2}
                  placeholder="e.g. Met via cold outreach. Seeking complete website rebranding."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                  {saving ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
