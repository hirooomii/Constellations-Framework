'use client';
import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

const CLOUDINARY_CLOUD  = 'dky9pzz0r';
const CLOUDINARY_PRESET = 'constellation_uploads';

async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Avatar upload failed');
  const data = await res.json();
  return data.secure_url;
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultTab?: 'login' | 'register';
  toast: (msg: string) => void;
}

export default function AuthModal({ open, onClose, onSuccess, defaultTab = 'login', toast }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab]               = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [username, setUsername]     = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl]   = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [registered, setRegistered] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function resetForm() {
    setEmail(''); setPassword(''); setUsername('');
    setDisplayName(''); setAvatarUrl(''); setAvatarPreview('');
    setError(''); setRegistered(false);
  }

  function switchTab(t: 'login' | 'register') {
    setTab(t); setError('');
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      toast('Avatar uploaded ✦');
    } catch {
      setError('Avatar upload failed. Try again.');
      setAvatarPreview('');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    if (tab === 'register') {
      if (!username.trim()) { setError('Username is required.'); return; }
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        setError('Username: 3-30 chars, letters/numbers/_ only.'); return;
      }
      if (!displayName.trim()) { setError('Display name is required.'); return; }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
        toast('Welcome back ✦');
        onClose(); onSuccess?.();
      } else {
        await register(email, password, username.trim(), displayName.trim(), avatarUrl || undefined);
        setRegistered(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>

        {registered ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📬</div>
            <h2 style={s.title}>Check your inbox</h2>
            <p style={s.sub}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then log in.</p>
            <button style={s.submitBtn} onClick={() => { resetForm(); setTab('login'); }}>
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '.8rem' }}>
              {tab === 'login' ? '✦' : '🌟'}
            </div>
            <h2 style={s.title}>{tab === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <p style={s.sub}>{tab === 'login' ? 'Access your constellation' : 'Join to add verses & react'}</p>

            {/* Tabs */}
            <div style={s.tabs}>
              <button style={{ ...s.tabBtn, ...(tab === 'login' ? s.tabActive : {}) }} onClick={() => switchTab('login')}>Login</button>
              <button style={{ ...s.tabBtn, ...(tab === 'register' ? s.tabActive : {}) }} onClick={() => switchTab('register')}>Register</button>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            {/* Avatar upload (register only) */}
            {tab === 'register' && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div
                  style={s.avatarWrap}
                  onClick={() => fileRef.current?.click()}
                  title="Upload avatar"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" style={s.avatarImg} />
                  ) : (
                    <div style={s.avatarPlaceholder}>
                      <span style={{ fontSize: '1.5rem' }}>📷</span>
                      <span style={{ fontSize: '.65rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                        {uploading ? 'Uploading…' : 'Add photo'}
                      </span>
                    </div>
                  )}
                  {uploading && <div style={s.avatarOverlay}>⏳</div>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                <p style={{ fontSize: '.65rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>Optional profile photo</p>
              </div>
            )}

            {/* Register extra fields */}
            {tab === 'register' && (
              <>
                <Field label="Display Name">
                  <input
                    style={s.input}
                    placeholder="Your full name or nickname"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </Field>
                <Field label="Username">
                  <div style={{ position: 'relative' }}>
                    <span style={s.atSign}>@</span>
                    <input
                      style={{ ...s.input, paddingLeft: '1.8rem' }}
                      placeholder="your_username"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    />
                  </div>
                </Field>
              </>
            )}

            <Field label="Email">
              <input
                style={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <input
                style={s.input}
                type="password"
                placeholder={tab === 'register' ? 'Min. 8 characters' : 'Password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>

            <button
              style={{ ...s.submitBtn, opacity: loading || uploading ? 0.6 : 1 }}
              onClick={handleSubmit}
              disabled={loading || uploading}
            >
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '.8rem' }}>
      <label style={{ fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '.35rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)',
    backdropFilter: 'blur(10px)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
  },
  modal: {
    background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.2)',
    borderRadius: '22px', maxWidth: '360px', width: '100%',
    padding: '2.2rem 2rem', position: 'relative',
    maxHeight: '92vh', overflowY: 'auto',
  },
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', textAlign: 'center', marginBottom: '.25rem' },
  sub: { fontSize: '.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.2rem' },
  tabs: { display: 'flex', gap: '.5rem', marginBottom: '1.2rem' },
  tabBtn: {
    flex: 1, padding: '.5rem', borderRadius: '50px',
    border: '1px solid rgba(201,168,76,.2)', background: 'transparent',
    color: 'var(--text-muted)', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', transition: 'all .25s',
  },
  tabActive: { background: 'rgba(201,168,76,.15)', borderColor: 'var(--gold)', color: 'var(--gold)' },
  errorBox: {
    fontSize: '.78rem', color: '#e07070', background: 'rgba(200,50,50,.1)',
    border: '1px solid rgba(200,50,50,.2)', borderRadius: '8px',
    padding: '.5rem .8rem', marginBottom: '.8rem', textAlign: 'center',
  },
  input: {
    width: '100%', background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(201,168,76,.15)', borderRadius: '9px',
    padding: '.65rem .9rem', color: 'var(--text)',
    fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', outline: 'none',
    boxSizing: 'border-box',
  },
  atSign: {
    position: 'absolute', left: '.75rem', top: '50%',
    transform: 'translateY(-50%)', color: 'var(--gold)',
    fontSize: '.88rem', pointerEvents: 'none',
  },
  submitBtn: {
    width: '100%', padding: '.75rem', borderRadius: '50px', border: 'none',
    background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)',
    fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', fontWeight: 500,
    cursor: 'pointer', marginTop: '.4rem', transition: 'opacity .25s',
  },
  closeBtn: {
    position: 'absolute', top: '.8rem', right: '.8rem', width: '28px', height: '28px',
    borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)',
    background: 'rgba(0,0,0,.4)', color: 'var(--text-muted)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem',
  },
  avatarWrap: {
    width: '80px', height: '80px', borderRadius: '50%',
    border: '2px dashed rgba(201,168,76,.35)', cursor: 'pointer',
    margin: '0 auto', overflow: 'hidden', position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,.03)', transition: 'border-color .25s',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  avatarOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
  },
};