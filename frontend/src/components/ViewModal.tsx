'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, Comment, UserRole } from '@/types';
import { reactions as reactionsApi, comments as commentsApi } from '@/lib/api';

interface ViewModalProps {
  card: Card | null;
  onClose: () => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  userRole: UserRole | 'guest';
  toast: (msg: string) => void;
  onAuthRequired: () => void;
}

export default function ViewModal({ card, onClose, onEdit, onDelete, userRole, toast, onAuthRequired }: ViewModalProps) {
  const [heartCount, setHeartCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const isAdmin = userRole === 'admin';
  const canComment = userRole === 'registered' || userRole === 'admin';

  const loadReactions = useCallback(async (cardId: string) => {
    try {
      const data = await reactionsApi.get(cardId);
      setHeartCount(data.counts.heart ?? 0);
      setIsLiked(data.mine.includes('heart'));
    } catch { /* silent */ }
  }, []);

  const loadComments = useCallback(async (cardId: string) => {
    setCommentsLoading(true);
    try {
      const data = await commentsApi.list(cardId);
      setCommentsList(data);
    } catch { setCommentsList([]); }
    finally { setCommentsLoading(false); }
  }, []);

  useEffect(() => {
    if (!card) return;
    setCommentText('');
    loadReactions(card.id);
    loadComments(card.id);
  }, [card, loadReactions, loadComments]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!card) return null;

  async function handleHeart() {
    if (!card) return;
    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setHeartCount(c => wasLiked ? c - 1 : c + 1);
    try {
      const result = await reactionsApi.toggle(card.id, 'heart');
      setHeartCount(result.counts.heart ?? 0);
      setIsLiked(result.mine.includes('heart'));
    } catch {
      // Revert on error
      setIsLiked(wasLiked);
      setHeartCount(c => wasLiked ? c + 1 : c - 1);
      toast('Could not save reaction');
    }
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
    } finally {
      setPostingComment(false);
    }
  }

  async function handleDeleteComment(id: string) {
    if (!isAdmin) return;
    try {
      await commentsApi.delete(id);
      await loadComments(card!.id);
      toast('Comment removed');
    } catch { toast('Failed to delete comment'); }
  }

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* Hero */}
        <div style={s.hero}>
          <img src={card.image_url || 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif'} alt={card.title} style={s.heroImg} />
          <div style={s.heroOverlay} />
          <button style={s.closeBtn} onClick={onClose}>✕</button>
          {isAdmin && (
            <div style={s.adminBtns}>
              <button style={s.editBtn} onClick={() => { onClose(); onEdit(card); }}>
                ✎ Edit
              </button>
              <button style={s.delBtn} onClick={() => { onClose(); onDelete(card); }}>
                🗑
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={s.body}>
          <div style={s.date}>{card.display_date}</div>
          <h2 style={s.title}>{card.title}</h2>
          <p style={s.desc}>{card.description}</p>

          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerLabel}>✦ Poem ✦</span>
            <div style={s.dividerLine} />
          </div>

          <pre style={s.poem}>{card.poem}</pre>

          {/* Reactions */}
          <div style={s.reactionsBar}>
            <button style={{ ...s.heartBtn, ...(isLiked ? s.heartBtnLiked : {}) }} onClick={handleHeart}>
              <svg width="15" height="15" fill={isLiked ? '#e05555' : 'none'} stroke={isLiked ? '#e05555' : 'currentColor'} strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {heartCount}
            </button>
            <span style={s.heartLabel}>{heartCount === 1 ? 'person loved this' : 'people loved this'}</span>
          </div>

          {/* Comments */}
          <div style={s.commentsTitle}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Comments
          </div>

          <div style={s.commentsList}>
            {commentsLoading && <p style={s.noComments}>Loading…</p>}
            {!commentsLoading && commentsList.length === 0 && (
              <p style={s.noComments}>No comments yet. {canComment ? 'Be the first!' : 'Log in to comment.'}</p>
            )}
            {commentsList.map(c => (
              <div key={c.id} style={s.commentItem}>
                <div style={s.commentAuthor}>
                  {c.author}
                  {isAdmin && (
                    <button style={s.commentDel} onClick={() => handleDeleteComment(c.id)}>✕</button>
                  )}
                </div>
                <div style={s.commentBody}>{c.body}</div>
                <div style={s.commentTime}>
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                  {new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Comment input */}
          {canComment ? (
            <div style={s.inputRow}>
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
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', lineHeight: 1.15, marginBottom: '.4rem' },
  desc: { fontSize: '.88rem', color: 'var(--text-muted)', marginBottom: '1.3rem', lineHeight: 1.6 },
  divider: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' },
  dividerLine: { flex: 1, height: '1px', background: 'rgba(201,168,76,.2)' },
  dividerLabel: { fontSize: '.62rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' },
  poem: { fontFamily: "'Playfair Display', serif", fontSize: '.95rem', lineHeight: 2, color: 'var(--text)', whiteSpace: 'pre-wrap', fontStyle: 'italic', borderLeft: '2px solid rgba(201,168,76,.25)', paddingLeft: '1.2rem', marginBottom: '1.5rem' },
  reactionsBar: { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.85rem 0', borderTop: '1px solid rgba(201,168,76,.1)', borderBottom: '1px solid rgba(201,168,76,.1)', marginBottom: '1.2rem' },
  heartBtn: { display: 'flex', alignItems: 'center', gap: '.4rem', background: 'none', border: '1px solid rgba(201,168,76,.2)', color: 'var(--text-muted)', padding: '.4rem .9rem', borderRadius: '50px', cursor: 'pointer', fontSize: '.82rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  heartBtnLiked: { borderColor: 'var(--red)', color: 'var(--red)' },
  heartLabel: { fontSize: '.82rem', color: 'var(--text-muted)' },
  commentsTitle: { fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.85rem', display: 'flex', alignItems: 'center', gap: '.4rem' },
  commentsList: { display: 'flex', flexDirection: 'column', gap: '.65rem', marginBottom: '.9rem', maxHeight: '180px', overflowY: 'auto' },
  noComments: { fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  commentItem: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: '10px', padding: '.6rem .85rem', position: 'relative' },
  commentAuthor: { fontSize: '.7rem', fontWeight: 500, color: 'var(--gold)', marginBottom: '.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  commentBody: { fontSize: '.82rem', color: 'var(--text)', lineHeight: 1.5 },
  commentTime: { fontSize: '.62rem', color: 'var(--text-muted)', marginTop: '.2rem' },
  commentDel: { background: 'none', border: 'none', color: 'rgba(200,80,80,.5)', cursor: 'pointer', fontSize: '.72rem', padding: 0, lineHeight: 1 },
  inputRow: { display: 'flex', gap: '.5rem', alignItems: 'center' },
  commentInput: { flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '8px', padding: '.5rem .75rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', outline: 'none' },
  sendBtn: { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.28)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.9rem', transition: 'all .25s', flexShrink: 0 },
  loginToComment: { width: '100%', padding: '.6rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.2)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.8rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
};
