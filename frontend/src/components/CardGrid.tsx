'use client';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/types';

interface CardGridProps {
  cards: Card[];
  isAdmin: boolean;
  onCardClick: (card: Card) => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
}

export default function CardGrid({ cards, isAdmin, onCardClick, onEdit, onDelete }: CardGridProps) {
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setVisible(prev => new Set([...prev, e.target.getAttribute('data-id') || '']));
          }
        });
      },
      { threshold: 0.1 }
    );
    refs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div style={s.grid}>
        <div style={s.empty}>
          <div style={{ fontSize: '2rem', opacity: .3, marginBottom: '1rem' }}>✦</div>
          <p>No verses yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.grid}>
      {cards.map((card, i) => {
        const isVis = visible.has(card.id);
        const hearts = card.hearts || 0;
        return (
          <div
            key={card.id}
            data-id={card.id}
            ref={el => { if (el) refs.current.set(card.id, el); }}
            style={{
              ...s.card,
              transitionDelay: `${i * 70}ms`,
              transform: isVis ? 'translateY(0)' : 'translateY(40px)',
              opacity: isVis ? 1 : 0,
            }}
            onClick={() => onCardClick(card)}
          >
            <img
              src={card.image_url || 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif'}
              alt={card.title}
              style={s.media}
            />
            <div style={s.noise} />
            <div style={s.overlay} />

            {/* Heart count */}
            <div style={s.stats}>
              <div style={s.statPill}>
                <svg width="10" height="10" fill={hearts > 0 ? '#e05555' : 'none'} stroke={hearts > 0 ? '#e05555' : 'rgba(255,255,255,.7)'} strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {hearts}
              </div>
            </div>

            {/* Admin actions */}
            {isAdmin && (
              <div style={s.adminActions} className="card-admin-actions">
                <button
                  style={s.actionBtn}
                  onClick={e => { e.stopPropagation(); onEdit(card); }}
                  title="Edit"
                >✎</button>
                <button
                  style={{ ...s.actionBtn, ...s.actionBtnDel }}
                  onClick={e => { e.stopPropagation(); onDelete(card); }}
                  title="Delete"
                >🗑</button>
              </div>
            )}

            {/* Content */}
            <div style={s.content}>
              <div style={s.cardDate}>{card.display_date || ''}</div>
              <div style={s.cardTitle}>{card.title}</div>
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
  );
}

const s: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.25rem',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: '0 1.5rem 6rem',
    position: 'relative',
    zIndex: 10,
  },
  empty: { gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' },
  card: {
    position: 'relative', borderRadius: 'var(--radius)',
    overflow: 'hidden', cursor: 'pointer', aspectRatio: '3/4',
    transition: 'transform .6s cubic-bezier(.22,1,.36,1), box-shadow .4s ease, opacity .6s ease',
    boxShadow: '0 8px 32px rgba(0,0,0,.6)',
  },
  media: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  noise: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, opacity: .08 },
  overlay: { position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(to top,rgba(8,6,4,.98) 0%,rgba(8,6,4,.5) 45%,rgba(8,6,4,.1) 100%)' },
  stats: { position: 'absolute', top: '.6rem', left: '.6rem', zIndex: 6, display: 'flex', gap: '.4rem' },
  statPill: { display: 'flex', alignItems: 'center', gap: '.25rem', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '50px', padding: '.2rem .55rem', fontSize: '.68rem', color: 'rgba(255,255,255,.8)' },
  adminActions: { position: 'absolute', top: '.6rem', right: '.6rem', zIndex: 6, display: 'flex', gap: '.35rem' },
  actionBtn: { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: '.75rem', transition: 'all .2s' },
  actionBtnDel: { borderColor: 'rgba(200,50,50,.3)', color: '#e07070' },
  content: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.2rem', zIndex: 4 },
  cardDate: { fontSize: '.65rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem', opacity: .8 },
  cardTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', lineHeight: 1.2 },
  cardDesc: { fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.4rem', lineHeight: 1.5 },
  readMore: { display: 'flex', alignItems: 'center', gap: '.4rem', marginTop: '.6rem', fontSize: '.72rem', letterSpacing: '.08em', color: 'var(--gold)' },
};
