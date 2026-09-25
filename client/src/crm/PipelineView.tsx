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
  onDeleteRecord
}) => {
  const [showModal, setShowModal] = useState(false);
  const [dealName, setDealName] = useState('');
  const [selectedClient, setSelectedClient] = useState('none');
  const [dealStage, setDealStage] = useState('discovery');
  const [dealValue, setDealValue] = useState('2200'); // £2,200 standard
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const clients = records.filter(r => r.type === 'client');
  const deals = records.filter(r => r.type === 'lead');

  const totalPipelineValue = deals
    .filter(d => d.status !== 'lost')
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

  const moveStage = async (deal: CRMRecord, direction: 'forward' | 'backward') => {
    const currentIndex = STAGES.findIndex(s => s.id === deal.status);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= STAGES.length) return;

    const nextStage = STAGES[targetIndex].id;
    await onUpdateRecord(deal.id, {
      status: nextStage,
      payload: {
        ...deal.payload,
        stage: nextStage,
        probability: nextStage === 'won' ? 100 : nextStage === 'negotiation' ? 80 : nextStage === 'proposal' ? 60 : 30
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar with summary & CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={22} color="var(--primary)" /> Sales Pipeline & Deals
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Track client opportunities from outbound discovery through proposal to signed contract.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--border-glow)', padding: '6px 14px', borderRadius: '8px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Active Pipeline Value</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#c084fc' }}>{money(totalPipelineValue)}</span>
          </div>

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
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: '240px'
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

                    return (
                      <div 
                        key={deal.id} 
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.03)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'border-color 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <strong style={{ fontSize: '13px', lineHeight: '1.3' }}>{deal.name}</strong>
                          <button 
                            onClick={() => onDeleteRecord(deal.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="Delete Deal"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {client && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <Building size={11} /> {client.name}
                          </div>
                        )}

                        {demoSiteUrl && (
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
                            <Sparkles size={11} /> Demo Preview <ExternalLink size={10} />
                          </a>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>
                            {money(deal.value)}
                          </span>

                          {deal.payload?.expectedClose && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Calendar size={11} /> {deal.payload.expectedClose}
                            </span>
                          )}
                        </div>

                        {deal.payload?.notes && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {deal.payload.notes}
                          </p>
                        )}

                        {/* Stage Progression Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                          <button
                            disabled={stage.id === 'discovery'}
                            onClick={() => moveStage(deal, 'backward')}
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px', opacity: stage.id === 'discovery' ? 0.3 : 1 }}
                            title="Move back"
                          >
                            <ArrowLeft size={11} />
                          </button>

                          <button
                            disabled={stage.id === 'won' || stage.id === 'lost'}
                            onClick={() => moveStage(deal, 'forward')}
                            className="btn btn-secondary"
                            style={{ padding: '3px 10px', fontSize: '11px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                            title="Advance Stage"
                          >
                            Next <ArrowRight size={11} />
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
