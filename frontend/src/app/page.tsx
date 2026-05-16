'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/types';
import { cards as cardsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastProvider, useToast } from '@/components/Toast';
import AuthModal from '@/components/AuthModal';
import CardFormModal from '@/components/CardFormModal';
import ViewModal from '@/components/ViewModal';
import DeleteModal from '@/components/DeleteModal';
import ScheduleQueue from '@/components/ScheduleQueue';
import CardGrid from '@/components/CardGrid';

function HomeInner() {
  const { user, isAdmin, isRegistered, logout } = useAuth();
  const { showToast } = useToast();

  const [publishedCards, setPublishedCards]   = useState<Card[]>([]);
  const [scheduledCards, setScheduledCards]   = useState<Card[]>([]);
  const [loading, setLoading]                 = useState(true);

  // Modals
  const [authOpen, setAuthOpen]               = useState(false);
  const [addOpen, setAddOpen]                 = useState(false);
  const [viewCard, setViewCard]               = useState<Card | null>(null);
  const [editCard, setEditCard]               = useState<Card | null>(null);
  const [deleteCard, setDeleteCard]           = useState<Card | null>(null);
  const [authDefaultTab, setAuthDefaultTab]   = useState<'login'|'register'>('login');

  // Particles
  const particlesRef = useRef<HTMLDivElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadPublished = useCallback(async () => {
    try {
      const data = await cardsApi.list();
      setPublishedCards(data);
    } catch { showToast('Error loading verses'); }
  }, [showToast]);

  const loadScheduled = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await cardsApi.scheduledList();
      setScheduledCards(data);
    } catch { /* silent for non-admins */ }
  }, [isAdmin]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPublished(), loadScheduled()]);
    setLoading(false);
  }, [loadPublished, loadScheduled]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Scheduler ticker: auto-promote scheduled cards ─────────────────────
  useEffect(() => {
    const tick = setInterval(async () => {
      const prev = scheduledCards.length;
      await loadPublished();
      if (isAdmin) {
        const fresh = await cardsApi.scheduledList().catch(() => []);
        if (fresh.length < prev) showToast('A scheduled verse just went live ✦');
        setScheduledCards(fresh);
      }
    }, 30000);
    return () => clearInterval(tick);
  }, [scheduledCards.length, isAdmin, loadPublished, showToast]);

  // ── Particles ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const c = particlesRef.current;
    if (!c) return;
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      const size = Math.random() * 3 + 1;
      Object.assign(p.style, {
        position: 'absolute', borderRadius: '50%', background: 'var(--gold)',
        width: `${size}px`, height: `${size}px`,
        left: `${Math.random() * 100}%`,
        animation: `float-p ${Math.random() * 14 + 10}s ${Math.random() * 10}s linear infinite`,
        opacity: 0,
      });
      c.appendChild(p);
    }
  }, []);

  // ── Auth helpers ──────────────────────────────────────────────────────────
  function openLogin()    { setAuthDefaultTab('login');    setAuthOpen(true); }
  function openRegister() { setAuthDefaultTab('register'); setAuthOpen(true); }
  function handleLogout() { logout(); showToast('Logged out'); }

  // ── Refresh after mutations ───────────────────────────────────────────────
  async function refresh() {
    await loadPublished();
    if (isAdmin) await loadScheduled();
  }

  return (
    <>
      {/* Particles */}
      <div ref={particlesRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />

      {/* Auth corner */}
      <div style={s.authCorner}>
        {user && (
          <div style={s.userBadge}>
            <span style={{ ...s.rolePill, ...(isAdmin ? s.adminPill : s.userPill) }}>
              {isAdmin ? '✦ Admin' : '● Member'}
            </span>
            <span style={s.userEmail}>{user.email}</span>
          </div>
        )}
        {!user && (
          <button style={s.authBtn} onClick={openRegister}>✨ Join</button>
        )}
        {!user
          ? <button style={s.authBtn} onClick={openLogin}>🔐 Login</button>
          : <button style={s.authBtn} onClick={handleLogout}>↩ Logout</button>
        }
      </div>

      {/* Header */}
      <header style={s.header}>
        <p style={s.eyebrow}>✦ Where Stars Remember ✦</p>
        <h1 style={s.siteTitle}>Constellations<br/>of Us</h1>
        <p style={s.siteSub}>Each verse a star, each line a sky we share</p>
        <div style={s.divider} />

        {/* Role explanation */}
        <div style={s.roleHints}>
          {!user && (
            <span style={s.hint}>👁 Guests can view & react · <button style={s.hintBtn} onClick={openRegister}>Join to comment</button></span>
          )}
          {isRegistered && !isAdmin && (
            <span style={s.hint}>💬 You can comment & react on verses</span>
          )}
          {isAdmin && (
            <span style={{ ...s.hint, color: 'var(--gold)' }}>✦ Admin mode — full control</span>
          )}
        </div>
      </header>

      {/* Admin: add button */}
      {isAdmin && (
        <div style={s.addBtnWrap}>
          <button style={s.addBtn} onClick={() => setAddOpen(true)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add a New Verse
          </button>
        </div>
      )}

      <p style={s.sectionFade}>↓ Scroll to explore ↓</p>

      {/* Admin: schedule queue */}
      {isAdmin && (
        <ScheduleQueue
          scheduledCards={scheduledCards}
          onRefresh={refresh}
          toast={showToast}
        />
      )}

      {/* Loading */}
      {loading ? (
        <div style={s.loadingWrap}>
          <div style={{ fontSize: '2rem', animation: 'pulse-star 1.2s ease infinite' }}>✦</div>
          <p style={{ fontSize: '.75rem', letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '.5rem' }}>Loading constellations…</p>
        </div>
      ) : (
        <CardGrid
          cards={publishedCards}
          isAdmin={isAdmin}
          onCardClick={setViewCard}
          onEdit={setEditCard}
          onDelete={setDeleteCard}
        />
      )}

      <footer style={s.footer}>© Constellations of Us · All rights reserved</footer>

      {/* Modals */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab={authDefaultTab}
        toast={showToast}
      />
      <CardFormModal
        open={addOpen || !!editCard}
        onClose={() => { setAddOpen(false); setEditCard(null); }}
        onSaved={refresh}
        toast={showToast}
        editCard={editCard}
      />
      <ViewModal
        card={viewCard}
        onClose={() => setViewCard(null)}
        onEdit={card => { setViewCard(null); setEditCard(card); }}
        onDelete={card => { setViewCard(null); setDeleteCard(card); }}
        userRole={user?.role ?? 'guest'}
        toast={showToast}
        onAuthRequired={() => { setViewCard(null); openLogin(); }}
      />
      <DeleteModal
        card={deleteCard}
        onClose={() => setDeleteCard(null)}
        onDeleted={refresh}
        toast={showToast}
      />
    </>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeInner />
    </ToastProvider>
  );
}

const s: Record<string, React.CSSProperties> = {
  authCorner: { position: 'fixed', top: '1rem', right: '1rem', zIndex: 200, display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '300px' },
  userBadge: { display: 'flex', alignItems: 'center', gap: '.4rem', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '50px', padding: '.3rem .7rem', backdropFilter: 'blur(8px)' },
  rolePill: { fontSize: '.65rem', fontWeight: 500, padding: '.15rem .5rem', borderRadius: '50px', letterSpacing: '.05em' },
  adminPill: { background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)' },
  userPill:  { background: 'rgba(106,159,192,.25)', color: 'var(--sched)', border: '1px solid rgba(106,159,192,.3)' },
  userEmail: { fontSize: '.7rem', color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  authBtn: { display: 'flex', alignItems: 'center', gap: '.4rem', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(201,168,76,.25)', color: 'var(--text-muted)', padding: '.45rem .9rem', borderRadius: '50px', fontFamily: "'DM Sans', sans-serif", fontSize: '.78rem', cursor: 'pointer', transition: 'all .25s', backdropFilter: 'blur(8px)' },
  header: { position: 'relative', zIndex: 10, textAlign: 'center', padding: '5rem 2rem 2rem', background: 'linear-gradient(180deg,rgba(13,11,9,1) 0%,transparent 100%)' },
  eyebrow: { fontSize: '.75rem', letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1rem' },
  siteTitle: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.8rem,8vw,6rem)', fontWeight: 700, lineHeight: 1.05, background: 'linear-gradient(135deg,var(--gold-light) 0%,var(--gold) 50%,#8b6914 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  siteSub: { marginTop: '1rem', fontSize: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  divider: { width: '60px', height: '1px', background: 'var(--gold)', opacity: .4, margin: '2rem auto' },
  roleHints: { marginTop: '.5rem' },
  hint: { fontSize: '.78rem', color: 'var(--text-muted)' },
  hintBtn: { background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '.78rem', textDecoration: 'underline', padding: 0 },
  addBtnWrap: { textAlign: 'center', marginBottom: '2rem', position: 'relative', zIndex: 10 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: '.6rem', background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '.75rem 2rem', borderRadius: '50px', fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', letterSpacing: '.05em', cursor: 'pointer', transition: 'all .3s ease' },
  sectionFade: { position: 'relative', zIndex: 10, textAlign: 'center', padding: '1rem 0 2.5rem', color: 'var(--text-muted)', fontSize: '.8rem', letterSpacing: '.12em', textTransform: 'uppercase' },
  loadingWrap: { textAlign: 'center', padding: '6rem 2rem', position: 'relative', zIndex: 10 },
  footer: { textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '.75rem', letterSpacing: '.06em', position: 'relative', zIndex: 10, borderTop: '1px solid rgba(201,168,76,.07)' },
};
