import React, { useState } from 'react';
import { 
  FolderKanban, CheckSquare, Plus, Calendar, 
  Check, User, Copy, Building, Trash2 
} from 'lucide-react';
import type { CRMRecord } from './crmTypes';
import { money, statusStyles } from './crmTypes';

interface ProjectsViewProps {
  records: CRMRecord[];
  onCreateRecord: (r: Partial<CRMRecord> & { type: string; name: string }) => Promise<void>;
  onUpdateRecord: (id: string, updates: Partial<CRMRecord>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  records,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord
}) => {
  const [subTab, setSubTab] = useState<'projects' | 'delivery'>('projects');
  
  // Project Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedClient, setSelectedClient] = useState('none');
  const [projectScope, setProjectScope] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [projectValue, setProjectValue] = useState('2200');
  
  // Delivery Task Form State
  const [taskKind, setTaskKind] = useState<'task' | 'deliverable' | 'update'>('task');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskClient, setTaskClient] = useState('none');
  const [taskDue, setTaskDue] = useState('');
  const [taskOwner, setTaskOwner] = useState('Lead Developer');
  const [taskNotes, setTaskNotes] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clients = records.filter(r => r.type === 'client');
  const projects = records.filter(r => r.type === 'project');
  const tasks = records.filter(r => ['task', 'deliverable', 'update'].includes(r.type));

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setSaving(true);
    try {
      await onCreateRecord({
        type: 'project',
        name: projectName,
        clientId: selectedClient === 'none' ? null : selectedClient,
        status: 'in-progress',
        value: Math.round(Number(projectValue) * 100),
        payload: {
          scope: projectScope,
          targetDate: targetDate || new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
          progress: 10
        }
      });
      setProjectName('');
      setSelectedClient('none');
      setProjectScope('');
      setTargetDate('');
      setShowProjectModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setSaving(true);
    try {
      await onCreateRecord({
        type: taskKind,
        name: taskTitle,
        clientId: taskClient === 'none' ? null : taskClient,
        status: 'open',
        value: 0,
        payload: {
          owner: taskOwner,
          due: taskDue || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          notes: taskNotes
        }
      });
      setTaskTitle('');
      setTaskNotes('');
      setTaskDue('');
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
            <FolderKanban size={22} color="#c084fc" /> Projects & Delivery Desk
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Manage client deliverables, execution sprints, and ongoing design & development progress.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${subTab === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('projects')}
          >
            <FolderKanban size={15} /> Active Projects ({projects.length})
          </button>
          <button 
            className={`btn ${subTab === 'delivery' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('delivery')}
          >
            <CheckSquare size={15} /> Delivery Desk & Tasks ({tasks.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: Active Projects */}
      {subTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setShowProjectModal(true)}>
              <Plus size={16} /> New Project
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {projects.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active projects. Click &quot;New Project&quot; above to launch a new client build.
              </div>
            ) : (
              projects.map(project => {
                const client = clients.find(c => c.id === project.clientId);
                const progress = project.payload?.progress ?? 0;
                const statusStyle = statusStyles[project.status] || statusStyles['in-progress'];

                return (
                  <div key={project.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{project.name}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building size={11} /> {client?.name || 'Internal Studio Project'}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                        textTransform: 'capitalize'
                      }}>
                        {project.status.replace('-', ' ')}
                      </span>
                    </div>

                    {project.payload?.scope && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                        {project.payload.scope}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Sprint Completion</span>
                        <strong>{progress}%</strong>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          background: progress >= 100 ? 'var(--success)' : '#c084fc', 
                          height: '100%', 
                          width: `${Math.min(100, Math.max(0, progress))}%`,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                        {money(project.value)}
                      </span>
                      {project.payload?.targetDate && (
                        <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> Target: {project.payload.targetDate}
                        </span>
                      )}
                    </div>

                    {/* Progress Increment & Status Change */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
                        onClick={() => onUpdateRecord(project.id, { 
                          payload: { ...project.payload, progress: Math.min(100, progress + 25) },
                          status: progress + 25 >= 100 ? 'complete' : project.status
                        })}
                      >
                        +25% Progress
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                        onClick={() => onDeleteRecord(project.id)}
                        title="Delete Project"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Delivery Desk & Tasks */}
      {subTab === 'delivery' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '20px' }}>
          {/* New Task Form Column */}
          <div className="glass-card" style={{ padding: '20px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} color="var(--primary)" /> Add Action Item
            </h3>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Item Type</label>
                <select 
                  className="form-control" 
                  value={taskKind} 
                  onChange={e => setTaskKind(e.target.value as any)}
                >
                  <option value="task">Sprint Task</option>
                  <option value="deliverable">Deliverable for Review</option>
                  <option value="update">Client Progress Update</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Title *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Implement online booking modal"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Assigned Client</label>
                <select 
                  className="form-control" 
                  value={taskClient} 
                  onChange={e => setTaskClient(e.target.value)}
                >
                  <option value="none">-- Internal Studio --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Due Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={taskDue}
                    onChange={e => setTaskDue(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Assignee</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={taskOwner}
                    onChange={e => setTaskOwner(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Notes / Brief</label>
                <textarea 
                  className="form-control" 
                  rows={3} 
                  placeholder="Technical notes or copy for client update..."
                  value={taskNotes}
                  onChange={e => setTaskNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving || !taskTitle.trim()} style={{ marginTop: '6px' }}>
                {saving ? 'Adding...' : 'Save to Delivery Desk'}
              </button>
            </form>
          </div>

          {/* Tasks List Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
              Execution Queue ({tasks.filter(t => t.status !== 'complete').length} Open)
            </h3>

            {tasks.length === 0 ? (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Delivery desk is clear. Add a sprint task using the form.
              </div>
            ) : (
              tasks.map(t => {
                const client = clients.find(c => c.id === t.clientId);
                const isComplete = t.status === 'complete';

                return (
                  <div 
                    key={t.id} 
                    className="glass-card" 
                    style={{ 
                      padding: '14px 18px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      gap: '14px',
                      opacity: isComplete ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                      <button 
                        onClick={() => onUpdateRecord(t.id, { status: isComplete ? 'open' : 'complete' })}
                        style={{ 
                          width: '22px', 
                          height: '22px', 
                          borderRadius: '6px', 
                          border: isComplete ? 'none' : '2px solid var(--border-color)',
                          background: isComplete ? 'var(--success)' : 'transparent',
                          color: '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          marginTop: '2px',
                          flexShrink: 0
                        }}
                      >
                        {isComplete && <Check size={14} />}
                      </button>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px', textDecoration: isComplete ? 'line-through' : 'none' }}>
                            {t.name}
                          </strong>
                          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            {t.type}
                          </span>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {client && <span><Building size={11} style={{ verticalAlign: 'middle' }} /> {client.name}</span>}
                          {t.payload?.due && <span><Calendar size={11} style={{ verticalAlign: 'middle' }} /> Due {t.payload.due}</span>}
                          {t.payload?.owner && <span><User size={11} style={{ verticalAlign: 'middle' }} /> {t.payload.owner}</span>}
                        </div>

                        {t.payload?.notes && (
                          <p style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px' }}>
                            {t.payload.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {t.type === 'update' && (
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '11px' }}
                          onClick={() => {
                            navigator.clipboard.writeText(`${t.name}\n\n${t.payload?.notes || ''}`);
                            setCopiedId(t.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                        >
                          {copiedId === t.id ? 'Copied!' : <><Copy size={11} /> Copy</>}
                        </button>
                      )}

                      <button 
                        onClick={() => onDeleteRecord(t.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showProjectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', position: 'relative' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Start New Client Project</h3>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Project Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Sterling Partners Brand & Web Experience"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Client</label>
                <select 
                  className="form-control"
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                >
                  <option value="none">-- Internal Studio --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Contract Value (£)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={projectValue}
                    onChange={e => setProjectValue(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Target Delivery Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Scope of Deliverables</label>
                <textarea 
                  className="form-control" 
                  rows={3} 
                  placeholder="e.g. UX wireframes, 6-page responsive web build, SEO migration, client training."
                  value={projectScope}
                  onChange={e => setProjectScope(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProjectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !projectName.trim()}>
                  {saving ? 'Saving...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
