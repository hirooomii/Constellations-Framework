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
import WhoToFollow from '@/components/WhoToFollow';
import StarSearch from '@/components/StarSearch';
import NotificationBell from '@/components/NotificationBell';

function HomeInner() {
  const { user, isAdmin, isRegistered, logout } = useAuth();
  const { showToast } = useToast();

  const [publishedCards, setPublishedCards] = useState<Card[]>([]);
  const [scheduledCards, setScheduledCards] = useState<Card[]>([]);
  const [loading, setLoading]               = useState(true);
  const [currentPage, setCurrentPage]       = useState(1);
  const CARDS_PER_PAGE = 9;

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
  const [feedMode, setFeedMode] = useState<'guest' | 'feed' | 'all'>('all');
  const [feedMessage, setFeedMessage] = useState('');

  // Track previous user id to detect auth changes
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const loadPublished = useCallback(async () => {
    try {
      const data = await cardsApi.list();
      if (data && typeof data === 'object' && 'cards' in data) {
        setPublishedCards((data as any).cards);
        setFeedMode((data as any).mode);
        setFeedMessage((data as any).message || '');
      } else {
        setPublishedCards(data as any);
      }
    } catch { showToast('Error loading verses'); }
  }, [showToast]);

  const loadScheduled = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await cardsApi.scheduledList();
      setScheduledCards(data);
    } catch { /* silent */ }
  }, [isAdmin]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPublished(), loadScheduled()]);
    setLoading(false);
  }, [loadPublished, loadScheduled]);

  // Initial load
  useEffect(() => { loadAll(); }, [loadAll]);

  // Refetch with shimmer when auth state changes (login/logout)
  useEffect(() => {
    const currentUserId = user?.id;
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      setCurrentPage(1);
      loadAll();
    }
  }, [user?.id, loadAll]);

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Scheduler ticker
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

  // Particles
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

  const UPLOADING_ID = '__uploading__';

  async function refresh(newCard?: Card) {
    if (newCard && newCard.scheduled_at === null) {
      const placeholder: Card = {
        ...newCard,
        id: UPLOADING_ID,
        title: newCard.title,
        image_url: newCard.image_url,
        reaction_counts: {},
        reaction_count: 0,
      };
      setPublishedCards(prev => [placeholder, ...prev]);
    }
    await loadPublished();
    if (isAdmin || isRegistered) await loadScheduled();
  }

  const canAddVerse = isAdmin || isRegistered;

  // Pagination
  const totalPages = Math.ceil(publishedCards.length / CARDS_PER_PAGE);
  const paginatedCards = publishedCards.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
  );

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {/* Particles */}
      <div ref={particlesRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />

      {/* Padding Top */}
      <style>{`
        @media (max-width: 600px) {
          header { padding-top: 7rem !important; }
        }
      `}</style>

      {/* Constellations of US Shimmer */}
    <style>{`
      @media (max-width: 600px) {
        header { padding-top: 7rem !important; }
      }
      @keyframes shimmer {
        0%   { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      @keyframes starPop {
        0%, 100% { opacity: 0; transform: scale(0); }
        50%       { opacity: 1; transform: scale(1); }
      }
      .site-title {
        background: linear-gradient(
          90deg,
          #8b6914 0%,
          #c9a84c 20%,
          #fff8e7 40%,
          #ffd700 50%,
          #fff8e7 60%,
          #c9a84c 80%,
          #8b6914 100%
        ) !important;
        background-size: 200% auto !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        animation: shimmer 3s linear infinite !important;
      }
    `}</style>
      
      {/* Responsive Auth Corner Styles */}
      <style>{`
        @media (max-width: 600px) {
          .auth-corner {
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            padding: .5rem .75rem !important;
            background: rgba(8,6,4,.85) !important;
            backdrop-filter: blur(12px) !important;
            border-bottom: 1px solid rgba(201,168,76,.1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: .5rem !important;
            z-index: 200 !important;
          }
          .auth-corner .profile-btn { order: 1 !important; flex-shrink: 0 !important; }
          .auth-corner .star-search { order: 2 !important; flex: 1 !important; }
          .auth-corner .logout-text { display: none !important; }
          .auth-corner .logout-icon { order: 3 !important; display: flex !important; flex-shrink: 0 !important; }
          .auth-corner .join-btn { display: none !important; }

          /* KEEP the name visible on mobile */
          .auth-corner .profile-name { display: flex !important; }
        }
        @media (min-width: 601px) {
          .auth-corner .logout-icon { display: none !important; }
        }
        `}</style>

     {/* Auth corner */}
      <div className="auth-corner" style={s.authCorner}>
      {user && (
        <div className="star-search">
          <StarSearch
            onProfileClick={setProfileUsername}
            toast={showToast}
          />
        </div>
      )}
     {user && (
        <NotificationBell
          userId={user.id}
          onProfileClick={setProfileUsername}
          onCardClick={(cardId) => {
            const card = publishedCards.find(c => c.id === cardId);
            if (card) setViewCard(card);
          }}
        />
      )}
      {user && (
        <button style={s.profileBtn} onClick={() => user.username && setProfileUsername(user.username)}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} style={s.avatarThumb} />
          ) : (
            <div style={s.avatarInitials}>
              {(user.display_name || user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="profile-name" style={s.profileBtnInfo}>
            <span style={{ ...s.rolePill, ...(isAdmin ? s.adminPill : s.userPill) }}>
              {isAdmin ? '✦ Admin' : '● Member'}
            </span>
            <span style={s.userDisplay}>{user.display_name || user.email}</span>
            {user.username && <span style={s.userUsername}>@{user.username}</span>}
          </div>
        </button>
      )}
      {!user && <button style={s.authBtn} onClick={openRegister}>✨ Join</button>}

      {/* Desktop logout */}
      {!user
        ? <button style={s.authBtn} className="logout-text" onClick={openLogin}>🔐 Login</button>
        : <button style={s.authBtn} className="logout-text" onClick={handleLogout}>↩ Logout</button>
      }

      {/* Mobile logout icon only */}
      {user && (
        <button className="logout-icon" style={s.iconBtn} onClick={handleLogout} title="Logout">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      )}
      {!user && (
        <button className="logout-icon" style={s.iconBtn} onClick={openLogin} title="Login">
          🔐
        </button>
      )}
    </div>

      {/* Header */}
      <header style={s.header}>
        <p style={s.eyebrow}>✦ Where Stars Remember ✦</p>
        <h1 className="site-title" style={s.siteTitle}>Constellations<br />of Us</h1>
        <p style={s.siteSub}>Each verse a star, each line a sky we share</p>
        <div style={s.divider} />
       <div style={s.roleHints}>
        {!user && (
          <span style={s.hint}>
            👁 Guests can view & react ·{' '}
            <button style={s.hintBtn} onClick={openRegister}>Join to add verses</button>
          </span>
        )}
      </div>
      </header>

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

      {feedMessage && !user && (
        <div style={s.feedBanner}>
          <span style={s.feedBannerIcon}>
            {feedMode === 'guest' ? '👁' : feedMode === 'feed' ? '✦' : '🌟'}
          </span>
          <span style={s.feedBannerText}>{feedMessage}</span>
          {feedMode === 'guest' && (
            <button style={s.feedBannerBtn} onClick={openRegister}>Join Free</button>
          )}
          {feedMode === 'all' && isRegistered && (
            <button style={s.feedBannerBtn} onClick={() => showToast('Find poets to follow!')}>
              Discover Poets
            </button>
          )}
        </div>
      )}

      {(isAdmin || isRegistered) && scheduledCards.length > 0 && (
        <ScheduleQueue
          scheduledCards={scheduledCards}
          onRefresh={refresh}
          toast={showToast}
        />
      )}

      {/* Who to Follow — only for logged in users */}
      {/* {user && !loading && (
        <WhoToFollow
          onProfileClick={setProfileUsername}
          toast={showToast}
        />
      )} */}

      {/* Loading / Grid */}
      {loading ? (
        <CardGrid
          cards={[]}
          isAdmin={false}
          currentUserId={undefined}
          onCardClick={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          loading={true}
        />
      ) : (
        <>
          <CardGrid
            cards={paginatedCards}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            onCardClick={setViewCard}
            onEdit={setEditCard}
            onDelete={setDeleteCard}
            onAuthorClick={setProfileUsername}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={s.pagination}>
              <button
                style={{ ...s.pageBtn, ...(currentPage === 1 ? s.pageBtnDisabled : {}) }}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  style={{ ...s.pageBtn, ...(currentPage === page ? s.pageBtnActive : {}) }}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}

              <button
                style={{ ...s.pageBtn, ...(currentPage === totalPages ? s.pageBtnDisabled : {}) }}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
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
        onEditProfile={() => {}}
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
  feedBanner: { position: 'relative', zIndex: 10, maxWidth: '1300px', margin: '0 auto 1.5rem', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '.5rem' },
  feedBannerText: { fontSize: '.78rem', color: 'var(--text-muted)' },
  feedBannerIcon: { fontSize: '.9rem' },
  feedBannerBtn: { fontSize: '.72rem', padding: '.25rem .75rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  authCorner: { position: 'fixed', top: '1rem', right: '1rem', zIndex: 200, display: 'flex', alignItems: 'center', gap: '.5rem' },
  iconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.15)', color: 'var(--text-muted)', cursor: 'pointer', backdropFilter: 'blur(8px)', flexShrink: 0 },
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
  siteTitle: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.8rem,8vw,6rem)', fontWeight: 700, lineHeight: 1.05 },
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
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', padding: '2rem 1.5rem 4rem', position: 'relative', zIndex: 10, flexWrap: 'wrap' },
  pageBtn: { padding: '.4rem .9rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  pageBtnActive: { background: 'rgba(201,168,76,.15)', borderColor: 'rgba(201,168,76,.4)', color: 'var(--gold)' },
  pageBtnDisabled: { opacity: .35, cursor: 'not-allowed' },
};