'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, User } from '@/types';
import { messages as messagesApi, getSession } from '@/lib/api';
import { createRealtimeClient } from '@/lib/supabase';

interface MessagesPanelProps {
  user: User;
  open: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  initialUserId?: string | null;
  onInitialUserHandled?: () => void;
}

export default function MessagesPanel({
  user, open, onClose, toast, initialUserId, onInitialUserHandled,
}: MessagesPanelProps) {
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading]     = useState(false);
  const [activeConvId, setActiveConvId]     = useState<string | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<Conversation['other_user'] | null>(null);
  const [msgs, setMsgs]                     = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading]       = useState(false);
  const [msgText, setMsgText]               = useState('');
  const [sending, setSending]               = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof createRealtimeClient> | null>(null);

  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const data = await messagesApi.listConversations();
      setConversations(data?.conversations ?? []);
    } catch { /* silent */ }
    finally { setConvsLoading(false); }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    setMsgsLoading(true);
    try {
      const data = await messagesApi.getMessages(convId);
      setMsgs(data?.messages ?? []);
      await messagesApi.markRead(convId).catch(() => {});
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    } catch { /* silent */ }
    finally { setMsgsLoading(false); }
  }, []);

  // Subscribe to Supabase Realtime for the active conversation
  useEffect(() => {
    console.log('[realtime] effect fired, activeConvId =', activeConvId);

    if (!activeConvId) {
      console.log('[realtime] no activeConvId, skipping subscription');
      return;
    }

    const session = getSession();
    console.log('[realtime] session:', session);
    console.log('[realtime] access_token present?', !!session?.access_token);

    if (!session?.access_token) {
      console.log('[realtime] NO ACCESS TOKEN — bailing out, this is likely the bug');
      return;
    }

    console.log('[realtime] creating realtime client...');
    const client = createRealtimeClient(session.access_token);
    console.log('[realtime] client created:', client);
    channelRef.current = client;

    console.log('[realtime] subscribing to channel:', `msgs:${activeConvId}`);
    client
      .channel(`msgs:${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConvId}`,
      }, (payload) => {
        console.log('[realtime] 🎉 MESSAGE RECEIVED:', payload);
        const newMsg = payload.new as Message;
        setMsgs(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        setConversations(prev => prev.map(c =>
          c.id === activeConvId
            ? { ...c, last_message: newMsg, unread_count: newMsg.sender_id !== user.id ? 0 : c.unread_count }
            : c
        ));
        if (newMsg.sender_id !== user.id) {
          messagesApi.markRead(activeConvId).catch(() => {});
        }
      })
      .subscribe((status, err) => {
        console.log('[realtime] subscription status:', status);
        if (err) console.error('[realtime] subscription error:', err);
      });

    return () => {
      console.log('[realtime] cleanup — removing channels');
      client.removeAllChannels();
    };
  }, [activeConvId, user.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConvId) setTimeout(() => inputRef.current?.focus(), 80);
  }, [activeConvId]);

  // Load conversations when panel opens
  useEffect(() => {
    if (open) loadConversations();
    else { setActiveConvId(null); setActiveOtherUser(null); setMsgs([]); }
  }, [open, loadConversations]);

  // Open a specific conversation from outside (e.g., profile modal "Message" button)
  useEffect(() => {
    if (!initialUserId || !open) return;
    (async () => {
      try {
        const data = await messagesApi.openConversation(initialUserId);
        if (data?.id) {
          await loadConversations();
          const conv = await messagesApi.listConversations();
          const found = conv?.conversations?.find(c => c.id === data.id);
          if (found) { setActiveConvId(data.id); setActiveOtherUser(found.other_user); }
          await loadMessages(data.id);
        }
      } catch { toast('Could not open conversation'); }
      finally { onInitialUserHandled?.(); }
    })();
  }, [initialUserId, open]); // eslint-disable-line

  async function handleSelectConv(conv: Conversation) {
    setActiveConvId(conv.id);
    setActiveOtherUser(conv.other_user);
    await loadMessages(conv.id);
  }

  async function handleSend() {
    if (!msgText.trim() || !activeConvId || sending) return;
    const text = msgText.trim();
    setSending(true);
    setMsgText('');
    try {
      await messagesApi.send(activeConvId, text);
      // message appears via Realtime subscription
    } catch { toast('Failed to send'); setMsgText(text); }
    finally { setSending(false); }
  }

  function getInitial(name: string) { return (name || '?').charAt(0).toUpperCase(); }
  function getColor(name: string) {
    const colors = ['linear-gradient(135deg,#c9a84c,#8b6914)', 'linear-gradient(135deg,#6a9fc0,#2e6085)',
      'linear-gradient(135deg,#9c6ab5,#5c3570)', 'linear-gradient(135deg,#e07070,#9c2020)', 'linear-gradient(135deg,#70b870,#2a6e2a)'];
    return colors[(name || '?').charCodeAt(0) % colors.length];
  }
  function fmtTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (!open) return null;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>

        {/* ── Conversation List ── */}
        <div style={{ ...s.sidebar, ...(activeConvId ? s.sidebarHidden : {}) }}>
          <div style={s.sidebarHeader}>
            <span style={s.sidebarTitle}>✦ Messages {totalUnread > 0 && <span style={s.unreadBadge}>{totalUnread}</span>}</span>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={s.convList}>
            {convsLoading && <p style={s.empty}>Loading…</p>}
            {!convsLoading && conversations.length === 0 && (
              <p style={s.empty}>No conversations yet. Start one from a user profile.</p>
            )}
            {conversations.map(conv => (
              <button key={conv.id} style={{ ...s.convItem, ...(conv.id === activeConvId ? s.convItemActive : {}) }} onClick={() => handleSelectConv(conv)}>
                <div style={{ ...s.avatar, background: conv.other_user.avatar_url ? 'transparent' : getColor(conv.other_user.display_name || '?'), position: 'relative' }}>
                  {conv.other_user.avatar_url
                    ? <img src={conv.other_user.avatar_url} alt="" style={s.avatarImg} />
                    : getInitial(conv.other_user.display_name || conv.other_user.username || '?')
                  }
                  {conv.unread_count > 0 && <span style={s.convUnread}>{conv.unread_count}</span>}
                </div>
                <div style={s.convInfo}>
                  <div style={s.convName}>{conv.other_user.display_name || conv.other_user.username || 'Unknown'}</div>
                  {conv.last_message && (
                    <div style={s.convPreview}>
                      {conv.last_message.sender_id === user.id ? 'You: ' : ''}
                      {conv.last_message.body.length > 38 ? conv.last_message.body.slice(0, 38) + '…' : conv.last_message.body}
                    </div>
                  )}
                </div>
                {conv.last_message && (
                  <span style={s.convTime}>{fmtTime(conv.last_message.created_at)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Message Thread ── */}
        <div style={{ ...s.thread, ...(activeConvId ? {} : s.threadHidden) }}>
          {activeConvId ? (
            <>
              <div style={s.threadHeader}>
                <button style={s.backBtn} onClick={() => { setActiveConvId(null); setActiveOtherUser(null); setMsgs([]); }}>
                  ← Back
                </button>
                <div style={{ ...s.avatar, width: '30px', height: '30px', fontSize: '.7rem', background: activeOtherUser?.avatar_url ? 'transparent' : getColor(activeOtherUser?.display_name || '?') }}>
                  {activeOtherUser?.avatar_url
                    ? <img src={activeOtherUser.avatar_url} alt="" style={s.avatarImg} />
                    : getInitial(activeOtherUser?.display_name || activeOtherUser?.username || '?')
                  }
                </div>
                <span style={s.threadName}>{activeOtherUser?.display_name || activeOtherUser?.username}</span>
                <button style={s.closeBtn} onClick={onClose}>✕</button>
              </div>

              <div style={s.msgList}>
                {msgsLoading && <p style={s.empty}>Loading…</p>}
                {!msgsLoading && msgs.length === 0 && (
                  <p style={s.empty}>No messages yet. Say hello! 👋</p>
                )}
                {msgs.map((m, i) => {
                  const isMine = m.sender_id === user.id;
                  const prev   = msgs[i - 1];
                  const showDay = !prev || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString();
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div style={s.dayDivider}>
                          {new Date(m.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      <div style={{ ...s.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                        {!isMine && (
                          <div style={{ ...s.avatar, width: '26px', height: '26px', fontSize: '.6rem', flexShrink: 0, background: m.sender_avatar ? 'transparent' : getColor(m.sender_name) }}>
                            {m.sender_avatar
                              ? <img src={m.sender_avatar} alt="" style={s.avatarImg} />
                              : getInitial(m.sender_name)
                            }
                          </div>
                        )}
                        <div style={{ maxWidth: '68%' }}>
                          <div style={{ ...s.bubble, ...(isMine ? s.bubbleMine : s.bubbleThem) }}>
                            {m.body}
                          </div>
                          <div style={{ ...s.msgTime, textAlign: isMine ? 'right' : 'left' }}>
                            {fmtTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div style={s.inputRow}>
                <input
                  ref={inputRef}
                  style={s.input}
                  placeholder="Type a message…"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  maxLength={1000}
                />
                <button style={s.sendBtn} onClick={handleSend} disabled={sending || !msgText.trim()}>
                  {sending ? '…' : '➤'}
                </button>
              </div>
            </>
          ) : (
            <div style={s.noThread}>
              <p style={s.noThreadIcon}>💬</p>
              <p style={s.noThreadText}>Select a conversation</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop:      { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.6)', backdropFilter: 'blur(6px)', zIndex: 900, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' },
  panel:         { display: 'flex', width: '100%', maxWidth: '720px', height: '100%', background: 'var(--dark2)', borderLeft: '1px solid rgba(201,168,76,.15)', overflow: 'hidden', animation: 'slideInRight .25s ease' },
  sidebar:       { width: '260px', flexShrink: 0, borderRight: '1px solid rgba(201,168,76,.1)', display: 'flex', flexDirection: 'column', height: '100%' },
  sidebarHidden: { display: 'none' } as React.CSSProperties,
  sidebarHeader: { padding: '1rem 1rem .75rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  sidebarTitle:  { fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '.4rem' },
  closeBtn:      { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.85rem', padding: '.2rem', lineHeight: 1 },
  convList:      { flex: 1, overflowY: 'auto' as const, padding: '.5rem 0' },
  convItem:      { width: '100%', display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.6rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background .15s' },
  convItemActive:{ background: 'rgba(201,168,76,.07)' },
  convInfo:      { flex: 1, minWidth: 0 },
  convName:      { fontSize: '.8rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  convPreview:   { fontSize: '.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: '.1rem' },
  convTime:      { fontSize: '.62rem', color: 'var(--text-muted)', flexShrink: 0 },
  convUnread:    { position: 'absolute', top: '-2px', right: '-2px', background: 'var(--gold)', color: 'var(--dark)', fontSize: '.55rem', fontWeight: 700, borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  unreadBadge:   { background: 'var(--gold)', color: 'var(--dark)', fontSize: '.6rem', fontWeight: 700, borderRadius: '50px', padding: '.1rem .4rem', minWidth: '16px', textAlign: 'center' as const },
  avatar:        { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.78rem', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', position: 'relative' as const },
  avatarImg:     { width: '100%', height: '100%', objectFit: 'cover' as const, borderRadius: '50%' },
  thread:        { flex: 1, display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden' },
  threadHidden:  { display: 'none' } as React.CSSProperties,
  threadHeader:  { padding: '.75rem 1rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', gap: '.6rem', flexShrink: 0 },
  threadName:    { fontSize: '.85rem', fontWeight: 600, color: 'var(--text)', flex: 1 },
  backBtn:       { background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '.75rem', padding: 0, fontFamily: "'DM Sans', sans-serif", marginRight: '.25rem' },
  msgList:       { flex: 1, overflowY: 'auto' as const, padding: '1rem', display: 'flex', flexDirection: 'column' as const, gap: '.25rem' },
  msgRow:        { display: 'flex', alignItems: 'flex-end', gap: '.5rem', marginBottom: '.15rem' },
  bubble:        { padding: '.5rem .8rem', borderRadius: '18px', fontSize: '.85rem', lineHeight: 1.45, wordBreak: 'break-word' as const },
  bubbleMine:    { background: 'rgba(201,168,76,.18)', border: '1px solid rgba(201,168,76,.25)', color: 'var(--text)', borderBottomRightRadius: '4px' },
  bubbleThem:    { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', color: 'var(--text)', borderBottomLeftRadius: '4px' },
  msgTime:       { fontSize: '.6rem', color: 'var(--text-muted)', marginTop: '.2rem', padding: '0 .3rem' },
  dayDivider:    { textAlign: 'center' as const, fontSize: '.62rem', color: 'var(--text-muted)', letterSpacing: '.08em', margin: '.75rem 0 .5rem', opacity: .7 },
  inputRow:      { padding: '.75rem 1rem', borderTop: '1px solid rgba(201,168,76,.1)', display: 'flex', gap: '.5rem', flexShrink: 0 },
  input:         { flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '50px', padding: '.55rem 1rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', outline: 'none' },
  sendBtn:       { width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.9rem', flexShrink: 0, transition: 'all .2s' },
  empty:         { textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '.8rem', fontStyle: 'italic', padding: '2rem 1rem' },
  noThread:      { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '.5rem' },
  noThreadIcon:  { fontSize: '2rem', margin: 0 },
  noThreadText:  { fontSize: '.85rem', color: 'var(--text-muted)', fontStyle: 'italic' },
};