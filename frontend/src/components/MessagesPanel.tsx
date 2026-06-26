'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, ConversationMember, Message, User } from '@/types';
import { messages as messagesApi, users as usersApi, getSession } from '@/lib/api';
import { createRealtimeClient } from '@/lib/supabase';

const CHAT_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

type ReplyTarget = { id: string; sender_name: string; body: string } | null;
type SearchUser  = { id: string; username: string; display_name: string; avatar_url?: string };

interface Props {
  user: User;
  open: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  initialUserId?: string | null;
  onInitialUserHandled?: () => void;
}

export default function MessagesPanel({ user, open, onClose, toast, initialUserId, onInitialUserHandled }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading]   = useState(false);
  const [activeConv, setActiveConv]       = useState<Conversation | null>(null);
  const [msgs, setMsgs]                   = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading]     = useState(false);
  const [msgText, setMsgText]             = useState('');
  const [sending, setSending]             = useState(false);
  const [minimized, setMinimized]         = useState(false);
  const [otherTyping, setOtherTyping]     = useState(false);
  const [replyTo, setReplyTo]             = useState<ReplyTarget>(null);

  // Group creation
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName]           = useState('');
  const [groupSearch, setGroupSearch]       = useState('');
  const [groupResults, setGroupResults]     = useState<SearchUser[]>([]);
  const [groupSelected, setGroupSelected]   = useState<SearchUser[]>([]);
  const [creatingGroup, setCreatingGroup]   = useState(false);

  // Group info panel
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const clientRef        = useRef<ReturnType<typeof createRealtimeClient> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef       = useRef<any>(null);
  const typingTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const searchTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeConvRef    = useRef<Conversation | null>(null);
  activeConvRef.current  = activeConv;

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

  // Realtime subscription
  useEffect(() => {
    if (!activeConv?.id) return;
    const session = getSession();
    if (!session?.access_token) return;

    const client = createRealtimeClient(session.access_token);
    clientRef.current = client;

    const channel = client
      .channel(`msgs:${activeConv.id}`)
      // ── New messages ──────────────────────────────────────────────────────
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        // Only add messages from OTHER users — own messages are added immediately in handleSend
        if (newMsg.sender_id === user.id) return;
        setMsgs(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, { ...newMsg, reactions: {} }]);
        setConversations(prev => prev.map(c =>
          c.id === activeConv.id
            ? { ...c, last_message: newMsg, unread_count: 0 }
            : c
        ));
        messagesApi.markRead(activeConv.id).catch(() => {});
        setOtherTyping(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      })
      // ── Live reactions ────────────────────────────────────────────────────
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, (payload) => {
        const row = (payload.new ?? payload.old) as { message_id: string; user_id: string; emoji: string };
        const { message_id, user_id, emoji } = row;

        setMsgs(prev => {
          const msg = prev.find(m => m.id === message_id);
          if (!msg) return prev; // not in this conversation, ignore

          return prev.map(m => {
            if (m.id !== message_id) return m;
            const reactions = { ...(m.reactions ?? {}) };

            if (payload.eventType === 'DELETE') {
              const cur = reactions[emoji];
              if (!cur) return m;
              const n = cur.count - 1;
              if (n <= 0) {
                delete reactions[emoji];
              } else {
                reactions[emoji] = {
                  count: n,
                  mine: user_id === user.id ? false : cur.mine,
                };
              }
            } else {
              // INSERT — skip own reactions, optimistic update already handled it
              if (user_id === user.id) return m;
              const cur = reactions[emoji];
              reactions[emoji] = {
                count: (cur?.count ?? 0) + 1,
                mine: cur?.mine ?? false,
              };
            }

            return { ...m, reactions };
          });
        });
      })
      // ── Typing indicators ─────────────────────────────────────────────────
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
  }, [activeConv?.id, user.id]); // eslint-disable-line

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, otherTyping, minimized]);

  useEffect(() => {
    if (activeConv?.id && !minimized) setTimeout(() => inputRef.current?.focus(), 80);
  }, [activeConv?.id, minimized]);

  useEffect(() => {
    if (open) loadConversations();
    else {
      setActiveConv(null); setMsgs([]); setMinimized(false);
      setOtherTyping(false); setReplyTo(null); setShowGroupInfo(false);
    }
  }, [open, loadConversations]);

  useEffect(() => {
    if (!initialUserId || !open) return;
    (async () => {
      try {
        const data = await messagesApi.openConversation(initialUserId);
        if (data?.id) {
          await loadConversations();
          const conv = await messagesApi.listConversations();
          const found = conv?.conversations?.find(c => c.id === data.id);
          if (found) setActiveConv(found);
          await loadMessages(data.id);
          setMinimized(false);
        }
      } catch { toast('Could not open conversation'); }
      finally { onInitialUserHandled?.(); }
    })();
  }, [initialUserId, open]); // eslint-disable-line

  // Group member search debounce
  useEffect(() => {
    if (!showGroupModal) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!groupSearch.trim()) { setGroupResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await usersApi.search(groupSearch);
        const selectedIds = new Set(groupSelected.map(u => u.id));
        setGroupResults((data?.users ?? []).filter(u => u.id !== user.id && !selectedIds.has(u.id)));
      } catch { /* silent */ }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [groupSearch, showGroupModal, groupSelected]); // eslint-disable-line

  function broadcastTyping() {
    const now = Date.now();
    if (now - lastBroadcastRef.current < 800) return;
    lastBroadcastRef.current = now;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: {} }).catch(() => {});
  }

  async function handleSelectConv(conv: Conversation) {
    setOtherTyping(false);
    setReplyTo(null);
    setShowGroupInfo(false);
    setActiveConv(conv);
    await loadMessages(conv.id);
  }

  async function handleSend() {
    if (!msgText.trim() || !activeConv?.id || sending) return;
    const text     = msgText.trim();
    const parentId = replyTo?.id;
    const convId   = activeConv.id;
    setSending(true);
    setMsgText('');
    setReplyTo(null);
    channelRef.current?.send({ type: 'broadcast', event: 'stopped', payload: {} }).catch(() => {});
    try {
      const newMsg = await messagesApi.send(convId, text, parentId);
      if (newMsg) {
        // Add own message immediately — don't wait for Realtime
        setMsgs(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, { ...newMsg, reactions: {} }]);
        setConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, last_message: newMsg } : c
        ));
      }
    } catch { toast('Failed to send'); setMsgText(text); }
    finally { setSending(false); }
  }

  async function handleToggleReaction(msgId: string, emoji: string) {
    // Optimistic update
    setMsgs(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions ?? {}) };
      const cur = reactions[emoji];
      if (cur?.mine) {
        const n = cur.count - 1;
        if (n <= 0) delete reactions[emoji];
        else reactions[emoji] = { count: n, mine: false };
      } else {
        reactions[emoji] = { count: (cur?.count ?? 0) + 1, mine: true };
      }
      return { ...m, reactions };
    }));
    try {
      await messagesApi.toggleReaction(msgId, emoji);
    } catch {
      if (activeConv?.id) {
        const data = await messagesApi.getMessages(activeConv.id);
        setMsgs(data?.messages ?? []);
      }
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || groupSelected.length < 1 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const data = await messagesApi.createGroup(groupName.trim(), groupSelected.map(u => u.id));
      if (data?.id) {
        setShowGroupModal(false);
        setGroupName(''); setGroupSearch(''); setGroupSelected([]); setGroupResults([]);
        await loadConversations();
        const list = await messagesApi.listConversations();
        const found = list?.conversations?.find(c => c.id === data.id);
        if (found) { setActiveConv(found); await loadMessages(data.id); }
      }
    } catch { toast('Failed to create group'); }
    finally { setCreatingGroup(false); }
  }

  async function handleLeaveGroup() {
    if (!activeConv?.id) return;
    try {
      await messagesApi.removeMember(activeConv.id, user.id);
      setConversations(prev => prev.filter(c => c.id !== activeConv!.id));
      setActiveConv(null); setMsgs([]); setShowGroupInfo(false);
    } catch { toast('Failed to leave group'); }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getInitial(name: string) { return (name || '?').charAt(0).toUpperCase(); }
  function getColor(name: string) {
    const palette = [
      'linear-gradient(135deg,#c9a84c,#8b6914)',
      'linear-gradient(135deg,#6a9fc0,#2e6085)',
      'linear-gradient(135deg,#9c6ab5,#5c3570)',
      'linear-gradient(135deg,#e07070,#9c2020)',
      'linear-gradient(135deg,#70b870,#2a6e2a)',
    ];
    return palette[(name || '?').charCodeAt(0) % palette.length];
  }
  function fmtTime(ts: string) {
    const d   = new Date(ts);
    const now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const GAP = 5 * 60 * 1000;
  function isGroupStart(i: number) {
    const m = msgs[i], p = msgs[i - 1];
    if (!p) return true;
    if (p.sender_id !== m.sender_id) return true;
    return new Date(m.created_at).getTime() - new Date(p.created_at).getTime() > GAP;
  }
  function isGroupEnd(i: number) {
    const m = msgs[i], n = msgs[i + 1];
    if (!n) return true;
    if (n.sender_id !== m.sender_id) return true;
    return new Date(n.created_at).getTime() - new Date(m.created_at).getTime() > GAP;
  }
  function bubbleRadius(isMine: boolean, start: boolean): React.CSSProperties {
    const r = 18, t = 5;
    return isMine
      ? { borderTopLeftRadius: r, borderBottomLeftRadius: r, borderTopRightRadius: start ? r : t, borderBottomRightRadius: t }
      : { borderTopRightRadius: r, borderBottomRightRadius: r, borderTopLeftRadius: start ? r : t, borderBottomLeftRadius: t };
  }
  function convLabel(conv: Conversation) {
    return conv.type === 'group'
      ? (conv.name ?? 'Group')
      : (conv.other_user?.display_name || conv.other_user?.username || 'Unknown');
  }

  function GroupAvatar({ conv, size = 34 }: { conv: Conversation; size?: number }) {
    const others = (conv.members ?? []).filter(m => m.user_id !== user.id).slice(0, 2);
    if (others.length < 2) {
      return (
        <div style={{ ...s.avatar, width: size, height: size, fontSize: size * .3, background: getColor(conv.name ?? '?'), flexShrink: 0 }}>
          {getInitial(conv.name ?? '?')}
        </div>
      );
    }
    return (
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        {others.map((m, idx) => (
          <div key={m.user_id} style={{
            ...s.avatar,
            width: size * .66, height: size * .66, fontSize: size * .22,
            position: 'absolute',
            top: idx === 0 ? 0 : 'auto', bottom: idx === 1 ? 0 : 'auto',
            left: idx === 0 ? 0 : 'auto', right: idx === 1 ? 0 : 'auto',
            background: m.avatar_url ? 'transparent' : getColor(m.display_name ?? '?'),
            border: '1.5px solid var(--dark2)',
          }}>
            {m.avatar_url ? <img src={m.avatar_url} alt="" style={s.avatarImg} /> : getInitial(m.display_name ?? '?')}
          </div>
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!open) return null;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const activeConvId = activeConv?.id ?? null;
  const isGroup      = activeConv?.type === 'group';

  if (minimized) {
    return (
      <>
        <style>{css}</style>
        <button className="msgr-chathead" style={s.chatHead} onClick={() => setMinimized(false)}>
          <div style={{ ...s.avatar, width: '100%', height: '100%', fontSize: '1.1rem', background: activeConv?.other_user?.avatar_url ? 'transparent' : getColor(activeConv ? convLabel(activeConv) : '?') }}>
            {activeConv?.other_user?.avatar_url
              ? <img src={activeConv.other_user.avatar_url} alt="" style={s.avatarImg} />
              : getInitial(activeConv ? convLabel(activeConv) : '✦')
            }
          </div>
          {totalUnread > 0 && <span style={s.chatHeadBadge}>{totalUnread}</span>}
        </button>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>

      {/* ── Group Creation Modal ── */}
      {showGroupModal && (
        <div style={s.modalBackdrop} onClick={() => setShowGroupModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <span style={s.modalTitle}>New Group Chat</span>
              <button style={s.iconBtn} onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            <input style={s.modalInput} placeholder="Group name (required)" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={80} autoFocus />
            <input style={s.modalInput} placeholder="Search people to add…" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
            {groupSelected.length > 0 && (
              <div style={s.chipRow}>
                {groupSelected.map(u => (
                  <span key={u.id} style={s.chip}>
                    {u.display_name || u.username}
                    <button style={s.chipX} onClick={() => {
                      setGroupSelected(p => p.filter(x => x.id !== u.id));
                    }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            {groupResults.length > 0 && (
              <div style={s.searchBox}>
                {groupResults.map(u => (
                  <button key={u.id} style={s.searchItem} onClick={() => {
                    setGroupSelected(p => [...p, u]);
                    setGroupResults(p => p.filter(x => x.id !== u.id));
                    setGroupSearch('');
                  }}>
                    <div style={{ ...s.avatar, width: 28, height: 28, fontSize: '.6rem', background: u.avatar_url ? 'transparent' : getColor(u.display_name) }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" style={s.avatarImg} /> : getInitial(u.display_name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text)' }}>{u.display_name}</div>
                      <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              style={{ ...s.createBtn, opacity: groupName.trim() && groupSelected.length >= 1 ? 1 : .4 }}
              disabled={!groupName.trim() || groupSelected.length < 1 || creatingGroup}
              onClick={handleCreateGroup}
            >
              {creatingGroup ? 'Creating…' : `Create (${groupSelected.length + 1} people)`}
            </button>
          </div>
        </div>
      )}

      <div className="msgr-panel" style={s.panel}>

        {/* ── Conversation List ── */}
        <div style={{ ...s.sidebar, ...(activeConvId ? s.hidden : {}) }}>
          <div style={s.header}>
            <span style={s.headerTitle}>
              Chats {totalUnread > 0 && <span style={s.unreadBadge}>{totalUnread}</span>}
            </span>
            <div style={s.headerBtns}>
              <button style={s.iconBtn} onClick={() => setShowGroupModal(true)} title="New group chat">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
                </svg>
              </button>
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
                {conv.type === 'group'
                  ? <GroupAvatar conv={conv} />
                  : (
                    <div style={{ ...s.avatar, background: conv.other_user?.avatar_url ? 'transparent' : getColor(conv.other_user?.display_name ?? '?'), position: 'relative' }}>
                      {conv.other_user?.avatar_url
                        ? <img src={conv.other_user.avatar_url} alt="" style={s.avatarImg} />
                        : getInitial(conv.other_user?.display_name ?? conv.other_user?.username ?? '?')
                      }
                      {conv.unread_count > 0 && <span style={s.convUnread}>{conv.unread_count}</span>}
                    </div>
                  )
                }
                <div style={s.convInfo}>
                  <div style={s.convName}>{convLabel(conv)}</div>
                  {conv.last_message && (
                    <div style={s.convPreview}>
                      {conv.last_message.sender_id === user.id ? 'You: ' : ''}
                      {conv.last_message.body.length > 34 ? conv.last_message.body.slice(0, 34) + '…' : conv.last_message.body}
                    </div>
                  )}
                </div>
                {conv.last_message && <span style={s.convTime}>{fmtTime(conv.last_message.created_at)}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Thread ── */}
        <div style={{ ...s.thread, ...(activeConvId ? {} : s.hidden) }}>
          {activeConv ? (
            <>
              {/* Thread header */}
              <div style={s.threadHeader}>
                <button style={s.backBtn} onClick={() => { setActiveConv(null); setMsgs([]); setOtherTyping(false); setReplyTo(null); setShowGroupInfo(false); }}>←</button>
                {isGroup
                  ? <GroupAvatar conv={activeConv} size={32} />
                  : (
                    <div style={{ ...s.avatar, width: 32, height: 32, fontSize: '.72rem', background: activeConv.other_user?.avatar_url ? 'transparent' : getColor(activeConv.other_user?.display_name ?? '?') }}>
                      {activeConv.other_user?.avatar_url
                        ? <img src={activeConv.other_user.avatar_url} alt="" style={s.avatarImg} />
                        : getInitial(activeConv.other_user?.display_name ?? activeConv.other_user?.username ?? '?')
                      }
                    </div>
                  )
                }
                <div style={s.threadHeaderText}>
                  <span style={s.threadName}>{convLabel(activeConv)}</span>
                  {isGroup
                    ? <span style={s.threadSub}>{activeConv.members?.length ?? 0} members</span>
                    : activeConv.other_user?.username && <span style={s.threadSub}>@{activeConv.other_user.username}</span>
                  }
                </div>
                <div style={s.headerBtns}>
                  {isGroup && (
                    <button style={{ ...s.iconBtn, color: showGroupInfo ? 'var(--gold)' : undefined }} onClick={() => setShowGroupInfo(v => !v)} title="Group info">ℹ</button>
                  )}
                  <button style={s.iconBtn} onClick={() => setMinimized(true)}>─</button>
                  <button style={s.iconBtn} onClick={onClose}>✕</button>
                </div>
              </div>

              {/* Group info panel */}
              {showGroupInfo && isGroup && (
                <div style={s.groupInfo}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '.5rem' }}>{activeConv.name}</div>
                  {(activeConv.members ?? []).map((m: ConversationMember) => (
                    <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '.45rem', marginBottom: '.35rem' }}>
                      <div style={{ ...s.avatar, width: 24, height: 24, fontSize: '.55rem', background: m.avatar_url ? 'transparent' : getColor(m.display_name ?? '?') }}>
                        {m.avatar_url ? <img src={m.avatar_url} alt="" style={s.avatarImg} /> : getInitial(m.display_name ?? '?')}
                      </div>
                      <span style={{ fontSize: '.73rem', color: 'var(--text)' }}>
                        {m.display_name || m.username}
                        {m.user_id === user.id && <span style={{ color: 'var(--text-muted)' }}> (you)</span>}
                      </span>
                    </div>
                  ))}
                  <button style={s.leaveBtn} onClick={handleLeaveGroup}>Leave Group</button>
                </div>
              )}

              {/* Messages */}
              <div style={s.msgList}>
                {msgsLoading && <p style={s.empty}>Loading…</p>}
                {!msgsLoading && msgs.length === 0 && <p style={s.empty}>No messages yet. Say hello! 👋</p>}
                {msgs.map((m, i) => {
                  const isMine      = m.sender_id === user.id;
                  const prev        = msgs[i - 1];
                  const showDay     = !prev || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString();
                  const start       = showDay || isGroupStart(i);
                  const end         = isGroupEnd(i);
                  const hasReact    = m.reactions && Object.keys(m.reactions).length > 0;

                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div style={s.dayDiv}>
                          {new Date(m.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      {/* Sender name in group chats */}
                      {isGroup && !isMine && start && (
                        <div style={{ ...s.senderLabel, marginLeft: '36px' }}>{m.sender_name}</div>
                      )}
                      <div
                        style={{
                          ...s.msgRow,
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                          // Extra bottom margin when message carries a reaction badge,
                          // so the next bubble doesn't crowd the overlapping pill
                          marginBottom: hasReact ? '16px' : (end ? '10px' : '2px'),
                          marginTop: start && !showDay ? '8px' : 0,
                        }}
                      >
                        {/* Avatar (other users only) */}
                        {!isMine && (
                          <div style={{ width: 24, flexShrink: 0 }}>
                            {end && (
                              <div style={{ ...s.avatar, width: 24, height: 24, fontSize: '.52rem', background: m.sender_avatar ? 'transparent' : getColor(m.sender_name) }}>
                                {m.sender_avatar ? <img src={m.sender_avatar} alt="" style={s.avatarImg} /> : getInitial(m.sender_name)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bubble wrapper — hover reveals action bar above the bubble */}
                        <div className={`msg-wrap ${isMine ? 'msg-mine' : 'msg-them'}`}>
                          {/* Reply preview inside bubble */}
                          {m.parent_id && (
                            <div style={{ ...s.replyBlock, ...(isMine ? s.replyBlockMine : {}) }}>
                              <span style={s.replyName}>{m.reply_to_name ?? 'Unknown'}</span>
                              <span style={s.replyText}>{m.reply_preview ?? ''}</span>
                            </div>
                          )}

                          {/* Action bar — floats above the bubble on hover */}
                          <div className={`msg-actions ${isMine ? 'actions-right' : 'actions-left'}`}>
                            {CHAT_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                className={`act-btn${m.reactions?.[emoji]?.mine ? ' act-reacted' : ''}`}
                                onClick={() => handleToggleReaction(m.id, emoji)}
                              >{emoji}</button>
                            ))}
                            <button
                              className="act-btn act-reply"
                              onClick={() => setReplyTo({ id: m.id, sender_name: m.sender_name, body: m.body })}
                            >↩</button>
                          </div>

                          {/* Message bubble — reaction badge overlaps its bottom corner, Messenger-style */}
                          <div style={{
                            position: 'relative',
                            ...s.bubble,
                            ...(isMine ? s.bubbleMine : s.bubbleThem),
                            ...bubbleRadius(isMine, start && !m.parent_id),
                            borderTopLeftRadius: m.parent_id ? 0 : undefined,
                            borderTopRightRadius: m.parent_id ? 0 : undefined,
                          }}>
                            {m.body}

                            {hasReact && (
                              <div style={{ ...s.reactBadge, ...(isMine ? { left: -6 } : { right: -6 }) }}>
                                {Object.entries(m.reactions!).map(([emoji, { count, mine }]) => (
                                  <button
                                    key={emoji}
                                    style={{ ...s.reactBadgeEmoji, ...(mine ? s.reactBadgeMine : {}) }}
                                    onClick={() => handleToggleReaction(m.id, emoji)}
                                  >
                                    {emoji}{count > 1 && <span style={{ fontSize: '.55rem', marginLeft: 1 }}>{count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          {end && (
                            <div style={{ ...s.msgTime, textAlign: isMine ? 'right' : 'left', marginTop: hasReact ? '8px' : '2px' }}>
                              {fmtTime(m.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {otherTyping && (
                  <div style={{ ...s.msgRow, justifyContent: 'flex-start', marginBottom: 8, marginTop: 4 }}>
                    <div style={{ width: 24, flexShrink: 0 }}>
                      <div style={{ ...s.avatar, width: 24, height: 24, fontSize: '.52rem', background: activeConv.other_user?.avatar_url ? 'transparent' : getColor(activeConv.other_user?.display_name ?? '?') }}>
                        {activeConv.other_user?.avatar_url
                          ? <img src={activeConv.other_user.avatar_url} alt="" style={s.avatarImg} />
                          : getInitial(activeConv.other_user?.display_name ?? activeConv.other_user?.username ?? '?')
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

              {/* Input area */}
              <div style={{ flexShrink: 0 }}>
                {replyTo && (
                  <div style={s.replyBar}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.63rem', color: 'var(--gold)', fontWeight: 600 }}>↩ Replying to {replyTo.sender_name}</div>
                      <div style={{ fontSize: '.63rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {replyTo.body.length > 60 ? replyTo.body.slice(0, 60) + '…' : replyTo.body}
                      </div>
                    </div>
                    <button style={s.iconBtn} onClick={() => setReplyTo(null)}>✕</button>
                  </div>
                )}
                <div style={s.inputRow}>
                  <input
                    ref={inputRef}
                    style={s.input}
                    placeholder="Aa"
                    value={msgText}
                    onChange={e => { setMsgText(e.target.value); if (e.target.value) broadcastTyping(); }}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    maxLength={1000}
                  />
                  <button style={{ ...s.sendBtn, opacity: msgText.trim() ? 1 : .4 }} onClick={handleSend} disabled={sending || !msgText.trim()}>
                    {sending ? '…' : '➤'}
                  </button>
                </div>
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

// ── CSS ────────────────────────────────────────────────────────────────────
const css = `
@keyframes msgrSlideUp {
  from { opacity: 0; transform: translateY(24px) scale(.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1);   }
}
@keyframes msgrPopIn {
  from { opacity: 0; transform: scale(.6); }
  to   { opacity: 1; transform: scale(1);  }
}
@keyframes typingBounce {
  0%,60%,100% { transform: translateY(0);   opacity:.45; }
  30%         { transform: translateY(-5px); opacity:1;   }
}
.msgr-panel    { animation: msgrSlideUp .22s cubic-bezier(.2,.9,.3,1.2); }
.msgr-chathead { animation: msgrPopIn   .2s  cubic-bezier(.34,1.56,.64,1); }
.typing-dot {
  display:inline-block; width:7px; height:7px; border-radius:50%;
  background:rgba(255,255,255,.65); animation:typingBounce 1.3s ease infinite;
}

/* Message bubble hover actions */
.msg-wrap {
  position: relative;
  max-width: 72%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Action bar — floats just ABOVE the bubble, doesn't push layout */
.msg-actions {
  position: absolute;
  bottom: 100%;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 1px;
  background: rgba(18,14,9,.97);
  border: 1px solid rgba(201,168,76,.2);
  border-radius: 20px;
  padding: 3px 5px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .12s;
  white-space: nowrap;
  z-index: 20;
  box-shadow: 0 4px 14px rgba(0,0,0,.5);
  width: fit-content;
}
.msg-wrap:hover .msg-actions { opacity: 1; pointer-events: all; }

.actions-left  { left: 0; }
.actions-right { right: 0; }

.act-btn {
  background: none; border: none; cursor: pointer; font-size: .92rem;
  padding: 3px 4px; border-radius: 50%; line-height: 1;
  transition: transform .1s, background .1s;
}
.act-btn:hover     { transform: scale(1.28); background: rgba(255,255,255,.07); }
.act-reacted       { background: rgba(201,168,76,.16); }
.act-reply         { font-size: .75rem; color: rgba(255,255,255,.5); }
.act-reply:hover   { color: var(--gold); }

@media (max-width:480px) {
  .msgr-panel { width:100vw!important; height:100dvh!important; bottom:0!important; right:0!important; border-radius:0!important; }
}
`;

// ── Styles ─────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed', bottom: 20, right: 20, zIndex: 950,
    width: 360, height: 560, maxHeight: '80vh',
    background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.18)',
    borderRadius: 18, boxShadow: '0 12px 40px rgba(0,0,0,.45)',
    display: 'flex', overflow: 'hidden',
  },
  hidden:        { display: 'none' } as React.CSSProperties,
  sidebar:       { width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' },
  header:        { padding: '.85rem 1rem .7rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerTitle:   { fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '.4rem' },
  headerBtns:    { display: 'flex', gap: '.3rem' },
  iconBtn:       { background: 'rgba(255,255,255,.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.75rem', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  unreadBadge:   { background: 'var(--gold)', color: 'var(--dark)', fontSize: '.6rem', fontWeight: 700, borderRadius: 50, padding: '.05rem .4rem', minWidth: 16, textAlign: 'center' as const },
  convList:      { flex: 1, overflowY: 'auto' as const, padding: '.4rem 0' },
  convItem:      { width: '100%', display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .9rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  convItemActive:{ background: 'rgba(201,168,76,.07)' },
  convInfo:      { flex: 1, minWidth: 0 },
  convName:      { fontSize: '.78rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  convPreview:   { fontSize: '.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: '.1rem' },
  convTime:      { fontSize: '.6rem', color: 'var(--text-muted)', flexShrink: 0 },
  convUnread:    { position: 'absolute', top: -2, right: -2, background: 'var(--gold)', color: 'var(--dark)', fontSize: '.55rem', fontWeight: 700, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatar:        { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', position: 'relative' as const },
  avatarImg:     { width: '100%', height: '100%', objectFit: 'cover' as const, borderRadius: '50%' },
  thread:        { flex: 1, display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden' },
  threadHeader:  { padding: '.6rem .8rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', gap: '.55rem', flexShrink: 0 },
  threadHeaderText: { flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0 },
  threadName:    { fontSize: '.8rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  threadSub:     { fontSize: '.64rem', color: 'var(--text-muted)' },
  backBtn:       { background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '1rem', padding: 0 },
  groupInfo:     { padding: '.7rem 1rem', borderBottom: '1px solid rgba(201,168,76,.1)', background: 'rgba(18,14,9,.5)', flexShrink: 0, overflowY: 'auto' as const, maxHeight: 180 },
  leaveBtn:      { marginTop: '.5rem', padding: '.35rem .8rem', background: 'rgba(224,64,90,.12)', color: '#e0405a', border: '1px solid rgba(224,64,90,.25)', borderRadius: 8, cursor: 'pointer', fontSize: '.72rem', fontWeight: 600 },
  // ← overflowX hidden prevents emoji pills from causing horizontal scroll
  msgList:       { flex: 1, overflowY: 'auto' as const, overflowX: 'hidden' as const, padding: '.8rem .8rem .4rem', display: 'flex', flexDirection: 'column' as const },
  msgRow:        { display: 'flex', alignItems: 'flex-end', gap: '.4rem' },
  senderLabel:   { fontSize: '.63rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '.1rem' },
  bubble:        { padding: '.45rem .75rem', fontSize: '.82rem', lineHeight: 1.4, wordBreak: 'break-word' as const },
  bubbleMine:    { background: 'linear-gradient(135deg,#c9a84c,#8b6914)', color: 'var(--dark)' },
  bubbleThem:    { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.06)', color: 'var(--text)' },
  msgTime:       { fontSize: '.57rem', color: 'var(--text-muted)', padding: '0 .3rem' },
  dayDiv:        { textAlign: 'center' as const, fontSize: '.6rem', color: 'var(--text-muted)', letterSpacing: '.07em', margin: '.7rem 0 .5rem', opacity: .7 },
  replyBlock:    { background: 'rgba(255,255,255,.06)', borderLeft: '2.5px solid rgba(201,168,76,.45)', borderRadius: '6px 10px 0 0', padding: '.22rem .6rem', marginBottom: -1 },
  replyBlockMine:{ background: 'rgba(0,0,0,.15)', borderLeftColor: 'rgba(0,0,0,.3)' },
  replyName:     { display: 'block', fontSize: '.62rem', color: 'var(--gold)', fontWeight: 700 },
  replyText:     { display: 'block', fontSize: '.62rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  // Messenger-style reaction badge, overlapping the bottom corner of the bubble
  reactBadge:    {
    position: 'absolute',
    bottom: -10,
    display: 'flex',
    gap: 2,
    background: 'var(--dark2)',
    border: '1.5px solid var(--dark2)',
    borderRadius: 50,
    padding: '1px 4px',
    boxShadow: '0 1px 4px rgba(0,0,0,.4)',
  },
  reactBadgeEmoji: {
    fontSize: '.7rem',
    display: 'flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 1px',
    color: 'var(--text)',
    lineHeight: 1.2,
  },
  reactBadgeMine: { filter: 'brightness(1.15)' },
  typingBubble:  { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.06)', borderRadius: '18px 18px 18px 4px', padding: '.5rem .75rem', display: 'flex', alignItems: 'center', gap: 4, minWidth: 52 },
  replyBar:      { display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.4rem .75rem', borderTop: '1px solid rgba(201,168,76,.08)', background: 'rgba(201,168,76,.04)' },
  inputRow:      { padding: '.6rem .7rem', borderTop: '1px solid rgba(201,168,76,.1)', display: 'flex', gap: '.5rem', flexShrink: 0, alignItems: 'center' },
  input:         { flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 50, padding: '.5rem 1rem', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', outline: 'none' },
  sendBtn:       { width: 34, height: 34, borderRadius: '50%', background: 'rgba(201,168,76,.18)', border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.85rem', flexShrink: 0, transition: 'opacity .2s' },
  empty:         { textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '.78rem', fontStyle: 'italic', padding: '2rem 1rem' },
  noThread:      { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '.5rem' },
  noThreadIcon:  { fontSize: '1.8rem', margin: 0 },
  noThreadText:  { fontSize: '.8rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  chatHead:      { position: 'fixed', bottom: 20, right: 20, zIndex: 950, width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--gold)', background: 'var(--dark2)', cursor: 'pointer', padding: 0, overflow: 'visible', boxShadow: '0 6px 20px rgba(0,0,0,.4)' },
  chatHeadBadge: { position: 'absolute', top: -4, right: -4, background: '#e0405a', color: '#fff', fontSize: '.62rem', fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--dark2)' },
  // Modal styles
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:         { background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 16, padding: '1.25rem', width: 320, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' as const },
  modalHead:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  modalTitle:    { fontSize: '.9rem', fontWeight: 700, color: 'var(--text)' },
  modalInput:    { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 8, padding: '.5rem .75rem', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: '.82rem', outline: 'none', marginBottom: '.6rem', boxSizing: 'border-box' as const },
  chipRow:       { display: 'flex', flexWrap: 'wrap' as const, gap: '.3rem', marginBottom: '.6rem' },
  chip:          { display: 'flex', alignItems: 'center', gap: '.3rem', background: 'rgba(201,168,76,.14)', border: '1px solid rgba(201,168,76,.25)', borderRadius: 50, padding: '.18rem .52rem', fontSize: '.72rem', color: 'var(--gold)' },
  chipX:         { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: '.68rem', padding: 0, lineHeight: 1 },
  searchBox:     { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.1)', borderRadius: 8, marginBottom: '.6rem', overflow: 'hidden' },
  searchItem:    { width: '100%', display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.45rem .75rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  createBtn:     { width: '100%', padding: '.62rem', background: 'linear-gradient(135deg,#c9a84c,#8b6914)', color: '#1a1510', fontWeight: 700, fontSize: '.82rem', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'opacity .2s' },
};