'use client';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/types';

const REACTION_EMOJIS: Record<string, string> = {
  touched:   '🌸',
  magical:   '💫',
  brilliant: '🌟',
  beautiful: '⭐',
  dreamy:    '🌙',
  powerful:  '☄️',
};

interface CardGridProps {
  cards: Card[];
  isAdmin: boolean;
  currentUserId?: string;
  onCardClick: (card: Card) => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  onAuthorClick?: (username: string) => void;
}

const shimmerStyle = `
@keyframes shimmerMove {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.card-shimmer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  border-radius: var(--radius);
  background: linear-gradient(
    105deg,
    rgba(201,168,76,0) 30%,
    rgba(201,168,76,.18) 48%,
    rgba(255,220,120,.25) 52%,
    rgba(201,168,76,0) 70%
  );
  background-size: 200% 100%;
  animation: shimmerMove 3.5s ease-in-out infinite;
  transition: opacity .3s ease;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  max-width: 1300px;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
  position: relative;
  z-index: 10;
}
@media (max-width: 600px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
`;

export default function CardGrid({ cards, isAdmin, currentUserId, onCardClick, onEdit, onDelete, onAuthorClick }: CardGridProps) {
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setVisible(prev => {
              const next = new Set(Array.from(prev));
              next.add(e.target.getAttribute('data-id') || '');
              return next;
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    refs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [cards]);

  function getImageSrc(url: string | null | undefined): string {
    if (!url) return 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif';
    if (url.includes('lh3.googleusercontent.com')) {
      return url.replace('https://lh3.googleusercontent.com', '/img-proxy');
    }
    return url;
  }

  if (cards.length === 0) {
    return (
      <>
        <style>{shimmerStyle}</style>
        <div className="card-grid">
          <div style={s.empty}>
            <div style={{ fontSize: '2rem', opacity: .3, marginBottom: '1rem' }}>✦</div>
            <p>No verses yet.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{shimmerStyle}</style>
      <div className="card-grid">
        {cards.map((card, i) => {
          const isVis    = visible.has(card.id);
          const isOwner  = !!currentUserId && card.author_id === currentUserId;
          const canEdit  = isAdmin || isOwner;
          const counts   = card.reaction_counts ?? {};
          const activeReactions = Object.entries(counts).filter(([, v]) => v > 0);
          const totalReactions  = card.reaction_count ?? activeReactions.reduce((s, [, v]) => s + v, 0) ?? card.hearts ?? 0;

          return (
            <div
              key={card.id}
              data-id={card.id}
              ref={el => { if (el) refs.current.set(card.id, el); }}
              style={{
                ...s.card,
                transitionDelay: `${i * 70}ms`,
                transform: isVis
                  ? hovered === card.id ? 'translateY(-6px) scale(1.02)' : 'translateY(0)'
                  : 'translateY(40px)',
                opacity: isVis ? 1 : 0,
                boxShadow: hovered === card.id
                  ? '0 20px 48px rgba(0,0,0,.8), 0 0 0 1px rgba(201,168,76,.35), inset 0 0 30px rgba(201,168,76,.04)'
                  : '0 8px 32px rgba(0,0,0,.6)',
              }}
              onMouseEnter={() => setHovered(card.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onCardClick(card)}
            >
              <img src={getImageSrc(card.image_url)} alt={card.title} style={s.media} />
              <div style={s.noise} />
              <div style={s.overlay} />
              <div
                className="card-shimmer"
                style={{ opacity: hovered === card.id ? 1 : 0 }}
              />

              {/* Reaction pills */}
              <div style={s.stats}>
                {activeReactions.length > 0 ? (
                  activeReactions.map(([type, count]) => (
                    <div key={type} style={s.statPill}>
                      <span style={{ fontSize: '.7rem', lineHeight: 1 }}>{REACTION_EMOJIS[type] ?? '✦'}</span>
                      {count}
                    </div>
                  ))
                ) : (
                  <div style={{ ...s.statPill, opacity: .5 }}>
                    <span style={{ fontSize: '.7rem' }}>✦</span>
                    {totalReactions}
                  </div>
                )}
                {!card.comments_enabled && (
                  <div style={s.statPill} title="Comments disabled">🔇</div>
                )}
              </div>

              {/* Edit/Delete */}
              {canEdit && (
                <div style={s.adminActions}>
                  <button style={s.actionBtn} onClick={e => { e.stopPropagation(); onEdit(card); }} title="Edit">✎</button>
                  <button style={{ ...s.actionBtn, ...s.actionBtnDel }} onClick={e => { e.stopPropagation(); onDelete(card); }} title="Delete">🗑</button>
                </div>
              )}

              {/* Content */}
              <div style={s.content}>
                <div style={s.cardDate}>{card.display_date || ''}</div>
                <div style={s.cardTitle}>{card.title}</div>

                {card.author_display_name && (
                  <button
                    style={s.authorBtn}
                    onClick={e => {
                      e.stopPropagation();
                      if (card.author_username) onAuthorClick?.(card.author_username);
                    }}
                  >
                    {card.author_display_name}
                    {card.author_username && (
                      <span style={s.authorUsername}> @{card.author_username}</span>
                    )}
                  </button>
                )}

                <div style={s.cardDesc}>{card.description || ''}</div>
                <div style={s.readMore}>
                  Read poem{' '}
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  empty: { gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' },
  card: { position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', cursor: 'pointer', aspectRatio: '3/4', transition: 'transform .6s cubic-bezier(.22,1,.36,1), box-shadow .4s ease, opacity .6s ease', boxShadow: '0 8px 32px rgba(0,0,0,.6)' },
  media: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  noise: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, opacity: .08 },
  overlay: { position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(to top,rgba(8,6,4,.98) 0%,rgba(8,6,4,.5) 45%,rgba(8,6,4,.1) 100%)' },
  stats: { position: 'absolute', top: '.6rem', left: '.6rem', zIndex: 6, display: 'flex', gap: '.3rem', flexWrap: 'wrap', maxWidth: '70%' },
  statPill: { display: 'flex', alignItems: 'center', gap: '.25rem', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '50px', padding: '.2rem .5rem', fontSize: '.68rem', color: 'rgba(255,255,255,.85)' },
  adminActions: { position: 'absolute', top: '.6rem', right: '.6rem', zIndex: 6, display: 'flex', gap: '.35rem' },
  actionBtn: { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: '.75rem', transition: 'all .2s' },
  actionBtnDel: { borderColor: 'rgba(200,50,50,.3)', color: '#e07070' },
  content: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.2rem', zIndex: 4 },
  cardDate: { fontSize: '.65rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem', opacity: .8 },
  cardTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', lineHeight: 1.2, marginBottom: '.3rem' },
  authorBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '.7rem', color: 'rgba(255,255,255,.7)', fontFamily: "'DM Sans', sans-serif", marginBottom: '.3rem', display: 'block', textAlign: 'left' },
  authorUsername: { color: 'rgba(201,168,76,.6)', fontSize: '.65rem' },
  cardDesc: { fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem', lineHeight: 1.5 },
  readMore: { display: 'flex', alignItems: 'center', gap: '.4rem', marginTop: '.6rem', fontSize: '.72rem', letterSpacing: '.08em', color: 'var(--gold)' },
};