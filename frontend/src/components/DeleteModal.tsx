'use client';
import { Card } from '@/types';
import { cards as cardsApi } from '@/lib/api';
import { useState } from 'react';

interface DeleteModalProps {
  card: Card | null;
  onClose: () => void;
  onDeleted: () => void;
  toast: (msg: string) => void;
}

export default function DeleteModal({ card, onClose, onDeleted, toast }: DeleteModalProps) {
  const [loading, setLoading] = useState(false);

  if (!card) return null;

  async function handleDelete() {
    if (!card) return;
    setLoading(true);
    try {
      await cardsApi.delete(card.id);
      toast(`"${card.title}" deleted`);
      onDeleted();
      onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to delete verse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={{ fontSize: '2rem', marginBottom: '.8rem' }}>🗑</div>
        <h2 style={s.title}>Delete this verse?</h2>
        <p style={s.sub}>
          Permanently remove <strong>"{card.title}"</strong>. This cannot be undone.
        </p>
        <div style={s.actions}>
          <button style={s.cancelBtn} onClick={onClose}>Keep it</button>
          <button style={{ ...s.deleteBtn, opacity: loading ? 0.6 : 1 }} onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)', backdropFilter: 'blur(10px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' },
  modal: { background: 'var(--dark2)', border: '1px solid rgba(200,50,50,.25)', borderRadius: '20px', maxWidth: '350px', width: '100%', padding: '2rem', textAlign: 'center' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', marginBottom: '.4rem' },
  sub: { fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 },
  actions: { display: 'flex', gap: '.65rem', justifyContent: 'center' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,.25)', color: 'var(--text-muted)', padding: '.6rem 1.3rem', borderRadius: '50px', fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', cursor: 'pointer', transition: 'all .25s' },
  deleteBtn: { background: 'linear-gradient(135deg,#c03030,#7a1515)', border: 'none', color: '#fff', padding: '.6rem 1.3rem', borderRadius: '50px', fontFamily: "'DM Sans', sans-serif", fontSize: '.82rem', cursor: 'pointer', transition: 'opacity .25s' },
};
