import React, { useState } from 'react';
import { 
  ReceiptText, Plus,
  Printer, Trash2, FileText
} from 'lucide-react';
import type { CRMRecord, CRMService } from './crmTypes';
import { money, statusStyles } from './crmTypes';

interface BillingViewProps {
  records: CRMRecord[];
  services: CRMService[];
  onCreateRecord: (r: Partial<CRMRecord> & { type: string; name: string }) => Promise<void>;
  onUpdateRecord: (id: string, updates: Partial<CRMRecord>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
}

export const BillingView: React.FC<BillingViewProps> = ({
  records,
  services,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord
}) => {
  const [filterType, setFilterType] = useState<'all' | 'invoice' | 'proposal'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeDoc, setActiveDoc] = useState<CRMRecord | null>(null);

  // Form State
  const [docType, setDocType] = useState<'invoice' | 'proposal'>('proposal');
  const [docTitle, setDocTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState('none');
  const [dueDate, setDueDate] = useState('');
  const [discountPounds, setDiscountPounds] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentInstructions, setPaymentInstructions] = useState('Direct Bank Transfer:\nBank: Barclays / Mode Webhost\nAccount: 12345678\nSort Code: 20-00-00');
  const [lineItems, setLineItems] = useState<{ description: string; quantity: number; rate: number }[]>([
    { description: 'Business website (UX, design & responsive build)', quantity: 1, rate: 220000 }
  ]);
  const [saving, setSaving] = useState(false);

  // Payment Recording State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const clients = records.filter(r => r.type === 'client');
  const billingRecords = records.filter(r => 
    (r.type === 'invoice' || r.type === 'proposal') &&
    (filterType === 'all' || r.type === filterType)
  );

  // Calculate totals
  const subtotalPence = lineItems.reduce((sum, item) => sum + Math.round(item.quantity * item.rate), 0);
  const discountPence = Math.round(Number(discountPounds || 0) * 100);
  const taxablePence = Math.max(0, subtotalPence - discountPence);
  const taxPence = Math.round(taxablePence * (Number(taxRate || 0) / 100));
  const totalPence = taxablePence + taxPence;

