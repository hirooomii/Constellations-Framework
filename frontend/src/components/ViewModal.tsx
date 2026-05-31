'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, Comment, User } from '@/types';
import { reactions as reactionsApi, comments as commentsApi, cards as cardsApi, REACTION_TYPES, ReactionType, profiles } from '@/lib/api';

interface ViewModalProps {
  card: Card | null;
  onClose: () => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  user: User | null;
  toast: (msg: string) => void;
  onAuthRequired: () => void;
  onProfileClick?: (username: string) => void;
}

interface CommentWithProfile extends Comment {
  avatar_url?: string;
  username?: string;
}

export default function ViewModal({ card, onClose, onEdit, onDelete, user, toast, onAuthRequired, onProfileClick }: ViewModalProps) {
  const [reactionCounts, setReactionCounts]     = useState<Record<string, number>>({});
  const [myReactions, setMyReactions]           = useState<string[]>([]);
  const [commentsList, setCommentsList]         = useState<CommentWithProfile[]>([]);
  const [commentsLoading, setCommentsLoading]   = useState(false);
  const [commentText, setCommentText]           = useState('');
  const [postingComment, setPostingComment]     = useState(false);
  const [commentsEnabled, setCommentsEnabled]   = useState(true);
  const [togglingComments, setTogglingComments] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState(false);

  const isAdmin           = user?.role === 'admin';
  const isOwner           = !!user && card?.author_id === user.id;
  const canEdit           = isAdmin || isOwner;
  const canComment        = user?.role === 'registered' || user?.role === 'admin';
  const canToggleComments = isAdmin || isOwner;

  const loadReactions = useCallback(async (cardId: string) => {
    try {
      const data = await reactionsApi.get(cardId);
      setReactionCounts(data.counts ?? {});
      setMyReactions(data.mine ?? []);
    } catch { /* silent */ }
  }, []);

  const loadComments = useCallback(async (cardId: string) => {
    setCommentsLoading(true);
    try {
      const data = await commentsApi.list(cardId);
      const list = Array.isArray(data) ? data : [];

      // Enrich comments with profile avatars
      const enriched = await Promise.all(list.map(async (c: Comment) => {
        if (!c.user_id) return c;
        try {
          // Try to get username from author field (display_name format)
          return { ...c };
        } catch { return c; }
      }));

      setCommentsList(enriched);
    } catch { setCommentsList([]); }
    finally { setCommentsLoading(false); }
  }, []);

  useEffect(() => {
    if (!card) return;
    setCommentText('');
    setActiveReactionPicker(false);
    setCommentsEnabled(card.comments_enabled ?? true);
    loadReactions(card.id);
    loadComments(card.id);
  }, [card, loadReactions, loadComments]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!card) return null;

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

  async function handleReaction(type: ReactionType) {
    try {
      await reactionsApi.toggle(card!.id, type);
      await loadReactions(card!.id);
    } catch { toast('Could not save reaction'); }
    setActiveReactionPicker(false);
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    if (!canComment) { onAuthRequired(); return; }
    setPostingComment(true);
    try {
      await commentsApi.post(card!.id, commentText.trim());
      setCommentText('');
      await loadComments(card!.id);
      toast('Comment added ✦');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to post comment');
    } finally { setPostingComment(false); }
  }

  async function handleDeleteComment(id: string) {
    if (!isAdmin) return;
    try {
      await commentsApi.delete(id);
      await loadComments(card!.id);
      toast('Comment removed');
    } catch { toast('Failed to delete comment'); }
  }

  async function handleToggleComments() {
    if (!canToggleComments) return;
    setTogglingComments(true);
    try {
      const updated = await cardsApi.toggleComments(card!.id);
      setCommentsEnabled(updated.comments_enabled ?? !commentsEnabled);
      toast(updated.comments_enabled ? 'Comments enabled ✦' : 'Comments disabled');
    } catch { toast('Failed to toggle comments'); }
    finally { setTogglingComments(false); }
  }

  function getImageSrc(url?: string | null): string {
    if (!url) return 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif';
    if (url.includes('lh3.googleusercontent.com')) {
      return url.replace('https://lh3.googleusercontent.com', '/img-proxy');
    }
    return url;
  }

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg,#c9a84c,#8b6914)',
      'linear-gradient(135deg,#6a9fc0,#2e6085)',
      'linear-gradient(135deg,#9c6ab5,#5c3570)',
      'linear-gradient(135deg,#e07070,#9c2020)',
      'linear-gradient(135deg,#70b870,#2a6e2a)',
    ];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  }

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        {/* Hero */}
        <div style={s.hero}>
          <img src={getImageSrc(card.image_url)} alt={card.title} style={s.heroImg} />
          <div style={s.heroOverlay} />
          <button style={s.closeBtn} onClick={onClose}>✕</button>
          {canEdit && (
            <div style={s.adminBtns}>
              <button style={s.editBtn} onClick={() => { onClose(); onEdit(card); }}>✎ Edit</button>
              <button style={s.delBtn} onClick={() => { onClose(); onDelete(card); }}>🗑</button>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={s.body}>
          <div style={s.date}>{card.display_date}</div>
          <h2 style={s.title}>{card.title}</h2>

          {/* Author */}
          {card.author_display_name && (
            <button
              style={s.authorRow}
              onClick={() => card.author_username && onProfileClick?.(card.author_username)}
            >
              <div style={{ 
                ...s.authorAvatar, 
                background: card.author_avatar_url ? 'transparent' : getAvatarColor(card.author_display_name),
                overflow: 'hidden'
              }}>
                {card.author_avatar_url
                  ? <img src={card.author_avatar_url} alt={card.author_display_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : getInitial(card.author_display_name)
                }
              </div>
              <div style={s.authorInfo}>
                <span style={s.authorName}>{card.author_display_name}</span>
                {card.author_username && (
                  <span style={s.authorUsername}>@{card.author_username}</span>
                )}
              </div>
            </button>
          )}

          <p style={s.desc}>{card.description}</p>

          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerLabel}>✦ Poem ✦</span>
            <div style={s.dividerLine} />
          </div>

          <pre style={s.poem}>{card.poem}</pre>

          {/* Reactions */}
          <div style={s.reactionsSection}>
            <div style={s.reactionsSummary}>
              {REACTION_TYPES.map(r => {
                const count = reactionCounts[r.type] ?? 0;
                const mine  = myReactions.includes(r.type);
                if (count === 0 && !mine) return null;
                return (
                  <button
                    key={r.type}
                    style={{ ...s.reactionPill, ...(mine ? s.reactionPillActive : {}) }}
                    onClick={() => handleReaction(r.type)}
                    title={`${r.label} · ${count}`}
                  >
                    <span style={{ fontSize: '1rem' }}>{r.emoji}</span>
                    <span style={s.reactionCount}>{count}</span>
                  </button>
                );
              })}
              {totalReactions > 0 && (
                <span style={s.totalReactions}>
                  {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
                </span>
              )}
              {totalReactions === 0 && (
                <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Be the first to react!
                </span>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                style={s.addReactionBtn}
                onClick={() => setActiveReactionPicker(p => !p)}
              >
                {activeReactionPicker ? '✕ Close' : '✦ React'}
              </button>

              {activeReactionPicker && (
                <div style={s.reactionPicker}>
                  <p style={s.pickerTitle}>How did this make you feel?</p>
                  <div style={s.pickerGrid}>
                    {REACTION_TYPES.map(r => {
                      const mine  = myReactions.includes(r.type);
                      const count = reactionCounts[r.type] ?? 0;
                      return (
                        <button
                          key={r.type}
                          style={{ ...s.pickerBtn, ...(mine ? s.pickerBtnActive : {}) }}
                          onClick={() => handleReaction(r.type)}
                        >
                          <span style={{ fontSize: '1.4rem' }}>{r.emoji}</span>
                          <span style={s.pickerLabel}>{r.label}</span>
                          {count > 0 && <span style={s.pickerCount}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div style={s.commentsHeader}>
            <div style={s.commentsTitle}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Comments
              {!commentsEnabled && <span style={s.disabledBadge}>disabled</span>}
            </div>
            {canToggleComments && (
              <button style={s.toggleCommentsBtn} onClick={handleToggleComments} disabled={togglingComments}>
                {togglingComments ? '…' : commentsEnabled ? '🔇 Disable' : '🔊 Enable'}
              </button>
            )}
          </div>

          {commentsEnabled ? (
            <>
              <div style={s.commentsList}>
                {commentsLoading && <p style={s.noComments}>Loading…</p>}
                {!commentsLoading && commentsList.length === 0 && (
                  <p style={s.noComments}>
                    No comments yet. {canComment ? 'Be the first!' : 'Log in to comment.'}
                  </p>
                )}
                {commentsList.map(c => (
                  <div key={c.id} style={s.commentItem}>
                    {/* Comment avatar */}
                    <div style={s.commentRow}>
                    <div style={{ ...s.commentAvatar, background: c.avatar_url ? 'transparent' : getAvatarColor(c.author) }}>
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt={c.author} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : getInitial(c.author)
                      }
                    </div>
                      <div style={s.commentContent}>
                        <div style={s.commentAuthorRow}>
                          <span style={s.commentAuthor}>{c.author}</span>
                          <span style={s.commentTime}>
                            {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                            {new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isAdmin && (
                            <button style={s.commentDel} onClick={() => handleDeleteComment(c.id)}>✕</button>
                          )}
                        </div>
                        <div style={s.commentBody}>{c.body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {canComment ? (
                <div style={s.inputRow}>
                  {/* Current user avatar */}
                  {user && (
                    <div style={{ ...s.commentAvatar, background: getAvatarColor(user.display_name || user.email), flexShrink: 0 }}>
                      {user.avatar_url
                        ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : getInitial(user.display_name || user.email)
                      }
                    </div>
                  )}
                  <input
                    style={s.commentInput}
                    placeholder="Leave a kind thought…"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                    maxLength={500}
                  />
                  <button style={s.sendBtn} onClick={handleComment} disabled={postingComment}>
                    {postingComment ? '…' : '➤'}
                  </button>
                </div>
              ) : (
                <button style={s.loginToComment} onClick={onAuthRequired}>
                  🔒 Log in to leave a comment
                </button>
              )}
            </>
          ) : (
            <p style={s.noComments}>Comments have been disabled for this verse.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' },
  modal: { background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.2)', borderRadius: '24px', maxWidth: '640px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  hero: { position: 'relative', height: '220px', flexShrink: 0, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%', objectFit: 'cover' },
  heroOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,var(--dark2) 100%)' },
  closeBtn: { position: 'absolute', top: '.8rem', left: '.8rem', width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: '.8rem', zIndex: 5 },
  adminBtns: { position: 'absolute', top: '.8rem', right: '.8rem', display: 'flex', gap: '.4rem', zIndex: 5 },
  editBtn: { padding: '.3rem .75rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.35)', background: 'rgba(201,168,76,.15)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.75rem', fontFamily: "'DM Sans', sans-serif" },
  delBtn: { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(200,50,50,.3)', background: 'rgba(200,50,50,.15)', color: '#e07070', cursor: 'pointer', fontSize: '.9rem' },
  body: { padding: '1.4rem 1.8rem 1.8rem', overflowY: 'auto', flex: 1 },
  date: { fontSize: '.68rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', lineHeight: 1.15, marginBottom: '.6rem' },
  authorRow: { display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.8rem', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.1)', borderRadius: '50px', padding: '.4rem .8rem .4rem .4rem', cursor: 'pointer', transition: 'all .2s', width: 'fit-content' },
  authorAvatar: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, color: 'var(--dark)', flexShrink: 0 },
  authorInfo: { display: 'flex', flexDirection: 'column', gap: '.1rem' },
  authorName: { fontSize: '.78rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  authorUsername: { fontSize: '.65rem', color: 'var(--gold)' },
  desc: { fontSize: '.88rem', color: 'var(--text-muted)', marginBottom: '1.3rem', lineHeight: 1.6 },
  divider: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' },
  dividerLine: { flex: 1, height: '1px', background: 'rgba(201,168,76,.2)' },
  dividerLabel: { fontSize: '.62rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' },
  poem: { fontFamily: "'Playfair Display', serif", fontSize: '.95rem', lineHeight: 2, color: 'var(--text)', whiteSpace: 'pre-wrap', fontStyle: 'italic', borderLeft: '2px solid rgba(201,168,76,.25)', paddingLeft: '1.2rem', marginBottom: '1.5rem' },
  reactionsSection: { display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap', padding: '.85rem 0', borderTop: '1px solid rgba(201,168,76,.1)', borderBottom: '1px solid rgba(201,168,76,.1)', marginBottom: '1.2rem' },
  reactionsSummary: { display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', flex: 1 },
  reactionPill: { display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.3rem .65rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'var(--text)', cursor: 'pointer', fontSize: '.85rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .2s' },
  reactionPillActive: { border: '1px solid rgba(201,168,76,.5)', background: 'rgba(201,168,76,.12)', color: 'var(--gold)' },
  reactionCount: { fontSize: '.75rem', fontWeight: 500, minWidth: '12px' },
  totalReactions: { fontSize: '.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '.25rem' },
  addReactionBtn: { display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.35rem .8rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.25)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: '.75rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s', whiteSpace: 'nowrap' },
  reactionPicker: { position: 'absolute', bottom: 'calc(100% + .5rem)', right: 0, background: 'var(--dark3)', border: '1px solid rgba(201,168,76,.2)', borderRadius: '16px', padding: '.85rem', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,.6)', minWidth: '220px' },
  pickerTitle: { fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '.6rem', textAlign: 'center' },
  pickerGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.4rem' },
  pickerBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem', padding: '.55rem .4rem', borderRadius: '10px', border: '1px solid transparent', background: 'rgba(255,255,255,.03)', cursor: 'pointer', transition: 'all .2s', fontFamily: "'DM Sans', sans-serif", position: 'relative' },
  pickerBtnActive: { border: '1px solid rgba(201,168,76,.4)', background: 'rgba(201,168,76,.1)' },
  pickerLabel: { fontSize: '.62rem', color: 'var(--text-muted)' },
  pickerCount: { position: 'absolute', top: '.2rem', right: '.3rem', fontSize: '.55rem', color: 'var(--gold)', fontWeight: 600 },
  commentsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.85rem' },
  commentsTitle: { fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '.4rem' },
  disabledBadge: { background: 'rgba(200,50,50,.15)', border: '1px solid rgba(200,50,50,.25)', color: '#e07070', fontSize: '.6rem', padding: '.1rem .4rem', borderRadius: '50px', letterSpacing: '.05em' },
  toggleCommentsBtn: { fontSize: '.7rem', padding: '.25rem .65rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all .2s' },
  commentsList: { display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '.9rem', maxHeight: '200px', overflowY: 'auto' },
  noComments: { fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  commentItem: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: '12px', padding: '.6rem .75rem' },
  commentRow: { display: 'flex', gap: '.6rem', alignItems: 'flex-start' },
  commentAvatar: { width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' },
  commentContent: { flex: 1, minWidth: 0 },
  commentAuthorRow: { display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.2rem', flexWrap: 'wrap' },
  commentAuthor: { fontSize: '.72rem', fontWeight: 600, color: 'var(--gold)' },
  commentTime: { fontSize: '.62rem', color: 'var(--text-muted)' },
  commentDel: { background: 'none', border: 'none', color: 'rgba(200,80,80,.5)', cursor: 'pointer', fontSize: '.68rem', padding: 0, lineHeight: 1, marginLeft: 'auto' },
  commentBody: { fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.5 },
  inputRow: { display: 'flex', gap: '.5rem', alignItems: 'center' },
  commentInput: { flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '8px', padding: '.5rem .75rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', outline: 'none' },
  sendBtn: { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.28)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.9rem', transition: 'all .25s', flexShrink: 0 },
  loginToComment: { width: '100%', padding: '.6rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.2)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.8rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
};