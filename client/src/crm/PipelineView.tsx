import React, { useState } from 'react';
import { 
  Target, Plus, Calendar, ExternalLink, ArrowRight, ArrowLeft, 
  Trash2, Building, Sparkles 
} from 'lucide-react';
import type { CRMRecord } from './crmTypes';
import { money, statusStyles } from './crmTypes';

interface PipelineViewProps {
  records: CRMRecord[];
  onCreateRecord: (r: Partial<CRMRecord> & { type: string; name: string }) => Promise<void>;
  onUpdateRecord: (id: string, updates: Partial<CRMRecord>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onNavigateToTab?: (tab: string) => void;
  onSyncPipeline?: () => Promise<void>;
  onWinDeal?: (dealId: string) => Promise<void>;
}

const STAGES = [
  { id: 'discovery', label: '1. Discovery & Lead', desc: 'Identified opportunities' },
  { id: 'proposal', label: '2. Proposal Sent', desc: 'Custom pitch / proposal' },
  { id: 'negotiation', label: '3. Negotiation', desc: 'Terms & scope review' },
  { id: 'won', label: '4. Closed / Won', desc: 'Accepted & ready to build' },
  { id: 'lost', label: '5. Lost', desc: 'Unresponsive or declined' }
];

export const PipelineView: React.FC<PipelineViewProps> = ({
  records,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onNavigateToTab,
  onSyncPipeline,
  onWinDeal
}) => {
  const [showModal, setShowModal] = useState(false);
  const [dealName, setDealName] = useState('');
  const [selectedClient, setSelectedClient] = useState('none');
  const [dealStage, setDealStage] = useState('discovery');
  const [dealValue, setDealValue] = useState('2200'); // £2,200 standard
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionLoadingDealId, setActionLoadingDealId] = useState<string | null>(null);

  const safeRecords: CRMRecord[] = Array.isArray(records) ? records : ((records as any)?.records || []);
  const clients = safeRecords.filter(r => r.type === 'client');
  const deals = safeRecords.filter(r => r.type === 'lead');

