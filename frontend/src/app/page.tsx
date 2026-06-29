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
import StarSearch from '@/components/StarSearch';
import NotificationBell from '@/components/NotificationBell';
import MessagesPanel from '@/components/MessagesPanel';
import { auth as authApi, messages as messagesApi } from '@/lib/api';
import { signInWithProvider, extractOAuthTokens } from '@/lib/supabase';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function HomeInner() {
  const { user, isAdmin, isRegistered, logout, oauthLogin, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  usePushNotifications(user);

  const [publishedCards, setPublishedCards] = useState<Card[]>([]);
  const [scheduledCards, setScheduledCards] = useState<Card[]>([]);
  const [loading, setLoading]               = useState(false);
  const [currentPage, setCurrentPage]       = useState(1);
  const CARDS_PER_PAGE = 9;

  const [authOpen, setAuthOpen]                 = useState(false);
  const [addOpen, setAddOpen]                   = useState(false);
  const [viewCard, setViewCard]                 = useState<Card | null>(null);
  const [editCard, setEditCard]                 = useState<Card | null>(null);
  const [deleteCard, setDeleteCard]             = useState<Card | null>(null);
  const [profileUsername, setProfileUsername]   = useState<string | null>(null);
  const [authDefaultTab, setAuthDefaultTab]     = useState<'login' | 'register'>('login');
  const [msgOpen, setMsgOpen]                   = useState(false);
  const [msgUnread, setMsgUnread]               = useState(0);
  const [msgInitialUserId, setMsgInitialUserId] = useState<string | null>(null);

  const particlesRef  = useRef<HTMLDivElement>(null);
  const prevUserIdRef = useRef<string | undefined>(undefined);
  const [feedMode, setFeedMode] = useState<string>('all');

  const loadPublished = useCallback(async () => {
    try {
      const data = await cardsApi.list();
      if (data && typeof data === 'object' && 'cards' in data) {
        setPublishedCards((data as any).cards);
        setFeedMode((data as any).mode ?? 'all'); // ← add this
      } else {
        setPublishedCards(data as any);
      }
    } catch { showToast('Error loading verses'); }
  }, [showToast]);

  const loadScheduled = useCallback(async () => {
    if (!isAdmin && !isRegistered) return;
    try {
      const cards = isAdmin
        ? await cardsApi.scheduledList()
        : await cardsApi.myScheduled();
      setScheduledCards(cards);
    } catch { /* silent */ }
  }, [isAdmin, isRegistered]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPublished(), loadScheduled()]);
    setLoading(false);
  }, [loadPublished, loadScheduled]);

  const [oauthLoading, setOauthLoading] = useState(() => {
  // Check synchronously on first render if there's an OAuth token in the URL
  if (typeof window !== 'undefined') {
    return window.location.hash.includes('access_token');
  }
  return false;
});

  // Load feed on login / logout
  useEffect(() => {
    const uid = user?.id;
    if (prevUserIdRef.current === uid) return;
    prevUserIdRef.current = uid;
    setCurrentPage(1);
    if (uid) loadAll();
    else { setPublishedCards([]); setScheduledCards([]); }
  }, [user?.id, loadAll]);

  // Scheduler live-publish ticker (logged-in only)
  useEffect(() => {
    if (!user) return;
    const tick = setInterval(async () => {
      const prev = scheduledCards.length;
      await loadPublished();
      if (isAdmin || isRegistered) {
        const fresh = isAdmin
          ? await cardsApi.scheduledList().catch(() => [])
          : await cardsApi.myScheduled().catch(() => []);
        if (fresh.length < prev) showToast('A scheduled verse just went live ✦');
        setScheduledCards(fresh);
      }
    }, 30000);
    return () => clearInterval(tick);
  }, [user, scheduledCards.length, isAdmin, isRegistered, loadPublished, showToast]);

  // Handle OAuth redirect callback (Facebook / GitHub)
  useEffect(() => {
    const tokens = extractOAuthTokens();
    if (!tokens) return;

    setOauthLoading(true); // show loading spinner
    window.history.replaceState(null, '', window.location.pathname);

    authApi.oauthSync(tokens.access_token, tokens.refresh_token)
      .then(session => oauthLogin(session))
      .catch(() => showToast('Social login failed. Please try again.'))
      .finally(() => setOauthLoading(false));
  }, []);

  // Poll unread messages
  useEffect(() => {
    if (!user) { setMsgUnread(0); return; }
    const poll = async () => {
      try { setMsgUnread((await messagesApi.unreadCount())?.unread_count ?? 0); }
      catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [user]);

  // Particles — runs once, particles div is always in the DOM
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

  function openLogin()    { setAuthDefaultTab('login');    setAuthOpen(true); }
  function openRegister() { setAuthDefaultTab('register'); setAuthOpen(true); }
  function handleLogout() { logout(); showToast('Logged out'); }

  async function handleSocialLogin(provider: 'facebook' | 'github' | 'google' | 'discord') {
    try { await signInWithProvider(provider); }
    catch { showToast(`Could not connect to ${provider}. Try again.`); }
  }
  function handleSocialComingSoon(name: string) {
    showToast(`${name} login is under development ✦`);
  }

  async function refresh(newCard?: Card) {
    if (newCard && newCard.scheduled_at === null) {
      setPublishedCards(prev => [{
        ...newCard, id: '__uploading__', reaction_counts: {}, reaction_count: 0,
      }, ...prev]);
    }
    await loadPublished();
    if (isAdmin || isRegistered) await loadScheduled();
  }

  async function handleScheduledLive() {
    setPublishedCards(prev => [{ id: '__live_shimmer__', title: '', poem: '' } as Card, ...prev]);
    await Promise.all([
      loadPublished(),
      new Promise<void>(resolve => setTimeout(resolve, 2000)),
    ]);
    await loadScheduled();
  }

  const canAddVerse = isAdmin || isRegistered;
  const totalPages  = Math.ceil(publishedCards.length / CARDS_PER_PAGE);
  const paginatedCards = publishedCards.slice(
    (currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE
  );

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <style>{sharedStyles}</style>

      {/* Particles — always in DOM so the useEffect ref works */}
      <div ref={particlesRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />

      {/* ═══ Loading (session restoring) ═══ */}
      {authLoading || oauthLoading && (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
          <img src="/icon.png" alt="Celestia" style={{ width: '64px', height: '64px', borderRadius: '14px', opacity: .7, filter: 'drop-shadow(0 0 14px rgba(201,168,76,.5))' }} />
        </div>
      )}

      {/* ═══ Landing page (not logged in) ═══ */}
      {!authLoading && !oauthLoading && !user && (
        <div style={s.landingWrap}>
          <div style={s.landingBrand}>
            <img src="/icon.png" alt="Celestia" style={s.landingLogo} />
            <p style={s.eyebrow}>✦ Where Stars Remember ✦</p>
            <h1 className="site-title" style={s.siteTitle}>Celestia</h1>
            <p style={s.siteSub}>A celestial space where every verse becomes a star</p>
          </div>

          <div style={s.landingCard}>
            <p style={s.landingCardTitle}>Join the constellation</p>
            <p style={s.landingCardSub}>Connect with poets, share your verses, and discover a universe of words.</p>

            <button className="land-join-btn" style={s.landingJoinBtn} onClick={openRegister}>
              ✨ Create a Free Account
            </button>
            <button className="land-login-btn" style={{ ...s.landingLoginBtn, marginTop: '.6rem' }} onClick={openLogin}>
              🔐 Log in
            </button>

            <div style={s.landingOr}>
              <span style={s.landingOrLine} />
              <span style={s.landingOrText}>or continue with</span>
              <span style={s.landingOrLine} />
            </div>

            {/* Social login — icon only, linear row */}
            <div style={s.socialRow}>
              <button type="button" className="social-btn" style={s.socialIconBtn} title="Continue with Facebook" onClick={() => handleSocialLogin('facebook')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#c9a84c"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
              <button type="button" className="social-btn" style={s.socialIconBtn} title="Continue with GitHub" onClick={() => handleSocialLogin('github')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#c9a84c"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </button>
              <button type="button" className="social-btn" style={s.socialIconBtn} title="Continue with Google" onClick={() => handleSocialLogin('google')}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#c9a84c" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#c9a84c" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#c9a84c" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#c9a84c" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              </button>
              <button 
                type="button" 
                className="social-btn" 
                style={s.socialIconBtn} 
                title="Continue with Discord" 
                onClick={() => handleSocialLogin('discord')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#c9a84c">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.033.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </button>
              <button type="button" className="social-soon" style={{ ...s.socialIconBtn, ...s.socialBtnSoon }} title="Apple — Coming Soon" onClick={() => handleSocialComingSoon('Apple')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#c9a84c"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <span style={s.soonBadge}>Soon</span>
              </button>
            </div>
          </div>

          <p style={s.landingFooter}>© Celestia · All rights reserved</p>

          <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authDefaultTab} toast={showToast} />
        </div>
      )}

      {/* ═══ Feed (logged in) ═══ */}
      {!authLoading  && !oauthLoading && user && (
        <>
          {/* Top Navbar */}
          <nav style={s.navbar}>
            <div style={s.navLeft}>
              <img src="/icon.png" alt="" style={s.navLogo} />
              <span className="site-title nav-name" style={s.navBrand}>Celestia</span>
            </div>
            <div className="nav-search" style={s.navCenter}>
              <StarSearch onProfileClick={setProfileUsername} toast={showToast} />
            </div>
            <div style={s.navRight}>
              <NotificationBell
                userId={user.id}
                onProfileClick={setProfileUsername}
                onCardClick={cardId => {
                  const card = publishedCards.find(c => c.id === cardId);
                  if (card) setViewCard(card);
                }}
              />
              <button style={s.iconBtn} onClick={() => setMsgOpen(true)} title="Messages">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {msgUnread > 0 && <span style={s.msgBadge}>{msgUnread > 9 ? '9+' : msgUnread}</span>}
              </button>
              <button style={s.profileBtn} onClick={() => user.username && setProfileUsername(user.username)}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.display_name} style={s.avatarThumb} />
                  : <div style={s.avatarInitials}>{(user.display_name || user.email).charAt(0).toUpperCase()}</div>
                }
                <div className="nav-profile-info" style={s.profileBtnInfo}>
                  <span style={{ ...s.rolePill, ...(isAdmin ? s.adminPill : s.userPill) }}>
                    {isAdmin ? '✦ Admin' : '● Member'}
                  </span>
                  <span style={s.userDisplay}>{user.display_name || user.email}</span>
                  {user.username && <span style={s.userUsername}>@{user.username}</span>}
                </div>
              </button>
              <button style={s.iconBtn} onClick={handleLogout} title="Logout">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </nav>

          {/* Feed content */}
          <main style={s.feedMain}>
            {canAddVerse && (
              <div style={s.addBtnWrap}>
                <button style={s.addBtn} onClick={() => setAddOpen(true)}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add a New Verse
                </button>
              </div>
            )}

            {(isAdmin || isRegistered) && scheduledCards.length > 0 && (
              <ScheduleQueue scheduledCards={scheduledCards} onRefresh={refresh} onScheduledLive={handleScheduledLive} toast={showToast} />
            )}

            {loading ? (
              <CardGrid cards={[]} isAdmin={false} currentUserId={undefined}
                onCardClick={() => {}} onEdit={() => {}} onDelete={() => {}} loading={true} />
            ) : (
              <>
                <CardGrid
                  cards={paginatedCards}
                  isAdmin={isAdmin}
                  currentUserId={user.id}
                  feedMode={feedMode}   
                  onCardClick={setViewCard}
                  onEdit={setEditCard}
                  onDelete={setDeleteCard}
                  onAuthorClick={setProfileUsername}
                />
                {totalPages > 1 && (
                  <div style={s.pagination}>
                    <button style={{ ...s.pageBtn, ...(currentPage === 1 ? s.pageBtnDisabled : {}) }}
                      onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>← Prev</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button key={page}
                        style={{ ...s.pageBtn, ...(currentPage === page ? s.pageBtnActive : {}) }}
                        onClick={() => handlePageChange(page)}>{page}</button>
                    ))}
                    <button style={{ ...s.pageBtn, ...(currentPage === totalPages ? s.pageBtnDisabled : {}) }}
                      onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next →</button>
                  </div>
                )}
              </>
            )}
          </main>

          <footer style={s.footer}>© Celestia · All rights reserved</footer>

          {/* Modals */}
          <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authDefaultTab} toast={showToast} />
          <CardFormModal
            open={addOpen || !!editCard}
            onClose={() => { setAddOpen(false); setEditCard(null); }}
            onSaved={refresh} toast={showToast} editCard={editCard}
          />
          <ViewModal
            card={viewCard} onClose={() => setViewCard(null)}
            onEdit={card => { setViewCard(null); setEditCard(card); }}
            onDelete={card => { setViewCard(null); setDeleteCard(card); }}
            user={user} toast={showToast}
            onAuthRequired={() => { setViewCard(null); openLogin(); }}
            onProfileClick={username => { setViewCard(null); setProfileUsername(username); }}
          />
          <DeleteModal card={deleteCard} onClose={() => setDeleteCard(null)} onDeleted={refresh} toast={showToast} />
          <ProfileModal
            username={profileUsername} onClose={() => setProfileUsername(null)}
            currentUser={user} toast={showToast}
            onCardClick={card => { setProfileUsername(null); setViewCard(card); }}
            onEditProfile={() => {}}
            onMessageUser={userId => { setMsgInitialUserId(userId); setProfileUsername(null); setMsgOpen(true); }}
          />
          <MessagesPanel
            user={user} open={msgOpen}
            onClose={() => { setMsgOpen(false); setMsgInitialUserId(null); }}
            toast={showToast} initialUserId={msgInitialUserId}
            onInitialUserHandled={() => setMsgInitialUserId(null)}
          />
        </>
      )}
    </>
  );
}

