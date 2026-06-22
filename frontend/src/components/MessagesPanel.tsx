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
  const [conversations, setConversations]     = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading]       = useState(false);
  const [activeConvId, setActiveConvId]       = useState<string | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<Conversation['other_user'] | null>(null);
  const [msgs, setMsgs]                       = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading]         = useState(false);
  const [msgText, setMsgText]                 = useState('');
  const [sending, setSending]                 = useState(false);
  const [minimized, setMinimized]             = useState(false);
  const [otherTyping, setOtherTyping]         = useState(false);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const clientRef        = useRef<ReturnType<typeof createRealtimeClient> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef       = useRef<any>(null);
  const typingTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef<number>(0);

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
    if (!activeConvId) return;
    const session = getSession();
    if (!session?.access_token) return;

    const client = createRealtimeClient(session.access_token);
    clientRef.current = client;

    const channel = client
      .channel(`msgs:${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConvId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMsgs(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        setConversations(prev => prev.map(c =>
          c.id === activeConvId
            ? { ...c, last_message: newMsg, unread_count: newMsg.sender_id !== user.id ? 0 : c.unread_count }
            : c
        ));
        if (newMsg.sender_id !== user.id) {
          messagesApi.markRead(activeConvId).catch(() => {});
          // Clear typing indicator when the other user actually sends
          setOtherTyping(false);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        }
      })
      .on('broadcast', { event: 'typing' }, () => {
        setOtherTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
      })
      .on('broadcast', { event: 'stopped' }, () => {
        setOtherTyping(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setOtherTyping(false);
      client.removeAllChannels();
    };
  }, [activeConvId, user.id]);

  // Auto-scroll on new messages or when typing indicator appears
  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, otherTyping, minimized]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConvId && !minimized) setTimeout(() => inputRef.current?.focus(), 80);
  }, [activeConvId, minimized]);

  // Load conversations when panel opens; reset everything when fully closed
  useEffect(() => {
    if (open) loadConversations();
    else { setActiveConvId(null); setActiveOtherUser(null); setMsgs([]); setMinimized(false); setOtherTyping(false); }
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
          setMinimized(false);
        }
      } catch { toast('Could not open conversation'); }
      finally { onInitialUserHandled?.(); }
    })();
  }, [initialUserId, open]); // eslint-disable-line

  // Throttled broadcast: only fire once per 800ms while user is typing
  function broadcastTyping() {
    const now = Date.now();
    if (now - lastBroadcastRef.current < 800) return;
    lastBroadcastRef.current = now;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: {} }).catch(() => {});
  }

  async function handleSelectConv(conv: Conversation) {
    setOtherTyping(false);
    setActiveConvId(conv.id);
    setActiveOtherUser(conv.other_user);
    await loadMessages(conv.id);
  }

  async function handleSend() {
    if (!msgText.trim() || !activeConvId || sending) return;
    const text = msgText.trim();
    setSending(true);
    setMsgText('');
    // Tell the other side we stopped typing
    channelRef.current?.send({ type: 'broadcast', event: 'stopped', payload: {} }).catch(() => {});
    try {
      await messagesApi.send(activeConvId, text);
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

  const GROUP_GAP_MS = 5 * 60 * 1000;
  function isGroupStart(i: number) {
    const m = msgs[i], prev = msgs[i - 1];
    if (!prev) return true;
    if (prev.sender_id !== m.sender_id) return true;
    return new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GROUP_GAP_MS;
  }
  function isGroupEnd(i: number) {
    const m = msgs[i], next = msgs[i + 1];
    if (!next) return true;
    if (next.sender_id !== m.sender_id) return true;
    return new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > GROUP_GAP_MS;
  }
  function bubbleShape(isMine: boolean, start: boolean, end: boolean): React.CSSProperties {
    const round = 18, tight = 5;
    return isMine
      ? {
          borderTopLeftRadius: round, borderBottomLeftRadius: round,
          borderTopRightRadius: start ? round : tight,
          borderBottomRightRadius: tight,
        }
      : {
          borderTopRightRadius: round, borderBottomRightRadius: round,
          borderTopLeftRadius: start ? round : tight,
          borderBottomLeftRadius: tight,
        };
  }

  if (!open) return null;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  if (minimized) {
    const bubbleUser = activeOtherUser;
    return (
      <>
        <style>{floatingStyles}</style>
        <button
          className="msgr-chathead"
          style={s.chatHead}
          onClick={() => setMinimized(false)}
          title={bubbleUser ? (bubbleUser.display_name || bubbleUser.username) : 'Messages'}
        >
          <div style={{ ...s.avatar, width: '100%', height: '100%', fontSize: '1.1rem', background: bubbleUser?.avatar_url ? 'transparent' : getColor(bubbleUser?.display_name || '?') }}>
            {bubbleUser?.avatar_url
              ? <img src={bubbleUser.avatar_url} alt="" style={s.avatarImg} />
              : bubbleUser
                ? getInitial(bubbleUser.display_name || bubbleUser.username || '?')
                : '✦'
            }
          </div>
          {totalUnread > 0 && <span style={s.chatHeadBadge}>{totalUnread}</span>}
        </button>
      </>
    );
  }

  return (
    <>
      <style>{floatingStyles}</style>
      <div className="msgr-panel" style={s.panel}>

        {/* ── Conversation List ── */}
        <div style={{ ...s.sidebar, ...(activeConvId ? s.hidden : {}) }}>
          <div style={s.header}>
            <span style={s.headerTitle}>Chats {totalUnread > 0 && <span style={s.unreadBadge}>{totalUnread}</span>}</span>
            <div style={s.headerBtns}>
              <button style={s.iconBtn} onClick={() => setMinimized(true)} title="Minimize">─</button>
              <button style={s.iconBtn} onClick={onClose} title="Close">✕</button>
            </div>
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
                      {conv.last_message.body.length > 34 ? conv.last_message.body.slice(0, 34) + '…' : conv.last_message.body}
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
        <div style={{ ...s.thread, ...(activeConvId ? {} : s.hidden) }}>
          {activeConvId ? (
            <>
              <div style={s.threadHeader}>
                <button style={s.backBtn} onClick={() => { setActiveConvId(null); setActiveOtherUser(null); setMsgs([]); setOtherTyping(false); }}>
                  ←
                </button>
                <div style={{ ...s.avatar, width: '32px', height: '32px', fontSize: '.75rem', background: activeOtherUser?.avatar_url ? 'transparent' : getColor(activeOtherUser?.display_name || '?') }}>
                  {activeOtherUser?.avatar_url
                    ? <img src={activeOtherUser.avatar_url} alt="" style={s.avatarImg} />
                    : getInitial(activeOtherUser?.display_name || activeOtherUser?.username || '?')
                  }
                </div>
                <div style={s.threadHeaderText}>
                  <span style={s.threadName}>{activeOtherUser?.display_name || activeOtherUser?.username}</span>
                  {activeOtherUser?.username && <span style={s.threadHandle}>@{activeOtherUser.username}</span>}
                </div>
                <div style={s.headerBtns}>
                  <button style={s.iconBtn} onClick={() => setMinimized(true)} title="Minimize">─</button>
                  <button style={s.iconBtn} onClick={onClose} title="Close">✕</button>
                </div>
              </div>

              <div style={s.msgList}>
                {msgsLoading && <p style={s.empty}>Loading…</p>}
                {!msgsLoading && msgs.length === 0 && (
                  <p style={s.empty}>No messages yet. Say hello! 👋</p>
                )}
                {msgs.map((m, i) => {
                  const isMine = m.sender_id === user.id;
                  const prev    = msgs[i - 1];
                  const showDay = !prev || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString();
                  const start   = showDay || isGroupStart(i);
                  const end     = isGroupEnd(i);
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div style={s.dayDivider}>
                          {new Date(m.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      <div style={{ ...s.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: end ? '10px' : '2px', marginTop: start && !showDay ? '8px' : 0 }}>
                        {!isMine && (
                          <div style={{ width: '24px', flexShrink: 0 }}>
                            {end && (
                              <div style={{ ...s.avatar, width: '24px', height: '24px', fontSize: '.55rem', background: m.sender_avatar ? 'transparent' : getColor(m.sender_name) }}>
                                {m.sender_avatar
                                  ? <img src={m.sender_avatar} alt="" style={s.avatarImg} />
                                  : getInitial(m.sender_name)
                                }
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ maxWidth: '72%' }}>
                          <div style={{ ...s.bubble, ...(isMine ? s.bubbleMine : s.bubbleThem), ...bubbleShape(isMine, start, end) }}>
                            {m.body}
                          </div>
                          {end && (
                            <div style={{ ...s.msgTime, textAlign: isMine ? 'right' : 'left' }}>
                              {fmtTime(m.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ── Typing indicator ── */}
                {otherTyping && (
                  <div style={{ ...s.msgRow, justifyContent: 'flex-start', marginBottom: '8px', marginTop: '4px' }}>
                    <div style={{ width: '24px', flexShrink: 0 }}>
                      <div style={{ ...s.avatar, width: '24px', height: '24px', fontSize: '.55rem', background: activeOtherUser?.avatar_url ? 'transparent' : getColor(activeOtherUser?.display_name || '?') }}>
                        {activeOtherUser?.avatar_url
                          ? <img src={activeOtherUser.avatar_url} alt="" style={s.avatarImg} />
                          : getInitial(activeOtherUser?.display_name || activeOtherUser?.username || '?')
                        }
                      </div>
                    </div>
                    <div style={s.typingBubble}>
                      <span className="typing-dot" />
                      <span className="typing-dot" style={{ animationDelay: '160ms' }} />
                      <span className="typing-dot" style={{ animationDelay: '320ms' }} />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div style={s.inputRow}>
                <input
                  ref={inputRef}
                  style={s.input}
                  placeholder="Aa"
                  value={msgText}
                  onChange={e => {
                    setMsgText(e.target.value);
                    if (e.target.value) broadcastTyping();
                  }}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  maxLength={1000}
                />
                <button style={{ ...s.sendBtn, opacity: msgText.trim() ? 1 : .4 }} onClick={handleSend} disabled={sending || !msgText.trim()}>
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
    </>
  );
}

const floatingStyles = `
@keyframes msgrSlideUp {
  from { opacity: 0; transform: translateY(24px) scale(.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes msgrPopIn {
  from { opacity: 0; transform: scale(.6); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: .45; }
  30%           { transform: translateY(-5px); opacity: 1; }
}
.msgr-panel    { animation: msgrSlideUp .22s cubic-bezier(.2,.9,.3,1.2); }
.msgr-chathead { animation: msgrPopIn .2s cubic-bezier(.34,1.56,.64,1); }
.typing-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,.65);
  animation: typingBounce 1.3s ease infinite;
}
@media (max-width: 480px) {
  .msgr-panel {
    width: 100vw !important;
    height: 100dvh !important;
    bottom: 0 !important;
    right: 0 !important;
    border-radius: 0 !important;
  }
}
`;

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: 950,
    width: '360px', height: '560px', maxHeight: '80vh',
    background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.18)',
    borderRadius: '18px', boxShadow: '0 12px 40px rgba(0,0,0,.45)',
    display: 'flex', overflow: 'hidden',
  },
  hidden: { display: 'none' } as React.CSSProperties,
  sidebar: { width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' },
  header: { padding: '.85rem 1rem .7rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerTitle: { fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '.4rem' },
  headerBtns: { display: 'flex', gap: '.3rem' },
  iconBtn: { background: 'rgba(255,255,255,.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.75rem', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  convList: { flex: 1, overflowY: 'auto' as const, padding: '.4rem 0' },
  convItem: { width: '100%', display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .9rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background .15s' },
  convItemActive: { background: 'rgba(201,168,76,.07)' },
  convInfo: { flex: 1, minWidth: 0 },
  convName: { fontSize: '.78rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  convPreview: { fontSize: '.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: '.1rem' },
  convTime: { fontSize: '.6rem', color: 'var(--text-muted)', flexShrink: 0 },
  convUnread: { position: 'absolute', top: '-2px', right: '-2px', background: 'var(--gold)', color: 'var(--dark)', fontSize: '.55rem', fontWeight: 700, borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  unreadBadge: { background: 'var(--gold)', color: 'var(--dark)', fontSize: '.6rem', fontWeight: 700, borderRadius: '50px', padding: '.05rem .4rem', minWidth: '16px', textAlign: 'center' as const },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', position: 'relative' as const },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' as const, borderRadius: '50%' },
  thread: { flex: 1, display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden' },
  threadHeader: { padding: '.6rem .8rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', gap: '.55rem', flexShrink: 0 },
  threadHeaderText: { flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0 },
  threadName: { fontSize: '.8rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  threadHandle: { fontSize: '.65rem', color: 'var(--text-muted)' },
  backBtn: { background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '1rem', padding: 0, fontFamily: "'DM Sans', sans-serif" },
  msgList: { flex: 1, overflowY: 'auto' as const, padding: '.8rem .8rem .4rem', display: 'flex', flexDirection: 'column' as const },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: '.4rem' },
  bubble: { padding: '.45rem .75rem', fontSize: '.82rem', lineHeight: 1.4, wordBreak: 'break-word' as const },
  bubbleMine: { background: 'linear-gradient(135deg,#c9a84c,#8b6914)', color: 'var(--dark)' },
  bubbleThem: { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.06)', color: 'var(--text)' },
  msgTime: { fontSize: '.58rem', color: 'var(--text-muted)', marginTop: '.15rem', padding: '0 .3rem' },
  dayDivider: { textAlign: 'center' as const, fontSize: '.6rem', color: 'var(--text-muted)', letterSpacing: '.08em', margin: '.7rem 0 .5rem', opacity: .7 },
  typingBubble: {
    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.06)',
    borderRadius: '18px 18px 18px 4px',
    padding: '.5rem .75rem', display: 'flex', alignItems: 'center', gap: '4px', minWidth: '52px',
  },
  inputRow: { padding: '.6rem .7rem', borderTop: '1px solid rgba(201,168,76,.1)', display: 'flex', gap: '.5rem', flexShrink: 0, alignItems: 'center' },
  input: { flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '50px', padding: '.5rem 1rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', outline: 'none' },
  sendBtn: { width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(201,168,76,.18)', border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.85rem', flexShrink: 0, transition: 'opacity .2s' },
  empty: { textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '.78rem', fontStyle: 'italic', padding: '2rem 1rem' },
  noThread: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '.5rem' },
  noThreadIcon: { fontSize: '1.8rem', margin: 0 },
  noThreadText: { fontSize: '.8rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  chatHead: {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: 950,
    width: '56px', height: '56px', borderRadius: '50%', border: '2px solid var(--gold)',
    background: 'var(--dark2)', cursor: 'pointer', padding: 0, overflow: 'visible',
    boxShadow: '0 6px 20px rgba(0,0,0,.4)',
  },
  chatHeadBadge: {
    position: 'absolute', top: '-4px', right: '-4px', background: '#e0405a', color: '#fff',
    fontSize: '.62rem', fontWeight: 700, borderRadius: '50%', width: '18px', height: '18px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--dark2)',
  },
};
