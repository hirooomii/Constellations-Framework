'use client';
import { useState, useEffect, useRef } from 'react';
import { users as usersApi, follows, SuggestedUser } from '@/lib/api';

const starSearchStyle = `
@keyframes skeletonPulse {
  0%   { opacity: .4; }
  50%  { opacity: .8; }
  100% { opacity: .4; }
}
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ss-skeleton {
  animation: skeletonPulse 1.8s ease infinite;
  background: rgba(255,255,255,.06);
  border-radius: 6px;
}
.ss-dropdown {
  animation: dropdownIn .18s ease forwards;
}
.ss-row:hover {
  background: rgba(201,168,76,.06) !important;
  border-color: rgba(201,168,76,.15) !important;
}
@media (max-width: 600px) {
  .ss-dropdown {
    right: .5rem !important;
    left: .5rem !important;
    width: auto !important;
  }
}
`;

interface StarSearchProps {
  onProfileClick: (username: string) => void;
  toast: (msg: string) => void;
}

export default function StarSearch({ onProfileClick, toast }: StarSearchProps) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<SuggestedUser[]>([]);
  const [suggested, setSuggested] = useState<SuggestedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [followed, setFollowed]   = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load suggested when opened
  useEffect(() => {
    if (!open) return;
    if (suggested.length > 0) return;
    setLoadingSugg(true);
    usersApi.suggested()
      .then(data => { if (data) setSuggested(data.users); })
      .catch(() => {})
      .finally(() => setLoadingSugg(false));
  }, [open]);

  // Search debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    timerRef.current = setTimeout(() => {
      usersApi.search(query)
        .then(data => { if (data) setResults(data.users); })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 350);
  }, [query]);

  async function handleFollow(username: string) {
    if (following.has(username)) return;
    setFollowing(prev => new Set([...Array.from(prev), username]));
    try {
      const res = await follows.toggle(username);
      if (!res) return;
      if (res.action === 'followed') {
        setFollowed(prev => new Set([...Array.from(prev), username]));
        toast(`Following @${username} ✦`);
      } else {
        setFollowed(prev => { const n = new Set(Array.from(prev)); n.delete(username); return n; });
        toast(`Unfollowed @${username}`);
      }
    } catch { toast('Failed to follow'); }
    finally {
      setFollowing(prev => { const n = new Set(Array.from(prev)); n.delete(username); return n; });
    }
  }

  function handleProfileClick(username: string) {
    setOpen(false);
    setQuery('');
    onProfileClick(username);
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg,#c9a84c,#8b6914)',
      'linear-gradient(135deg,#6a9fc0,#2e6085)',
      'linear-gradient(135deg,#9c6ab5,#5c3570)',
      'linear-gradient(135deg,#e07070,#9c2020)',
      'linear-gradient(135deg,#70b870,#2a6e2a)',
    ];
    return colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  }

  const displayUsers = query.trim() ? results : suggested;
  const isLoading    = query.trim() ? searching : loadingSugg;

  return (
    <div ref={wrapRef} style={s.wrap}>
      <style>{starSearchStyle}</style>

      {/* Inline search bar */}
      <div style={{ ...s.searchBar, ...(open ? s.searchBarOpen : {}) }}>
        <svg style={s.searchIcon} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          style={s.input}
          placeholder="Find star creators…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button style={s.clearBtn} onClick={() => { setQuery(''); inputRef.current?.focus(); }}>✕</button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="ss-dropdown" style={s.dropdown}>
          <div style={s.sectionLabel}>
            {query.trim() ? `Results for "${query}"` : '✦ Suggested Stars'}
          </div>

          <div style={s.list}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={s.skeletonRow}>
                  <div className="ss-skeleton" style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div className="ss-skeleton" style={{ width: '55%', height: '9px' }} />
                    <div className="ss-skeleton" style={{ width: '38%', height: '7px' }} />
                  </div>
                  <div className="ss-skeleton" style={{ width: '58px', height: '24px', borderRadius: '50px' }} />
                </div>
              ))
            ) : displayUsers.length === 0 ? (
              <p style={s.empty}>
                {query.trim() ? 'No stars found.' : 'No suggestions yet.'}
              </p>
            ) : (
              displayUsers.map(user => {
                const isFollowed = followed.has(user.username);
                const isLoadingF = following.has(user.username);
                return (
                  <div key={user.id} className="ss-row" style={s.row}>
                    <button style={s.avatarBtn} onClick={() => handleProfileClick(user.username)}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.display_name} style={s.avatar} />
                      ) : (
                        <div style={{ ...s.avatarFallback, background: getAvatarColor(user.display_name) }}>
                          {user.display_name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                      )}
                    </button>

                    <button style={s.infoBtn} onClick={() => handleProfileClick(user.username)}>
                      <span style={s.displayName}>{user.display_name}</span>
                      <span style={s.username}>@{user.username}</span>
                      {(user.followers_count ?? 0) > 0 && (
                        <span style={s.followers}>{user.followers_count} followers</span>
                      )}
                    </button>

                    <button
                      style={{
                        ...s.followBtn,
                        ...(isFollowed ? s.followBtnActive : {}),
                        opacity: isLoadingF ? 0.6 : 1,
                      }}
                      onClick={() => handleFollow(user.username)}
                      disabled={isLoadingF}
                    >
                      {isLoadingF ? '…' : isFollowed ? '✓' : '+ Follow'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative' },
  searchBar: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '50px', padding: '.35rem .75rem .35rem .65rem', backdropFilter: 'blur(8px)', transition: 'all .25s', width: '160px' },
  searchBarOpen: { borderColor: 'rgba(201,168,76,.35)', background: 'rgba(201,168,76,.06)', width: '200px' },
  searchIcon: { color: 'var(--text-muted)', flexShrink: 0, marginRight: '.4rem' },
  input: { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.78rem', minWidth: 0 },
  clearBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.65rem', padding: '0 0 0 .3rem', flexShrink: 0 },
  dropdown: { position: 'fixed', top: '4rem', right: '1rem', width: '320px', background: 'rgba(13,11,9,.97)', border: '1px solid rgba(201,168,76,.18)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,.8)', zIndex: 300, overflow: 'hidden', backdropFilter: 'blur(20px)' },
  sectionLabel: { fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', opacity: .7, padding: '.75rem .85rem .4rem' },
  list: { maxHeight: '360px', overflowY: 'auto', padding: '.25rem .5rem .75rem' },
  skeletonRow: { display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.55rem .4rem', borderRadius: '10px' },
  row: { display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.55rem .4rem', borderRadius: '10px', border: '1px solid transparent', transition: 'all .2s' },
  avatarBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,.2)' },
  avatarFallback: { width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 700, color: '#fff', border: '1px solid rgba(201,168,76,.2)' },
  infoBtn: { flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: '.08rem', textAlign: 'left', minWidth: 0 },
  displayName: { fontSize: '.78rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  username: { fontSize: '.65rem', color: 'var(--gold)', opacity: .7 },
  followers: { fontSize: '.6rem', color: 'var(--text-muted)' },
  followBtn: { padding: '.22rem .65rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.35)', background: 'rgba(201,168,76,.08)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.68rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .2s', flexShrink: 0 },
  followBtnActive: { background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.12)', color: 'var(--text-muted)' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '.75rem', padding: '1.5rem 0', fontStyle: 'italic' },
};