export default function Home() {
  return <ToastProvider><HomeInner /></ToastProvider>;
}

// ── Shared CSS ──────────────────────────────────────────────────────────────
const sharedStyles = `
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
.site-title {
  background: linear-gradient(90deg,#8b6914 0%,#c9a84c 20%,#fff8e7 40%,#ffd700 50%,#fff8e7 60%,#c9a84c 80%,#8b6914 100%) !important;
  background-size: 200% auto !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
  animation: shimmer 3s linear infinite !important;
}
/* Landing hover states */
.land-join-btn:hover  { opacity: .88 !important; transform: translateY(-1px) !important; }
.land-login-btn:hover { background: rgba(201,168,76,.08) !important; }
.social-btn:hover:not(.social-soon) { background: rgba(255,255,255,.1) !important; border-color: rgba(255,255,255,.25) !important; transform: translateY(-1px) !important; }
.social-soon { cursor: not-allowed !important; }
/* Navbar responsive */
@media (max-width: 600px) {
  .nav-name         { display: none !important; }
  .nav-profile-info { display: none !important; }
  .nav-search       { flex: 1 !important; }
}
`;

// ── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  // ── Landing ──
  landingWrap: {
    position: 'relative', zIndex: 10, minHeight: '100vh',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '2rem 1.5rem', gap: '0',
  },
  landingBrand: { textAlign: 'center', marginBottom: '2.5rem' },
  landingLogo: {
    width: '140px', height: '140px', borderRadius: '24px', marginBottom: '1.2rem',
    filter: 'drop-shadow(0 0 20px rgba(201,168,76,.55)) drop-shadow(0 0 40px rgba(139,105,20,.3))',
  },
  eyebrow: { fontSize: '.72rem', letterSpacing: '.28em', textTransform: 'uppercase' as const, color: 'var(--gold)', marginBottom: '.8rem' },
  siteTitle: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.4rem,7vw,4.5rem)', fontWeight: 700, lineHeight: 1.05, marginBottom: '.6rem' },
  siteSub: { fontSize: '.95rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  landingCard: {
    width: '100%', maxWidth: '380px',
    background: 'rgba(26,21,16,.85)', backdropFilter: 'blur(14px)',
    border: '1px solid rgba(201,168,76,.16)', borderRadius: '20px',
    padding: '2rem 1.75rem', display: 'flex', flexDirection: 'column' as const, gap: 0,
  },
  landingCardTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', textAlign: 'center' as const, marginBottom: '.4rem', fontFamily: "'Playfair Display', serif" },
  landingCardSub: { fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center' as const, lineHeight: 1.55, marginBottom: '1.5rem' },
  landingJoinBtn: {
    width: '100%', padding: '.85rem', borderRadius: '12px',
    background: 'linear-gradient(135deg,#c9a84c,#8b6914)',
    border: 'none', color: '#1a1510', fontWeight: 700, fontSize: '.95rem',
    fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
    transition: 'opacity .2s, transform .2s', letterSpacing: '.02em',
  },
  landingOr: { display: 'flex', alignItems: 'center', gap: '.75rem', margin: '1.1rem 0' },
  landingOrLine: { flex: 1, height: '1px', background: 'rgba(255,255,255,.08)' },
  landingOrText: { fontSize: '.72rem', color: 'var(--text-muted)', flexShrink: 0 },
  landingLoginBtn: {
    width: '100%', padding: '.75rem', borderRadius: '12px',
    background: 'transparent', border: '1px solid rgba(201,168,76,.28)',
    color: 'var(--gold)', fontWeight: 600, fontSize: '.9rem',
    fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', transition: 'background .2s',
  },
  landingFooter: { fontSize: '.7rem', color: 'var(--text-muted)', opacity: .5, marginTop: '2.5rem', letterSpacing: '.06em' },
  socialRow: { display: 'flex', justifyContent: 'center', gap: '.65rem', marginTop: '.25rem' },
  socialIconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.18)',
    cursor: 'pointer', transition: 'all .2s', position: 'relative',
  },
  socialBtnSoon: { cursor: 'not-allowed', opacity: .6 },
  soonBadge: {
    position: 'absolute', top: '-7px', right: '-7px',
    fontSize: '.45rem', fontWeight: 700, letterSpacing: '.04em',
    background: 'linear-gradient(135deg,#c9a84c,#8b6914)', color: '#1a1510',
    borderRadius: '4px', padding: '.1rem .28rem', pointerEvents: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },

  // ── Navbar ──
  navbar: {
    position: 'fixed', top: 0, left: 0, right: 0, height: '56px', zIndex: 200,
    background: 'rgba(13,11,9,.96)', backdropFilter: 'blur(14px)',
    borderBottom: '1px solid rgba(201,168,76,.1)',
    display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '.6rem',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 },
  navLogo: { width: '28px', height: '28px', borderRadius: '7px', filter: 'drop-shadow(0 0 6px rgba(201,168,76,.4))' },
  navBrand: { fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 700 },
  navCenter: { flex: 1, display: 'flex', justifyContent: 'center', maxWidth: '380px', margin: '0 auto' },
  navRight: { display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 },

  // ── Feed ──
  feedMain: { paddingTop: '72px', minHeight: 'calc(100vh - 56px)', position: 'relative', zIndex: 10 },
  addBtnWrap: { textAlign: 'center' as const, padding: '1.5rem 0 1rem', position: 'relative', zIndex: 10 },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: '.6rem', background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '.65rem 1.75rem', borderRadius: '50px', fontFamily: "'DM Sans', sans-serif", fontSize: '.9rem', letterSpacing: '.05em', cursor: 'pointer', transition: 'all .3s ease' },

  // ── Shared nav buttons ──
  iconBtn: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text-muted)', cursor: 'pointer', backdropFilter: 'blur(8px)', flexShrink: 0 },
  msgBadge: { position: 'absolute', top: '-3px', right: '-3px', background: 'var(--gold)', color: 'var(--dark)', fontSize: '.52rem', fontWeight: 700, borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  profileBtn: { display: 'flex', alignItems: 'center', gap: '.5rem', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '50px', padding: '.3rem .7rem .3rem .3rem', backdropFilter: 'blur(8px)', cursor: 'pointer', textAlign: 'left' as const },
  avatarThumb: { width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 },
  avatarInitials: { width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 },
  profileBtnInfo: { display: 'flex', flexDirection: 'column' as const, gap: '.1rem' },
  rolePill: { fontSize: '.6rem', fontWeight: 500, padding: '.1rem .4rem', borderRadius: '50px', letterSpacing: '.05em', display: 'inline-block' },
  adminPill: { background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)' },
  userPill: { background: 'rgba(106,159,192,.25)', color: 'var(--sched)', border: '1px solid rgba(106,159,192,.3)' },
  userDisplay: { fontSize: '.72rem', color: 'var(--text)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  userUsername: { fontSize: '.65rem', color: 'var(--text-muted)' },

  // ── Pagination / footer ──
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', padding: '2rem 1.5rem 4rem', position: 'relative', zIndex: 10, flexWrap: 'wrap' as const },
  pageBtn: { padding: '.4rem .9rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  pageBtnActive: { background: 'rgba(201,168,76,.15)', borderColor: 'rgba(201,168,76,.4)', color: 'var(--gold)' },
  pageBtnDisabled: { opacity: .35, cursor: 'not-allowed' },
  footer: { textAlign: 'center' as const, padding: '2rem', color: 'var(--text-muted)', fontSize: '.72rem', letterSpacing: '.06em', position: 'relative', zIndex: 10, borderTop: '1px solid rgba(201,168,76,.07)' },
};
