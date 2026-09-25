import React, { useState } from 'react';
import { 
  BriefcaseBusiness, Check, Clock, Lock, 
  ShieldCheck
} from 'lucide-react';
import type { CRMRecord } from './crmTypes';
import { money } from './crmTypes';

interface JourneyViewProps {
  records: CRMRecord[];
  onUpdateRecord: (id: string, updates: Partial<CRMRecord>) => Promise<void>;
  onCreateRecord: (r: Partial<CRMRecord> & { type: string; name: string }) => Promise<void>;
}

const JOURNEY_STAGES = [
  { id: 'proposal', name: '1. Proposal', desc: 'Scope & agreement' },
  { id: 'discovery', name: '2. Discovery', desc: 'Client intake form' },
  { id: 'contract', name: '3. Contract', desc: 'Digital agreement' },
  { id: 'deposit', name: '4. Deposit', desc: '50% Milestone invoice' },
  { id: 'delivery', name: '5. Delivery', desc: 'Sprint builds & tasks' },
  { id: 'approval', name: '6. Approval', desc: 'Client sign-off' },
  { id: 'handover', name: '7. Handover', desc: 'Asset pack & care plan' }
];

export const JourneyView: React.FC<JourneyViewProps> = ({
  records,
  onUpdateRecord,
  onCreateRecord
}) => {
  const safeRecords: CRMRecord[] = Array.isArray(records) ? records : ((records as any)?.records || []);
  const clients = safeRecords.filter(r => r.type === 'client');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || 'none');
  const [activeStage, setActiveStage] = useState<string>('proposal');

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const clientRecords = selectedClient 
    ? safeRecords.filter(r => r.clientId === selectedClient.id)
    : [];

  const clientProposals = clientRecords.filter(r => r.type === 'proposal');
  const clientInvoices = clientRecords.filter(r => r.type === 'invoice');
  const clientTasks = clientRecords.filter(r => r.type === 'task');
  const clientProjects = clientRecords.filter(r => r.type === 'project');

  // Stage completion heuristics
  const isProposalDone = clientProposals.some(p => p.status === 'accepted' || p.status === 'paid');
  const isDiscoveryDone = isProposalDone || clientRecords.some(r => r.type === 'onboarding');
  const isContractDone = clientRecords.some(r => r.type === 'contract' && r.status === 'signed') || isProposalDone;
  const isDepositDone = clientInvoices.some(i => i.status === 'paid');
  const isDeliveryDone = clientTasks.length > 0 && clientTasks.every(t => t.status === 'complete');
  const isApprovalDone = clientRecords.some(r => r.type === 'deliverable' && r.status === 'approved');
  const isHandoverDone = clientProjects.some(p => p.status === 'complete');

  const stageStatuses: Record<string, boolean> = {
    proposal: isProposalDone,
    discovery: isDiscoveryDone,
    contract: isContractDone,
    deposit: isDepositDone,
    delivery: isDeliveryDone,
    approval: isApprovalDone,
    handover: isHandoverDone
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BriefcaseBusiness size={22} color="var(--primary)" /> Client Journey & Onboarding
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Follow the complete client lifecycle from first proposal to design approval and final handover.
          </p>
        </div>

        {/* Client Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Client Journey:</span>
          <select 
            className="form-control"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            style={{ minWidth: '220px' }}
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedClient ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No clients available. Add a client first to view their journey.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 7-Stage Visual Lifecycle Progress Tracker */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{selectedClient.name} — Lifecycle Roadmap</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {Object.values(stageStatuses).filter(Boolean).length} of 7 Stages Complete
              </span>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
              gap: '8px' 
            }}>
              {JOURNEY_STAGES.map(stage => {
                const done = stageStatuses[stage.id];
                const active = activeStage === stage.id;

                return (
                  <button
                    key={stage.id}
                    onClick={() => setActiveStage(stage.id)}
                    style={{
                      background: active ? 'rgba(139, 92, 246, 0.15)' : done ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: active ? '2px solid var(--primary)' : done ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: done ? 'var(--success)' : 'var(--text-muted)' }}>
                        {stage.name}
                      </span>
                      {done ? (
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} color="#000" />
                        </div>
                      ) : (
                        <Clock size={12} color="var(--text-muted)" />
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {stage.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Stage Pane Detail */}
          <div className="glass-card" style={{ padding: '24px' }}>
            {activeStage === 'proposal' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 1: Proposal & Scope of Work</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Deliver commercial terms, project line items, and deposit requirements.
                </p>

                {clientProposals.length > 0 ? (
                  clientProposals.map(p => (
                    <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Status: <span style={{ color: p.status === 'accepted' ? 'var(--success)' : 'var(--primary)' }}>{p.status}</span> • Total: {money(p.value)}
                        </div>
                      </div>
                      {p.status !== 'accepted' && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => onUpdateRecord(p.id, { status: 'accepted' })}
                        >
                          Mark Proposal Accepted
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    No proposal created for this client yet. Create one in the Proposals tab.
                  </div>
                )}
              </div>
            )}

            {activeStage === 'discovery' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 2: Discovery Intake</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Collect brand goals, target audience, technical needs, and domain access.
                </p>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Discovery Questionnaire Checklist:</h4>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={14} color="var(--success)" /> Primary brand objective & direct conversion goal
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={14} color="var(--success)" /> Competitor websites & preferred visual aesthetic
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={14} color="var(--success)" /> Brand colours, logo typography & high-res media assets
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={14} color="var(--success)" /> Domain DNS & registrar access for launch delegation
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeStage === 'contract' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 3: Digital Agreement</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Digital master services agreement and deliverable sign-off terms.
                </p>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '8px' }}>
                    <Lock size={16} /> <strong>Electronic Agreement Register</strong>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Terms include: Intellectual property assignment upon final invoice payment, 30-day post-launch warranty, and mutual confidentiality.
                  </p>
                </div>
              </div>
            )}

            {activeStage === 'deposit' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 4: Milestone Deposit Invoice</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  50% initial payment before starting development sprints.
                </p>

                {clientInvoices.length > 0 ? (
                  clientInvoices.map(inv => (
                    <div key={inv.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{inv.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Status: <span style={{ color: inv.status === 'paid' ? 'var(--success)' : 'var(--warning)' }}>{inv.status.toUpperCase()}</span> • Amount: {money(inv.value)}
                        </div>
                      </div>
                      {inv.status !== 'paid' && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => onUpdateRecord(inv.id, { status: 'paid', payload: { ...inv.payload, paid: inv.value } })}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    <p style={{ margin: 0, marginBottom: '10px' }}>No invoice generated yet for this client.</p>
                    {selectedClient && (
                      <button
                        className="btn btn-primary"
                        onClick={() => onCreateRecord({
                          type: 'invoice',
                          name: `50% Deposit - ${selectedClient.name}`,
                          clientId: selectedClient.id,
                          status: 'open',
                          value: 125000,
                          payload: {
                            docType: 'invoice',
                            lineItems: [{ description: '50% Project Kickoff Deposit', quantity: 1, rate: 125000 }],
                            total: 125000
                          }
                        })}
                      >
                        Generate 50% Deposit Invoice
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeStage === 'delivery' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 5: Delivery Sprints</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Design wireframing, high-performance responsive web build, and SEO implementation.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {clientTasks.map(t => (
                    <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t.name}</span>
                      <span style={{ fontSize: '11px', color: t.status === 'complete' ? 'var(--success)' : 'var(--warning)' }}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                  {clientTasks.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                      No tasks assigned yet. Add tasks from the Projects & Delivery Desk tab.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeStage === 'approval' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 6: Client Approval & Sign-Off</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Final staging website review, mobile verification, and client acceptance.
                </p>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '6px' }}>
                    <ShieldCheck size={18} /> <strong>Quality Assurance Checklist Passed</strong>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Mobile responsiveness, SSL certificates, schema markup, and speed audits verified.
                  </p>
                </div>
              </div>
            )}

            {activeStage === 'handover' && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Stage 7: Final Handover Hub & Care Plan</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Deliver DNS cutover, Google Search Console ownership, and activate Website Care retainer.
                </p>

                <div style={{ background: 'rgba(192, 132, 252, 0.08)', padding: '18px', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.25)' }}>
                  <h4 style={{ fontSize: '14px', color: '#c084fc', marginBottom: '8px' }}>Active Retainer & Care Plan</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Website Care retainer active. Includes automated weekly backups, core security updates, uptime monitoring, and priority technical support.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