  const totalPipelineValue = deals
    .filter(d => d.status !== 'lost')
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const wonDealsValue = deals
    .filter(d => d.status === 'won')
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealName.trim()) return;
    setSaving(true);
    try {
      await onCreateRecord({
        type: 'lead',
        name: dealName,
        clientId: selectedClient === 'none' ? null : selectedClient,
        status: dealStage,
        value: Math.round(Number(dealValue) * 100),
        payload: {
          stage: dealStage,
          notes,
          probability: dealStage === 'won' ? 100 : dealStage === 'negotiation' ? 80 : dealStage === 'proposal' ? 60 : 30,
          expectedClose: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
        }
      });
      setDealName('');
      setSelectedClient('none');
      setDealStage('discovery');
      setNotes('');
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!onSyncPipeline) return;
    setIsSyncing(true);
    try {
      await onSyncPipeline();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteWin = async (deal: CRMRecord) => {
    setActionLoadingDealId(deal.id);
    try {
      if (onWinDeal) {
        await onWinDeal(deal.id);
      } else {
        await onUpdateRecord(deal.id, {
          status: 'won',
          payload: {
            ...deal.payload,
            stage: 'won',
            probability: 100,
            wonAt: new Date().toISOString()
          }
        });
      }
    } finally {
      setActionLoadingDealId(null);
    }
  };

  const moveStage = async (deal: CRMRecord, direction: 'forward' | 'backward') => {
    const currentIndex = STAGES.findIndex(s => s.id === deal.status);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= STAGES.length) return;

    const nextStage = STAGES[targetIndex].id;

    if (nextStage === 'won') {
      await handleExecuteWin(deal);
      return;
    }

    setActionLoadingDealId(deal.id);
    try {
      await onUpdateRecord(deal.id, {
        status: nextStage,
        payload: {
          ...deal.payload,
          stage: nextStage,
          probability: nextStage === 'won' ? 100 : nextStage === 'negotiation' ? 80 : nextStage === 'proposal' ? 60 : 30
        }
      });
    } finally {
      setActionLoadingDealId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar with summary & CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Target size={22} color="var(--primary)" /> Sales Pipeline & Deals
            </h2>
            <span style={{ 
              background: 'rgba(16, 185, 129, 0.12)', 
              color: '#34d399', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              fontSize: '11px', 
              fontWeight: 600, 
              padding: '2px 8px', 
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
              Auto-Pipeline Engine
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
            Automated from Outbound Discovery → AI Site Proposal → Negotiation → Closed Won Delivery & Invoicing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--border-glow)', padding: '6px 14px', borderRadius: '8px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Active Pipeline Value</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#c084fc' }}>{money(totalPipelineValue)}</span>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 14px', borderRadius: '8px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Closed / Won Revenue</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#34d399' }}>{money(wonDealsValue)}</span>
          </div>

          {onSyncPipeline && (
            <button 
              className="btn btn-secondary" 
              onClick={handleSync} 
              disabled={isSyncing}
              title="Synchronize all newly discovered leads into the pipeline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
            >
              <span style={{ display: 'inline-block', animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
              {isSyncing ? 'Syncing...' : 'Auto-Sync Leads'}
            </button>
          )}

          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Deal
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '16px', 
        overflowX: 'auto',
        paddingBottom: '16px'
      }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => (d.status || 'discovery').toLowerCase() === stage.id);
          const stageTotal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
          const style = statusStyles[stage.id] || statusStyles.open;

          return (
            <div 
              key={stage.id} 
              style={{ 
                background: 'var(--bg-card)', 
                border: stage.id === 'won' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: '240px',
                boxShadow: stage.id === 'won' ? '0 0 20px rgba(16, 185, 129, 0.05)' : undefined
              }}
            >
              {/* Column Header */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: style.color }}>
                    {stage.label}
                  </span>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    background: style.bg, 
                    color: style.color, 
                    border: `1px solid ${style.border}`,
                    fontWeight: 600
                  }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{stage.desc}</span>
                  <strong>{money(stageTotal)}</strong>
                </div>
              </div>

              {/* Deal Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
                {stageDeals.length === 0 ? (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    No deals in {stage.id}
                  </div>
                ) : (
                  stageDeals.map(deal => {
                    const client = clients.find(c => c.id === deal.clientId);
                    const demoSiteUrl = deal.payload?.demoSiteUrl || client?.payload?.demoSiteUrl;
                    const contactEmail = deal.payload?.contactEmail || client?.payload?.email;
                    const contactPhone = deal.payload?.contactPhone || client?.payload?.phone;
                    const isWinning = actionLoadingDealId === deal.id;

                    return (
                      <div 
                        key={deal.id} 
                        style={{ 
                          background: stage.id === 'won' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.03)', 
                          border: stage.id === 'won' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'border-color 0.2s ease',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <strong style={{ fontSize: '13px', lineHeight: '1.3', color: stage.id === 'won' ? '#34d399' : 'inherit' }}>
                            {deal.name}
                          </strong>
                          <button 
                            onClick={() => onDeleteRecord(deal.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="Delete Deal"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Client / Business details */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {client && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Building size={11} /> {client.name}
                            </span>
                          )}
                          {contactPhone && <span>📞 {contactPhone}</span>}
                          {contactEmail && <span>✉️ {contactEmail}</span>}
                        </div>

                        {/* Demo Site Preview Button */}
                        {demoSiteUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                background: 'rgba(192, 132, 252, 0.08)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(192, 132, 252, 0.2)',
                                width: 'fit-content'
                              }}
                            >
                              <Sparkles size={11} /> Demo Concept <ExternalLink size={10} />
                            </a>
                            <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600 }}>● Live</span>
                          </div>
                        ) : stage.id === 'discovery' ? (
                          <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>⏳ Demo site pending</span>
                            {onNavigateToTab && (
                              <button 
                                onClick={() => onNavigateToTab('outbound')}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '11px' }}
                              >
                                Generate in Outbound
                              </button>
                            )}
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: stage.id === 'won' ? '#34d399' : 'var(--success)' }}>
                            {money(deal.value)}
                          </span>

                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={11} /> {deal.payload?.expectedClose || 'Target: 14d'}
                          </span>
                        </div>

                        {deal.payload?.notes && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {deal.payload.notes}
                          </p>
                        )}

                        {/* STAGE-SPECIFIC ACTION BADGES */}
                        {stage.id === 'negotiation' && (
                          <button
                            onClick={() => handleExecuteWin(deal)}
                            disabled={isWinning}
                            className="btn btn-primary"
                            style={{ 
                              width: '100%', 
                              padding: '5px 8px', 
                              fontSize: '11px', 
                              marginTop: '4px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            🎉 {isWinning ? 'Provisioning...' : 'Close & Win Deal (Auto-Provision)'}
                          </button>
                        )}

                        {stage.id === 'won' && onNavigateToTab && (
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '4px', 
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px solid rgba(16, 185, 129, 0.2)'
                          }}>
                            <button
                              onClick={() => onNavigateToTab('projects')}
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '10px', textAlign: 'center' }}
                            >
                              📁 Delivery Desk
                            </button>
                            <button
                              onClick={() => onNavigateToTab('billing')}
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '10px', textAlign: 'center' }}
                            >
                              🧾 Deposit Invoice
                            </button>
                            <button
                              onClick={() => onNavigateToTab('clients')}
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '10px', textAlign: 'center' }}
                            >
                              👤 Client Account
                            </button>
                            <button
                              onClick={() => onNavigateToTab('journey')}
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '10px', textAlign: 'center' }}
                            >
                              🧭 Client Journey
                            </button>
                          </div>
                        )}

                        {/* Stage Progression Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                          <button
                            disabled={stage.id === 'discovery' || isWinning}
                            onClick={() => moveStage(deal, 'backward')}
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px', opacity: stage.id === 'discovery' ? 0.3 : 1 }}
                            title="Move back"
                          >
                            <ArrowLeft size={11} />
                          </button>

                          <button
                            disabled={stage.id === 'won' || stage.id === 'lost' || isWinning}
                            onClick={() => moveStage(deal, 'forward')}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '3px 10px', 
                              fontSize: '11px', 
                              borderColor: stage.id === 'negotiation' ? '#10b981' : 'var(--primary)', 
                              color: stage.id === 'negotiation' ? '#34d399' : 'var(--primary)',
                              fontWeight: stage.id === 'negotiation' ? 600 : 500
                            }}
                            title={stage.id === 'negotiation' ? 'Win Deal & Auto-Provision' : 'Advance Stage'}
                          >
                            {stage.id === 'negotiation' ? 'Win Deal' : 'Next'} <ArrowRight size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Deal Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', position: 'relative' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Add Sales Deal to Pipeline</h3>
            <form onSubmit={handleCreateDeal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Deal Title *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Apex Dental Studio — Full Website Redesign"
                  value={dealName}
                  onChange={e => setDealName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Linked Client</label>
                <select 
                  className="form-control"
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                >
                  <option value="none">-- Unassigned / New Lead --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Deal Value (£)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={dealValue}
                    onChange={e => setDealValue(e.target.value)}
                    min="0"
                    step="50"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Initial Stage</label>
                  <select 
                    className="form-control"
                    value={dealStage}
                    onChange={e => setDealStage(e.target.value)}
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Notes / Scope Summary</label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  placeholder="e.g. Needs fast mobile site, online bookings, and monthly SEO care plan."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !dealName.trim()}>
                  {saving ? 'Saving...' : 'Add Deal to Pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
