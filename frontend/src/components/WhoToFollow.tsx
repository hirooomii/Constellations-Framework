'use client';
import { useState, useEffect, useRef } from 'react';
import { users as usersApi, follows, SuggestedUser } from '@/lib/api';

const whoToFollowStyle = `
@keyframes skeletonPulse {
  0%   { opacity: .4; }
  50%  { opacity: .8; }
  100% { opacity: .4; }
}
@keyframes shimmerMove {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.wtf-skeleton {
  animation: skeletonPulse 1.8s ease infinite;
  background: rgba(255,255,255,.06);
  border-radius: 6px;
}
.wtf-shine {
  background: linear-gradient(
    105deg,
    rgba(201,168,76,0) 30%,
    rgba(201,168,76,.07) 48%,
    rgba(255,220,120,.1) 52%,
    rgba(201,168,76,0) 70%
  );
  background-size: 200% 100%;
  animation: shimmerMove 1.8s ease-in-out infinite;
}
`;

interface WhoToFollowProps {
  onProfileClick: (username: string) => void;
  toast: (msg: string) => void;
}

export default function WhoToFollow({ onProfileClick, toast }: WhoToFollowProps) {
  const [suggested, setSuggested]   = useState<SuggestedUser[]>([]);
  const [searched, setSearched]     = useState<SuggestedUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searching, setSearching]   = useState(false);
  const [query, setQuery]           = useState('');
  const [followed, setFollowed]     = useState<Set<string>>(new Set());
  const [following, setFollowing]   = useState<Set<string>>(new Set());
  const searchTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    usersApi.suggested()
      .then(data => { if (data) setSuggested(data.users); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setSearched([]); return; }

    setSearching(true);
    searchTimer.current = setTimeout(() => {
      usersApi.search(query)
        .then(data => { if (data) setSearched(data.users); })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 400);
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
    finally { setFollowing(prev => { const n = new Set(Array.from(prev)); n.delete(username); return n; }); }
  }

  const displayUsers = query.trim() ? searched : suggested;

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

  return (
    <div style={s.wrap}>
      <style>{whoToFollowStyle}</style>

      <div style={s.header}>
        <span style={s.title}>✦ Who to Follow</span>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <div style={s.searchInner}>
          <svg style={s.searchIcon} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={s.searchInput}
            placeholder="Search poets…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button style={s.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={s.list}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={s.skeletonRow}>
              <div className="wtf-skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="wtf-skeleton" style={{ width: '60%', height: '10px' }} />
                <div className="wtf-skeleton" style={{ width: '40%', height: '8px' }} />
              </div>
              <div className="wtf-skeleton" style={{ width: '60px', height: '26px', borderRadius: '50px' }} />
            </div>
          ))
        ) : searching ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={s.skeletonRow}>
              <div className="wtf-skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="wtf-skeleton" style={{ width: '55%', height: '10px' }} />
                <div className="wtf-skeleton" style={{ width: '35%', height: '8px' }} />
              </div>
              <div className="wtf-skeleton" style={{ width: '60px', height: '26px', borderRadius: '50px' }} />
            </div>
          ))
        ) : displayUsers.length === 0 ? (
          <p style={s.empty}>
            {query ? `No poets found for "${query}"` : 'No suggestions yet.'}
          </p>
        ) : (
          displayUsers.map(user => {
            const isFollowed = followed.has(user.username);
            const isLoading  = following.has(user.username);
            return (
              <div key={user.id} style={s.row}>
                {/* Avatar */}
                <button style={s.avatarBtn} onClick={() => onProfileClick(user.username)}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} style={s.avatar} />
                  ) : (
                    <div style={{ ...s.avatarFallback, background: getAvatarColor(user.display_name) }}>
                      {user.display_name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                  )}
                </button>

                {/* Info */}
                <button style={s.infoBtn} onClick={() => onProfileClick(user.username)}>
                  <span style={s.displayName}>{user.display_name}</span>
                  <span style={s.username}>@{user.username}</span>
                  {user.followers_count != null && user.followers_count > 0 && (
                    <span style={s.followers}>{user.followers_count} followers</span>
                  )}
                </button>

                {/* Follow button */}
                <button
                  style={{
                    ...s.followBtn,
                    ...(isFollowed ? s.followBtnActive : {}),
                    opacity: isLoading ? 0.6 : 1,
                  }}
                  onClick={() => handleFollow(user.username)}
                  disabled={isLoading}
                >
                  {isLoading ? '…' : isFollowed ? '✓' : '+ Follow'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', zIndex: 10, maxWidth: '1300px', margin: '0 auto 2rem', padding: '0 1.5rem' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' },
  title: { fontSize: '.68rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--gold)' },
  searchWrap: { marginBottom: '.75rem' },
  searchInner: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: '.75rem', color: 'var(--text-muted)', pointerEvents: 'none' },
  searchInput: { width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '50px', padding: '.45rem .75rem .45rem 2.2rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.8rem', outline: 'none', boxSizing: 'border-box' },
  clearBtn: { position: 'absolute', right: '.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.7rem', padding: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: '.5rem' },
  skeletonRow: { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem .9rem', background: 'rgba(255,255,255,.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,.05)' },
  row: { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem .9rem', background: 'rgba(255,255,255,.02)', borderRadius: '12px', border: '1px solid rgba(201,168,76,.07)', transition: 'border-color .2s' },
  avatarBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,.2)' },
  avatarFallback: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 700, color: '#fff', border: '1px solid rgba(201,168,76,.2)' },
  infoBtn: { flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: '.1rem', textAlign: 'left', minWidth: 0 },
  displayName: { fontSize: '.8rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  username: { fontSize: '.68rem', color: 'var(--gold)', opacity: .7 },
  followers: { fontSize: '.62rem', color: 'var(--text-muted)' },
  followBtn: { padding: '.25rem .7rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.35)', background: 'rgba(201,168,76,.08)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.7rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .2s', flexShrink: 0 },
  followBtnActive: { background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.15)', color: 'var(--text-muted)' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '.78rem', padding: '1rem 0', fontStyle: 'italic' },
};