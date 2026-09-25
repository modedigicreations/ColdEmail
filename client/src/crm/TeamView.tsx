import React, { useState, useEffect } from 'react';
import { 
  Users, Crown, Shield, User, Plus, Filter, 
  Clock, ArrowRightLeft, 
  CheckCircle2, AlertCircle, RefreshCw, Edit3
} from 'lucide-react';
import type { StaffUser, StaffRole, StaffActivity, CRMRecord } from './crmTypes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001/api'
    : '/api'
);

interface TeamViewProps {
  currentUser: StaffUser;
  crmRecords: CRMRecord[];
  onRefreshCRM?: () => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenOnboarding?: () => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  currentUser,
  crmRecords,
  onRefreshCRM,
  onNavigateToTab,
  onOpenOnboarding
}) => {
  const [subTab, setSubTab] = useState<'roster' | 'activities'>('roster');
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  
  // Reassignment Modal State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTargetType, setReassignTargetType] = useState<'deal' | 'project' | 'task'>('deal');
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [reassignStaffId, setReassignStaffId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Role Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>('staff');
  const [newDepartment, setNewDepartment] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Quick Onboard Modal State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardName, setOnboardName] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardRole, setOnboardRole] = useState<StaffRole>('staff');
  const [onboardTitle, setOnboardTitle] = useState('');
  const [onboardDept, setOnboardDept] = useState('Outbound & Lead Gen');
  const [isOnboarding, setIsOnboarding] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isSuperAdmin = currentUser.role === 'super_admin';
  const isAdminOrSuper = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    fetchStaff();
    fetchActivities();
  }, [filterStaffId, filterAction]);

  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/staff`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStaffId !== 'all') params.append('staffId', filterStaffId);
      if (filterAction !== 'all') params.append('action', filterAction);
      params.append('limit', '100');

      const res = await fetch(`${API_BASE}/staff/activities?${params.toString()}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.activities)) {
        setActivities(data.activities);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!isSuperAdmin) {
      showMsg('Permission denied: Only Super Admin can change staff roles.', 'error');
      return;
    }

    setIsUpdatingRole(true);
    try {
      const res = await fetch(`${API_BASE}/staff/${editingStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          department: newDepartment || editingStaff.department,
          actorId: currentUser.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMsg(data.message || 'Staff role updated');
        setEditingStaff(null);
        fetchStaff();
        fetchActivities();
      } else {
        showMsg(data.error || 'Failed to update role', 'error');
      }
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleExecuteReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTargetId || !reassignStaffId) return;

    setIsReassigning(true);
    try {
      const res = await fetch(`${API_BASE}/staff/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: reassignTargetType,
          targetId: reassignTargetId,
          newStaffId: reassignStaffId,
          actorId: currentUser.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMsg(data.message || 'Workload reassigned successfully!');
        setShowReassignModal(false);
        setReassignTargetId('');
        fetchStaff();
        fetchActivities();
        if (onRefreshCRM) onRefreshCRM();
      } else {
        showMsg(data.error || 'Failed to reassign workload', 'error');
      }
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleOnboardNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardName.trim() || !onboardEmail.trim()) return;

    setIsOnboarding(true);
    try {
      const res = await fetch(`${API_BASE}/auth/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: onboardName,
          email: onboardEmail,
          role: onboardRole,
          title: onboardTitle,
          department: onboardDept,
          actorId: currentUser.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMsg(data.message || 'New staff member onboarded!');
        setShowOnboardModal(false);
        setOnboardName('');
        setOnboardEmail('');
        setOnboardTitle('');
        fetchStaff();
        fetchActivities();
      } else {
        showMsg(data.error || 'Failed to onboard staff', 'error');
      }
    } catch (err: any) {
      showMsg(err.message, 'error');
    } finally {
      setIsOnboarding(false);
    }
  };

  const availableDeals = crmRecords.filter(r => r.type === 'lead');
  const availableProjects = crmRecords.filter(r => r.type === 'project');
  const availableTasks = crmRecords.filter(r => r.type === 'task');

  const getRoleBadge = (role: StaffRole) => {
    if (role === 'super_admin') {
      return (
        <span style={{
          background: 'rgba(192, 132, 252, 0.15)',
          color: '#c084fc',
          border: '1px solid rgba(192, 132, 252, 0.4)',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Crown size={12} /> Super Admin
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span style={{
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Shield size={12} /> Admin
        </span>
      );
    }
    return (
      <span style={{
        background: 'rgba(255, 255, 255, 0.06)',
        color: '#9ca3af',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        fontSize: '11px',
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <User size={12} /> Staff
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {message && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: '#fff',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
          {message.text}
        </div>
      )}

      {/* Header bar with summary & CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Users size={22} color="var(--primary)" /> Staff Onboarding & Activity Audit
            </h2>
            {getRoleBadge(currentUser.role)}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', margin: 0 }}>
            {isSuperAdmin 
              ? 'Super Admin Portal: Assign & reassign staff roles, reassign deals/projects, and monitor every activity of every staff member.'
              : 'Staff Workspace: View team directory, workload assignments, and recent agency milestones.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isSuperAdmin && (
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowReassignModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowRightLeft size={15} color="var(--primary)" /> Reassign Workload
            </button>
          )}

          {isAdminOrSuper && (
            <button 
              className="btn btn-primary" 
              onClick={() => onOpenOnboarding ? onOpenOnboarding() : setShowOnboardModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Onboard Staff
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs: Directory vs Activity Audit */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button
          onClick={() => setSubTab('roster')}
          style={{
            background: subTab === 'roster' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            border: subTab === 'roster' ? '1px solid var(--border-glow)' : '1px solid transparent',
            color: subTab === 'roster' ? '#c084fc' : 'var(--text-muted)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Users size={15} /> Staff Directory & Workloads ({staffList.length})
        </button>

        <button
          onClick={() => setSubTab('activities')}
          style={{
            background: subTab === 'activities' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            border: subTab === 'activities' ? '1px solid var(--border-glow)' : '1px solid transparent',
            color: subTab === 'activities' ? '#c084fc' : 'var(--text-muted)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock size={15} /> Live Staff Activity & Audit Log ({activities.length})
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => { fetchStaff(); fetchActivities(); if (onRefreshCRM) onRefreshCRM(); }}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={isLoading}
            title="Refresh staff roster and live audit events"
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} /> {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* TAB 1: STAFF ROSTER & ASSIGNMENTS */}
      {subTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {staffList.map(staff => {
              const isCurrentUser = staff.id === currentUser.id;

              return (
                <div
                  key={staff.id}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: isCurrentUser ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-color)',
                    background: isCurrentUser ? 'rgba(139, 92, 246, 0.04)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: staff.role === 'super_admin' ? 'linear-gradient(135deg, #7c3aed, #c084fc)' : staff.role === 'admin' ? 'linear-gradient(135deg, #2563eb, #60a5fa)' : 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: '#fff'
                      }}>
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {staff.name}
                          {isCurrentUser && (
                            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>(You)</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{staff.email}</div>
                      </div>
                    </div>

                    {getRoleBadge(staff.role)}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div><strong>Title:</strong> {staff.title}</div>
                    <div><strong>Department:</strong> {staff.department}</div>
                    {staff.phone && <div><strong>Phone:</strong> {staff.phone}</div>}
                  </div>

                  {/* Workload stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center'
                  }}>
                    <div 
                      onClick={() => onNavigateToTab && onNavigateToTab('pipeline')}
                      style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
                      title="View active pipeline deals"
                    >
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                        {staff.assignedDealsCount || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Deals</div>
                    </div>
                    <div 
                      onClick={() => onNavigateToTab && onNavigateToTab('projects')}
                      style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
                      title="View active projects in delivery desk"
                    >
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                        {staff.assignedProjectsCount || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Projects</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                        {staff.assignedTasksCount || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tasks</div>
                    </div>
                  </div>

                  {/* Super Admin Management Controls */}
                  {isSuperAdmin && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px',
                      marginTop: '4px'
                    }}>
                      <button
                        onClick={() => {
                          setEditingStaff(staff);
                          setNewRole(staff.role);
                          setNewDepartment(staff.department);
                        }}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '5px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} /> Reassign Role
                      </button>

                      <button
                        onClick={() => {
                          setReassignStaffId(staff.id);
                          setShowReassignModal(true);
                        }}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '5px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <ArrowRightLeft size={12} /> Assign Workload
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE AUDIT TRAIL ("Every activity of every staff") */}
      {subTab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'var(--bg-card)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Filter size={14} /> Filter by Staff:
              </div>
              <select
                className="form-control"
                value={filterStaffId}
                onChange={e => setFilterStaffId(e.target.value)}
                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
              >
                <option value="all">-- All Staff Members --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role.replace('_', ' ').toUpperCase()})</option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Action Type:
              </div>
              <select
                className="form-control"
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
              >
                <option value="all">-- All Actions --</option>
                <option value="workload_reassigned">Workload Reassigned</option>
                <option value="role_reassigned">Role Reassigned</option>
                <option value="deal_won">Deal Won</option>
                <option value="proposal_sent">Proposal Sent</option>
                <option value="lead_discovered">Lead Discovered</option>
                <option value="site_deployed">Demo Site Deployed</option>
                <option value="staff_onboarded">Staff Onboarded</option>
                <option value="staff_login">Staff Sign In</option>
              </select>
            </div>

            <button
              onClick={() => { fetchActivities(); fetchStaff(); }}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} /> Refresh Log
            </button>
          </div>

          {/* Activity Stream Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activities.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
                No recorded staff activity matches the selected filters.
              </div>
            ) : (
              activities.map(act => {
                const actDate = new Date(act.timestamp);
                const timeString = isNaN(actDate.getTime()) ? act.timestamp : actDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + actDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={act.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: act.staffRole === 'super_admin' ? 'rgba(192, 132, 252, 0.2)' : act.staffRole === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: act.staffRole === 'super_admin' ? '#c084fc' : act.staffRole === 'admin' ? '#60a5fa' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {act.staffName.slice(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '13px' }}>{act.staffName}</strong>
                          {getRoleBadge(act.staffRole)}
                          <span style={{
                            fontSize: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase'
                          }}>
                            {act.action.replace('_', ' ')}
                          </span>
                        </div>

                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#e2e8f0', lineHeight: '1.4' }}>
                          {act.description}
                        </p>

                        {act.targetName && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#c084fc', marginTop: '4px' }}>
                            🎯 Target: {act.targetName} ({act.targetType})
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {timeString}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* REASSIGN WORKLOAD MODAL (SUPER ADMIN ONLY) */}
      {showReassignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={18} color="var(--primary)" /> Assign / Reassign Workload
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 0 }}>
              Super Admin Control: Assign leads, sales deals, or delivery projects to any staff member.
            </p>

            <form onSubmit={handleExecuteReassign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Item Type to Assign *</label>
                <select
                  className="form-control"
                  value={reassignTargetType}
                  onChange={e => {
                    setReassignTargetType(e.target.value as any);
                    setReassignTargetId('');
                  }}
                >
                  <option value="deal">Sales Pipeline Deal</option>
                  <option value="project">Delivery Desk Project</option>
                  <option value="task">Delivery Sprint Task</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Select Item *</label>
                <select
                  className="form-control"
                  value={reassignTargetId}
                  onChange={e => setReassignTargetId(e.target.value)}
                  required
                >
                  <option value="">-- Choose {reassignTargetType} --</option>
                  {reassignTargetType === 'deal' && availableDeals.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                  ))}
                  {reassignTargetType === 'project' && availableProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                  ))}
                  {reassignTargetType === 'task' && availableTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Assign To Staff Member *</label>
                <select
                  className="form-control"
                  value={reassignStaffId}
                  onChange={e => setReassignStaffId(e.target.value)}
                  required
                >
                  <option value="">-- Select Staff Assignee --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.title} ({s.role.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReassignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isReassigning || !reassignTargetId || !reassignStaffId}>
                  {isReassigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL (SUPER ADMIN ONLY) */}
      {editingStaff && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Crown size={18} color="#c084fc" /> Reassign Role for {editingStaff.name}
            </h3>

            <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Assigned Role *</label>
                <select
                  className="form-control"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                >
                  <option value="staff">Staff (Outreach & Design Execution)</option>
                  <option value="admin">Admin (Operations & Project Management)</option>
                  <option value="super_admin">Super Admin (Full Oversight & Assignment)</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Department</label>
                <input
                  type="text"
                  className="form-control"
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  placeholder="Department name"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingStaff(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isUpdatingRole}>
                  {isUpdatingRole ? 'Saving...' : 'Update Staff Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONBOARD MODAL */}
      {showOnboardModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} color="var(--primary)" /> Onboard New Staff Member
            </h3>

            <form onSubmit={handleOnboardNewStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Staff Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Thomas Wright"
                  value={onboardName}
                  onChange={e => setOnboardName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Staff Work Email *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="thomas@agency.os"
                  value={onboardEmail}
                  onChange={e => setOnboardEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Role Assignment *</label>
                <select
                  className="form-control"
                  value={onboardRole}
                  onChange={e => setOnboardRole(e.target.value as any)}
                >
                  <option value="staff">Staff (Outreach & UX Designer)</option>
                  <option value="admin">Admin (Operations Lead)</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Founder & Oversight)</option>}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Job Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Lead Conversion Designer"
                  value={onboardTitle}
                  onChange={e => setOnboardTitle(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Department</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Outbound & Lead Gen"
                  value={onboardDept}
                  onChange={e => setOnboardDept(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOnboardModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isOnboarding || !onboardName || !onboardEmail}>
                  {isOnboarding ? 'Onboarding...' : 'Complete Staff Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
