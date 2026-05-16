'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultTab?: 'login' | 'register';
  toast: (msg: string) => void;
}

export default function AuthModal({ open, onClose, onSuccess, defaultTab = 'login', toast }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
        toast('Welcome back ✦');
        onClose();
        onSuccess?.();
      } else {
        await register(email, password);
        setRegistered(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div style={styles.backdrop} onClick={handleBackdrop}>
      <div style={styles.modal}>
        {registered ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📬</div>
            <h2 style={styles.title}>Check your inbox</h2>
            <p style={styles.sub}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then log in.</p>
            <button style={styles.submitBtn} onClick={() => { setTab('login'); setRegistered(false); }}>
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <div style={styles.loginIcon}>{tab === 'login' ? '✦' : '🌟'}</div>
            <h2 style={styles.title}>{tab === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <p style={styles.sub}>{tab === 'login' ? 'Access your constellation' : 'Join to comment & react'}</p>

            <div style={styles.tabs}>
              <button style={{ ...styles.tabBtn, ...(tab === 'login' ? styles.tabActive : {}) }} onClick={() => { setTab('login'); setError(''); }}>Login</button>
              <button style={{ ...styles.tabBtn, ...(tab === 'register' ? styles.tabActive : {}) }} onClick={() => { setTab('register'); setError(''); }}>Register</button>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder={tab === 'register' ? 'Min. 8 characters' : 'Password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button style={{ ...styles.submitBtn, opacity: loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </>
        )}
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)',
    backdropFilter: 'blur(10px)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  },
  modal: {
    background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.2)',
    borderRadius: '22px', maxWidth: '340px', width: '100%',
    padding: '2.2rem 2rem', position: 'relative',
  },
  loginIcon: { fontSize: '2rem', textAlign: 'center', marginBottom: '.8rem' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', textAlign: 'center', marginBottom: '.25rem' },
  sub: { fontSize: '.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.2rem' },
  tabs: { display: 'flex', gap: '.5rem', marginBottom: '1.2rem' },
  tabBtn: {
    flex: 1, padding: '.5rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.2)',
    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', transition: 'all .25s',
  },
  tabActive: { background: 'rgba(201,168,76,.15)', borderColor: 'var(--gold)', color: 'var(--gold)' },
  errorBox: {
    fontSize: '.78rem', color: '#e07070', background: 'rgba(200,50,50,.1)',
    border: '1px solid rgba(200,50,50,.2)', borderRadius: '8px',
    padding: '.5rem .8rem', marginBottom: '.8rem', textAlign: 'center',
  },
  field: { marginBottom: '.8rem' },
  label: { fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '.35rem' },
  input: {
    width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)',
    borderRadius: '9px', padding: '.65rem .9rem', color: 'var(--text)',
    fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', outline: 'none',
  },
  submitBtn: {
    width: '100%', padding: '.75rem', borderRadius: '50px', border: 'none',
    background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)',
    fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', fontWeight: 500, cursor: 'pointer',
    marginTop: '.4rem', transition: 'opacity .25s',
  },
  closeBtn: {
    position: 'absolute', top: '.8rem', right: '.8rem', width: '28px', height: '28px',
    borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.4)',
    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '.75rem',
  },
};