  const totalInvoiced = records
    .filter(r => r.type === 'invoice')
    .reduce((sum, r) => sum + (r.value || 0), 0);
  const totalPaid = records
    .filter(r => r.type === 'invoice')
    .reduce((sum, r) => sum + (r.payload?.paid || (r.status === 'paid' ? r.value : 0) || 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  const addServiceLine = (serviceId: string) => {
    const s = services.find(srv => srv.id === serviceId);
    if (!s) return;
    setLineItems(prev => [...prev, { description: s.name, quantity: 1, rate: s.price }]);
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    setSaving(true);
    try {
      await onCreateRecord({
        type: docType,
        name: docTitle,
        clientId: selectedClient === 'none' ? null : selectedClient,
        status: docType === 'invoice' ? 'open' : 'proposal',
        value: totalPence,
        payload: {
          dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          lineItems,
          discountPence,
          taxRate: Number(taxRate),
          taxPence,
          paid: 0,
          paymentInstructions
        }
      });
      setShowCreateModal(false);
      setDocTitle('');
      setLineItems([{ description: '', quantity: 1, rate: 0 }]);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (doc: CRMRecord) => {
    if (!paymentAmount) return;
    const paidPence = Math.round(Number(paymentAmount) * 100);
    const existingPaid = doc.payload?.paid || 0;
    const newTotalPaid = existingPaid + paidPence;
    const isFullyPaid = newTotalPaid >= doc.value;

    await onUpdateRecord(doc.id, {
      status: isFullyPaid ? 'paid' : 'part-paid',
      payload: {
        ...doc.payload,
        paid: newTotalPaid,
        receipt: `Payment of ${money(paidPence)} recorded on ${new Date().toLocaleDateString()} (Ref: ${paymentRef || 'N/A'})`
      }
    });

    setActiveDoc(prev => prev ? {
      ...prev,
      status: isFullyPaid ? 'paid' : 'part-paid',
      payload: { ...prev.payload, paid: newTotalPaid }
    } : null);
    setPaymentAmount('');
    setPaymentRef('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ReceiptText size={22} color="var(--success)" /> Proposals & Invoicing
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Create client proposals, milestone deposits, and track received bank payments.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> New Proposal / Invoice
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-item">
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Total Invoiced</p>
          <p className="stat-val" style={{ color: 'var(--primary)' }}>{money(totalInvoiced)}</p>
        </div>
        <div className="stat-item">
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Total Collected</p>
          <p className="stat-val" style={{ color: 'var(--success)' }}>{money(totalPaid)}</p>
        </div>
        <div className="stat-item">
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Outstanding Balance</p>
          <p className="stat-val" style={{ color: 'var(--warning)' }}>{money(outstandingBalance)}</p>
        </div>
        <div className="stat-item">
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Active Proposals</p>
          <p className="stat-val" style={{ color: '#c084fc' }}>
            {records.filter(r => r.type === 'proposal').length}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs" style={{ width: 'fit-content' }}>
        <button 
          className={`tab-btn ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          All Commercial Records
        </button>
        <button 
          className={`tab-btn ${filterType === 'proposal' ? 'active' : ''}`}
          onClick={() => setFilterType('proposal')}
        >
          Proposals
        </button>
        <button 
          className={`tab-btn ${filterType === 'invoice' ? 'active' : ''}`}
          onClick={() => setFilterType('invoice')}
        >
          Invoices
        </button>
      </div>

      {/* Documents Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container">
          {billingRecords.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No proposals or invoices found. Click &quot;New Proposal / Invoice&quot; to create one.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Document Title</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {billingRecords.map(doc => {
                  const client = clients.find(c => c.id === doc.clientId);
                  const style = statusStyles[doc.status] || statusStyles.draft;

                  return (
                    <tr key={doc.id} style={{ cursor: 'pointer' }} onClick={() => setActiveDoc(doc)}>
                      <td>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={14} color="var(--primary)" /> {doc.name}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px' }}>
                          {client?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          {doc.type}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--success)' }}>
                          {money(doc.value)}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {doc.payload?.dueDate || 'On Delivery'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: style.bg,
                          color: style.color,
                          border: `1px solid ${style.border}`,
                          textTransform: 'capitalize'
                        }}>
                          {doc.status}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '11px' }}
                            onClick={() => setActiveDoc(doc)}
                            title="Open & Print Invoice"
                          >
                            <Printer size={12} /> View
                          </button>
                          <button 
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '11px' }}
                            onClick={() => onDeleteRecord(doc.id)}
                            title="Delete"
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

      {/* Modal: Create Document */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>
              Create {docType === 'invoice' ? 'Invoice' : 'Client Proposal'}
            </h3>

            <form onSubmit={handleCreateDocument} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Document Type</label>
                  <select 
                    className="form-control" 
                    value={docType} 
                    onChange={e => setDocType(e.target.value as any)}
                  >
                    <option value="proposal">Client Proposal</option>
                    <option value="invoice">Formal Invoice</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Assign to Client</label>
                  <select 
                    className="form-control" 
                    value={selectedClient} 
                    onChange={e => setSelectedClient(e.target.value)}
                  >
                    <option value="none">-- Unassigned --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Document Title *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder={docType === 'invoice' ? 'e.g. INV-2026-002 — Deposit Payment' : 'e.g. Website Redesign & SEO Growth Proposal'}
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Due Date / Valid Until</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              {/* Service Catalog Quick Picker */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Quick Add from Agency Service Catalog:
                </label>
                <select 
                  className="form-control"
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) {
                      addServiceLine(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">-- Choose a pre-priced agency service to add --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category}) — {money(s.price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items Editor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Commercial Scope & Line Items</label>
                {lineItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 30px', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Item description"
                      value={item.description}
                      onChange={e => {
                        const val = e.target.value;
                        setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, description: val } : it));
                      }}
                    />
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                      }}
                    />
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="Rate (£)"
                      min="0"
                      value={item.rate / 100}
                      onChange={e => {
                        const val = Math.round(Number(e.target.value) * 100);
                        setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, rate: val } : it));
                      }}
                    />
                    <button 
                      type="button" 
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: 'fit-content', padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setLineItems(prev => [...prev, { description: '', quantity: 1, rate: 0 }])}
                >
                  + Add Custom Line
                </button>
              </div>

              {/* Discounts & Tax */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Discount (£)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    min="0"
                    value={discountPounds}
                    onChange={e => setDiscountPounds(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Tax / VAT (%)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Bank & Payment Instructions</label>
                <textarea 
                  className="form-control" 
                  rows={2} 
                  value={paymentInstructions} 
                  onChange={e => setPaymentInstructions(e.target.value)} 
                />
              </div>

              {/* Calculated Total Bar */}
              <div style={{ 
                background: 'rgba(16, 185, 129, 0.08)', 
                border: '1px solid rgba(16, 185, 129, 0.25)', 
                borderRadius: '8px', 
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Document Grand Total:</span>
                <strong style={{ fontSize: '18px', color: 'var(--success)' }}>{money(totalPence)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !docTitle.trim()}>
                  {saving ? 'Saving...' : `Save ${docType === 'invoice' ? 'Invoice' : 'Proposal'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Print Document */}
      {activeDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f172a' }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={14} /> Print / Save PDF
                </button>
              </div>
              <button className="btn btn-secondary" onClick={() => setActiveDoc(null)}>
                Close
              </button>
            </div>

            {/* Printable Document Sheet */}
            <div style={{ background: '#fff', color: '#0f172a', padding: '36px', borderRadius: '8px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Mode Webhost & Digital Creations</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Web Development • SEO • Brand Strategy • Care Plans</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ fontSize: '18px', textTransform: 'uppercase', color: '#64748b' }}>{activeDoc.type}</h3>
                  <strong style={{ fontSize: '16px' }}>{activeDoc.name}</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Date: {new Date(activeDoc.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Client & Due Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0', fontSize: '13px' }}>
                <div>
                  <strong style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', display: 'block' }}>Billed To:</strong>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
                    {clients.find(c => c.id === activeDoc.clientId)?.name || 'Direct Client'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>
                    {clients.find(c => c.id === activeDoc.clientId)?.payload?.email || ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', display: 'block' }}>Payment Due:</strong>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{activeDoc.payload?.dueDate || 'On receipt'}</div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', fontWeight: 600, display: 'inline-block', marginTop: '4px' }}>
                    Status: {activeDoc.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Description</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeDoc.payload?.lineItems || [{ description: activeDoc.name, quantity: 1, rate: activeDoc.value }]).map((line: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}>{line.description}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{line.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{money(line.rate)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{money(Math.round(line.quantity * line.rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                  {activeDoc.payload?.discountPence > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Discount:</span>
                      <span>-{money(activeDoc.payload.discountPence)}</span>
                    </div>
                  )}
                  {activeDoc.payload?.taxPence > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Tax / VAT:</span>
                      <span>+{money(activeDoc.payload.taxPence)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, borderTop: '2px solid #e2e8f0', paddingTop: '6px' }}>
                    <span>Total:</span>
                    <span>{money(activeDoc.value)}</span>
                  </div>
                  {activeDoc.type === 'invoice' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                      <span>Amount Paid:</span>
                      <span>{money(activeDoc.payload?.paid || (activeDoc.status === 'paid' ? activeDoc.value : 0))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Instructions */}
              <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', fontSize: '12px', color: '#64748b' }}>
                <strong>Payment Terms & Bank Details:</strong>
                <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                  {activeDoc.payload?.paymentInstructions || 'Direct Bank Transfer / Wire\nSort Code: 20-00-00\nAccount: 12345678'}
                </p>
                {activeDoc.payload?.receipt && (
                  <p style={{ marginTop: '8px', color: '#16a34a', fontWeight: 600 }}>
                    {activeDoc.payload.receipt}
                  </p>
                )}
              </div>
            </div>

            {/* Record Payment Section for Invoices */}
            {activeDoc.type === 'invoice' && activeDoc.status !== 'paid' && (
              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Record Received Bank Payment</h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="Amount (£)"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    style={{ maxWidth: '140px' }}
                  />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Reference (e.g. Bank Wire 0924)"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => handleRecordPayment(activeDoc)}>
                    Record Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
