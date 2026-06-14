'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { notifications as notificationsApi } from '@/lib/api';

interface Notification {
  id: string;
  type: 'follow' | 'react' | 'comment' | 'new_verse';
  message: string;
  is_read: boolean;
  created_at: string;
  card_id?: string;
  actor_id?: string;
  actor?: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface NotificationBellProps {
  onProfileClick?: (username: string) => void;
  onCardClick?: (cardId: string) => void;
  userId?: string;  
}

const bellStyle = `
@keyframes bellRing {
  0%,100% { transform: rotate(0); }
  20%      { transform: rotate(-15deg); }
  40%      { transform: rotate(15deg); }
  60%      { transform: rotate(-10deg); }
  80%      { transform: rotate(10deg); }
}
@keyframes notifIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes badgePop {
  0%   { transform: scale(0); }
  70%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
.nb-bell-ring { animation: bellRing .6s ease; }
.nb-dropdown  { animation: notifIn .18s ease forwards; }
.nb-row:hover { background: rgba(201,168,76,.06) !important; }
.nb-badge     { animation: badgePop .3s ease forwards; }
`;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function typeIcon(type: string): string {
  switch (type) {
    case 'follow':    return '✦';
    case 'react':     return '💫';
    case 'comment':   return '💬';
    case 'new_verse': return '📜';
    default:          return '🔔';
  }
}

export default function NotificationBell({ onProfileClick, onCardClick, userId }: NotificationBellProps) {
  const [open, setOpen]                   = useState(false);
  const [notifs, setNotifs]               = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const [showArchive, setShowArchive]     = useState(false);
  const [archive, setArchive]             = useState<Notification[]>([]);
  const [ringing, setRinging]             = useState(false);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      if (!data) return;
      setNotifs(data.notifications);
      if (data.unread_count > prevCount.current && prevCount.current >= 0) {
        setRinging(true);
        setTimeout(() => setRinging(false), 700);
      }
      prevCount.current = data.unread_count;
      setUnreadCount(data.unread_count);
    } catch {}
  }, []);

// Initial fetch + polling every 30s
useEffect(() => {
  if (!userId) return;  // ← add this guard
  fetchNotifications();
  const interval = setInterval(fetchNotifications, 30000);
  return () => clearInterval(interval);
}, [fetchNotifications, userId]);  // ← add userId to depsfetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowArchive(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    const isOpening = !open;
    setOpen(isOpening);
    if (isOpening && unreadCount > 0) {
      await notificationsApi.readAll();
      setUnreadCount(0);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      prevCount.current = 0;
    }
  }

  async function loadArchive() {
    setShowArchive(true);
    if (archive.length > 0) return;
    setLoading(true);
    try {
      const data = await notificationsApi.archive();
      if (data) setArchive(data.notifications);
    } catch {}
    setLoading(false);
  }

  function handleNotifClick(notif: Notification) {
    if (notif.card_id && onCardClick) {
      onCardClick(notif.card_id);
      setOpen(false);
    } else if (notif.actor?.username && onProfileClick) {
      onProfileClick(notif.actor.username);
      setOpen(false);
    }
  }

  const displayList = showArchive ? archive : notifs;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <style>{bellStyle}</style>

      {/* Bell button */}
      <button
        className={ringing ? 'nb-bell-ring' : ''}
        style={s.bellBtn}
        onClick={handleOpen}
        title="Notifications"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="nb-badge" style={s.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="nb-dropdown" style={s.dropdown}>
          <div style={s.header}>
            <span style={s.headerTitle}>🔔 Notifications</span>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button
                style={{ ...s.tabBtn, ...(showArchive ? {} : s.tabBtnActive) }}
                onClick={() => setShowArchive(false)}
              >
                Recent
              </button>
              <button
                style={{ ...s.tabBtn, ...(showArchive ? s.tabBtnActive : {}) }}
                onClick={loadArchive}
              >
                Archive
              </button>
            </div>
          </div>

          <div style={s.list}>
            {loading ? (
              <p style={s.empty}>Loading…</p>
            ) : displayList.length === 0 ? (
              <p style={s.empty}>
                {showArchive ? 'No archived notifications.' : "You're all caught up ✦"}
              </p>
            ) : (
              displayList.map(notif => (
                <div
                  key={notif.id}
                  className="nb-row"
                  style={{
                    ...s.row,
                    background: notif.is_read ? 'transparent' : 'rgba(201,168,76,.05)',
                    borderLeft: notif.is_read ? '2px solid transparent' : '2px solid rgba(201,168,76,.4)',
                  }}
                  onClick={() => handleNotifClick(notif)}
                >
                  <div style={s.iconWrap}>
                    <span style={s.typeIcon}>{typeIcon(notif.type)}</span>
                  </div>
                  <div style={s.content}>
                    <p style={s.message}>{notif.message}</p>
                    <span style={s.time}>{timeAgo(notif.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bellBtn:      { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.15)', color: 'var(--text-muted)', cursor: 'pointer', backdropFilter: 'blur(8px)', flexShrink: 0, transition: 'all .25s' },
  badge:        { position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', borderRadius: '50px', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', fontSize: '.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid rgba(8,6,4,1)' },
  dropdown:     { position: 'fixed', top: '4rem', right: '1rem', width: '340px', background: 'rgba(13,11,9,.97)', border: '1px solid rgba(201,168,76,.18)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,.8)', zIndex: 300, overflow: 'hidden', backdropFilter: 'blur(20px)' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 1rem .6rem', borderBottom: '1px solid rgba(201,168,76,.1)' },
  headerTitle:  { fontSize: '.78rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '.03em' },
  tabBtn:       { fontSize: '.65rem', padding: '.2rem .6rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  tabBtnActive: { borderColor: 'rgba(201,168,76,.4)', color: 'var(--gold)', background: 'rgba(201,168,76,.08)' },
  list:         { maxHeight: '380px', overflowY: 'auto', padding: '.4rem .5rem .75rem' },
  row:          { display: 'flex', alignItems: 'flex-start', gap: '.65rem', padding: '.6rem .5rem', borderRadius: '10px', cursor: 'pointer', transition: 'all .2s', marginBottom: '.2rem' },
  iconWrap:     { width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeIcon:     { fontSize: '.75rem' },
  content:      { flex: 1, minWidth: 0 },
  message:      { fontSize: '.76rem', color: 'var(--text)', lineHeight: 1.4, margin: 0 },
  time:         { fontSize: '.62rem', color: 'var(--text-muted)', marginTop: '.2rem', display: 'block' },
  empty:        { textAlign: 'center', color: 'var(--text-muted)', fontSize: '.75rem', padding: '2rem 0', fontStyle: 'italic' },
};