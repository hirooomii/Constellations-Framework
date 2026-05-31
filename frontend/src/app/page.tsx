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
import ProfileModal from '@/components/ProfileModal';

function HomeInner() {
  const { user, isAdmin, isRegistered, logout } = useAuth();
  const { showToast } = useToast();

  const [publishedCards, setPublishedCards] = useState<Card[]>([]);
  const [scheduledCards, setScheduledCards] = useState<Card[]>([]);
  const [loading, setLoading]               = useState(true);

  // Modals
  const [authOpen, setAuthOpen]           = useState(false);
  const [addOpen, setAddOpen]             = useState(false);
  const [viewCard, setViewCard]           = useState<Card | null>(null);
  const [editCard, setEditCard]           = useState<Card | null>(null);
  const [deleteCard, setDeleteCard]       = useState<Card | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'register'>('login');

  // Particles
  const particlesRef = useRef<HTMLDivElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadPublished = useCallback(async () => {
    try {
      const data = await cardsApi.list();
      setPublishedCards(data);
    } catch { showToast('Error loading verses'); }
  }, [showToast]);

  const loadScheduled = useCallback(async () => {
    if (!isAdmin && !isRegistered) return;
    try {
      const data = await cardsApi.scheduledList();
      setScheduledCards(data);
    } catch { /* silent */ }
  }, [isAdmin, isRegistered]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPublished(), loadScheduled()]);
    setLoading(false);
  }, [loadPublished, loadScheduled]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
  if (window.location.hash.includes('access_token')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}, []);

  // ── Scheduler ticker ───────────────────────────────────────────────────────
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

  // ── Particles ──────────────────────────────────────────────────────────────
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

  // ── Auth helpers ───────────────────────────────────────────────────────────
  function openLogin()    { setAuthDefaultTab('login');    setAuthOpen(true); }
  function openRegister() { setAuthDefaultTab('register'); setAuthOpen(true); }
  function handleLogout() { logout(); showToast('Logged out'); }

  // ── Refresh ────────────────────────────────────────────────────────────────
  async function refresh() {
    await loadPublished();
    if (isAdmin || isRegistered) await loadScheduled();
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const canAddVerse = isAdmin || isRegistered;

  return (
    <>
      {/* Particles */}
      <div ref={particlesRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />

      {/* Auth corner */}
      <div style={s.authCorner}>
        {user && (
          <button style={s.profileBtn} onClick={() => user.username && setProfileUsername(user.username)}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} style={s.avatarThumb} />
            ) : (
              <div style={s.avatarInitials}>
                {(user.display_name || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div style={s.profileBtnInfo}>
              <span style={{ ...s.rolePill, ...(isAdmin ? s.adminPill : s.userPill) }}>
                {isAdmin ? '✦ Admin' : '● Member'}
              </span>
              <span style={s.userDisplay}>
                {user.display_name || user.email}
              </span>
              {user.username && (
                <span style={s.userUsername}>@{user.username}</span>
              )}
            </div>
          </button>
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
        <h1 style={s.siteTitle}>Constellations<br />of Us</h1>
        <p style={s.siteSub}>Each verse a star, each line a sky we share</p>
        <div style={s.divider} />

        {/* Role hints */}
        <div style={s.roleHints}>
          {!user && (
            <span style={s.hint}>
              👁 Guests can view & react ·{' '}
              <button style={s.hintBtn} onClick={openRegister}>Join to add verses</button>
            </span>
          )}
          {isRegistered && !isAdmin && (
            <span style={s.hint}>✦ You can add verses, react & comment</span>
          )}
          {isAdmin && (
            <span style={{ ...s.hint, color: 'var(--gold)' }}>✦ Admin mode — full control</span>
          )}
        </div>
      </header>

      {/* Add verse button (admin + registered) */}
      {canAddVerse && (
        <div style={s.addBtnWrap}>
          <button style={s.addBtn} onClick={() => setAddOpen(true)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add a New Verse
          </button>
        </div>
      )}

      <p style={s.sectionFade}>↓ Scroll to explore ↓</p>

      {/* Schedule queue (admin + registered users see their own) */}
      {(isAdmin || isRegistered) && scheduledCards.length > 0 && (
        <ScheduleQueue
          scheduledCards={scheduledCards}
          onRefresh={refresh}
          toast={showToast}
        />
      )}

      {/* Loading / Grid */}
      {loading ? (
        <div style={s.loadingWrap}>
          <div style={{ fontSize: '2rem', animation: 'pulse-star 1.2s ease infinite' }}>✦</div>
          <p style={{ fontSize: '.75rem', letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '.5rem' }}>
            Loading constellations…
          </p>
        </div>
      ) : (
        <CardGrid
          cards={publishedCards}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          onCardClick={setViewCard}
          onEdit={setEditCard}
          onDelete={setDeleteCard}
          onAuthorClick={setProfileUsername}
        />
      )}

      <footer style={s.footer}>© Constellations of Us · All rights reserved</footer>

      {/* ── Modals ── */}
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
        user={user}
        toast={showToast}
        onAuthRequired={() => { setViewCard(null); openLogin(); }}
        onProfileClick={username => { setViewCard(null); setProfileUsername(username); }}
      />

      <DeleteModal
        card={deleteCard}
        onClose={() => setDeleteCard(null)}
        onDeleted={refresh}
        toast={showToast}
      />

      <ProfileModal
        username={profileUsername}
        onClose={() => setProfileUsername(null)}
        currentUser={user}
        toast={showToast}
        onCardClick={card => { setProfileUsername(null); setViewCard(card); }}
        onEditProfile={() => { /* optional: open edit profile modal */ }}
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
  authCorner: { position: 'fixed', top: '1rem', right: '1rem', zIndex: 200, display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '320px' },
  profileBtn: { display: 'flex', alignItems: 'center', gap: '.5rem', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '50px', padding: '.3rem .7rem .3rem .3rem', backdropFilter: 'blur(8px)', cursor: 'pointer', textAlign: 'left' },
  avatarThumb: { width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarInitials: { width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 },
  profileBtnInfo: { display: 'flex', flexDirection: 'column', gap: '.1rem' },
  rolePill: { fontSize: '.6rem', fontWeight: 500, padding: '.1rem .4rem', borderRadius: '50px', letterSpacing: '.05em', display: 'inline-block' },
  adminPill: { background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)' },
  userPill: { background: 'rgba(106,159,192,.25)', color: 'var(--sched)', border: '1px solid rgba(106,159,192,.3)' },
  userDisplay: { fontSize: '.72rem', color: 'var(--text)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userUsername: { fontSize: '.65rem', color: 'var(--text-muted)' },
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