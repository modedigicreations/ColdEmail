import React, { useState } from 'react';
import { 
  Shield, Crown, User, Mail, Lock,
  CheckCircle2, X, AlertCircle
} from 'lucide-react';
import type { StaffUser, StaffRole } from './crmTypes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001/api'
    : '/api'
);

interface StaffAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  currentUser: StaffUser | null;
  onLoginSuccess: (user: StaffUser) => void;
  allowClose?: boolean;
}

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  allowClose = true
}) => {
  const [tab, setTab] = useState<'login' | 'onboard'>('login');
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Onboard State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('staff');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Outbound & Growth');
  const [phone, setPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        localStorage.setItem('mode_agency_staff', JSON.stringify(data.user));
        setTimeout(() => {
          onLoginSuccess(data.user);
          if (onClose) onClose();
        }, 500);
      } else {
        setErrorMsg(data.error || 'Failed to authenticate');
      }
    } catch (err: any) {
      setErrorMsg(`Authentication error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('mode_agency_staff', JSON.stringify(data.user));
        onLoginSuccess(data.user);
        if (onClose) onClose();
      } else {
        setErrorMsg(data.error || 'Login failed');
      }
    } catch (err: any) {
      setErrorMsg(`Login error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password: password || 'staff123',
          role,
          title: title || (role === 'super_admin' ? 'Agency Executive' : role === 'admin' ? 'Operations Lead' : 'Growth Specialist'),
          department,
          phone,
          actorId: currentUser?.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        localStorage.setItem('mode_agency_staff', JSON.stringify(data.user));
        setTimeout(() => {
          onLoginSuccess(data.user);
          if (onClose) onClose();
        }, 700);
      } else {
        setErrorMsg(data.error || 'Onboarding failed');
      }
    } catch (err: any) {
      setErrorMsg(`Onboarding error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 7, 15, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div 
        className="glass-card"
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '16px',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          padding: '28px',
          position: 'relative'
        }}
      >
        {allowClose && onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
            color: '#fff',
            marginBottom: '12px',
            boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)'
          }}>
            <Crown size={28} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Adeola & Mode OS
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Agency Suite • Staff Onboarding & Role-Based Access
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '20px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => { setTab('login'); setErrorMsg(null); }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'login' ? 'var(--primary)' : 'transparent',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            Staff Sign In
          </button>
          <button
            onClick={() => { setTab('onboard'); setErrorMsg(null); }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'onboard' ? 'var(--primary)' : 'transparent',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            Staff Onboarding
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#34d399',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {/* 1-Click Fast Persona Switcher */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.05)',
          border: '1px dashed rgba(139, 92, 246, 0.25)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '18px'
        }}>
          <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            ⚡ 1-Click Demo Accounts (Switch & Test Instantly):
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '8px' }}>
            <button
              onClick={() => handleQuickLogin('adeola@agency.os')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px', borderColor: 'rgba(139, 92, 246, 0.4)', textAlign: 'left' }}
              title="Super Admin: Full agency oversight, staff assignment & full audit log"
            >
              👑 Adeola <br/>
              <span style={{ fontSize: '10px', color: '#c084fc' }}>Super Admin</span>
            </button>

            <button
              onClick={() => handleQuickLogin('sarah@agency.os')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px', textAlign: 'left' }}
              title="Admin: Operations & Project Desk"
            >
              🛡️ Sarah <br/>
              <span style={{ fontSize: '10px', color: '#60a5fa' }}>Admin</span>
            </button>

            <button
              onClick={() => handleQuickLogin('marcus@agency.os')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px', textAlign: 'left' }}
              title="Staff: Outbound Discovery & Pitching"
            >
              💼 Marcus <br/>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Staff (Outreach)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('elena@agency.os')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px', textAlign: 'left' }}
              title="Staff: Creative UX & Delivery"
            >
              🎨 Elena <br/>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Staff (Design)</span>
            </button>
          </div>
        </div>

        {tab === 'login' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Staff Work Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@agency.os"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                  style={{ paddingLeft: '34px' }}
                />
                <Mail size={15} style={{ position: 'absolute', left: '11px', top: '13px', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter password (default: admin / staff)"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  style={{ paddingLeft: '34px' }}
                />
                <Lock size={15} style={{ position: 'absolute', left: '11px', top: '13px', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !loginEmail.trim()}
              style={{ width: '100%', marginTop: '6px', padding: '10px' }}
            >
              {isLoading ? 'Verifying...' : 'Sign In to Workspace'}
            </button>
          </form>
        ) : (
          /* ONBOARDING FORM */
          <form onSubmit={handleOnboard} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. David Sterling"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Staff Email *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="david@agency.os"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Staff Role *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div 
                  onClick={() => setRole('staff')}
                  style={{
                    border: role === 'staff' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: role === 'staff' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <User size={18} color={role === 'staff' ? 'var(--primary)' : 'var(--text-muted)'} />
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>Staff</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Assigned tasks</div>
                </div>

                <div 
                  onClick={() => setRole('admin')}
                  style={{
                    border: role === 'admin' ? '1px solid #60a5fa' : '1px solid var(--border-color)',
                    background: role === 'admin' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <Shield size={18} color={role === 'admin' ? '#60a5fa' : 'var(--text-muted)'} />
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>Admin</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Operations lead</div>
                </div>

                <div 
                  onClick={() => setRole('super_admin')}
                  style={{
                    border: role === 'super_admin' ? '1px solid #c084fc' : '1px solid var(--border-color)',
                    background: role === 'super_admin' ? 'rgba(192, 132, 252, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <Crown size={18} color={role === 'super_admin' ? '#c084fc' : 'var(--text-muted)'} />
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>Super Admin</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Full reassign & audit</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Job Title / Specialty</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Lead Outreach Specialist"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Department</label>
                <select
                  className="form-control"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                >
                  <option value="Outbound Discovery">Outbound Discovery & Scrape</option>
                  <option value="Creative & UX">Design & Landing Pages</option>
                  <option value="Client Delivery">Client Delivery & Build</option>
                  <option value="Operations">Operations & Invoicing</option>
                  <option value="Executive Leadership">Executive Leadership</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Phone / WhatsApp</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="+44 7911 234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Create password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !name.trim() || !email.trim()}
              style={{ width: '100%', marginTop: '6px', padding: '10px' }}
            >
              {isLoading ? 'Onboarding...' : 'Complete Staff Onboarding'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
