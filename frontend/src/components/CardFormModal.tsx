'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/types';
import { cards as cardsApi } from '@/lib/api';
import { format, parseISO } from 'date-fns';

interface CardFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  toast: (msg: string) => void;
  editCard?: Card | null;
}

type PublishMode = 'now' | 'schedule';

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return ''; }
}

function formatDisplayDate(raw: string): string {
  try { return format(parseISO(raw + 'T00:00:00'), 'MMMM d, yyyy'); } catch { return raw; }
}

export default function CardFormModal({ open, onClose, onSaved, toast, editCard }: CardFormModalProps) {
  const isEdit = !!editCard;

  const [title, setTitle] = useState('');
  const [poem, setPoem] = useState('');
  const [desc, setDesc] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [displayDate, setDisplayDate] = useState('');
  const [publishMode, setPublishMode] = useState<PublishMode>('now');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editCard) {
      setTitle(editCard.title);
      setPoem(editCard.poem);
      setDesc(editCard.description || '');
      setImgUrl(editCard.image_url || '');
      setDisplayDate(toInputDate(editCard.display_date));
      setPublishMode('now');
    } else {
      setTitle(''); setPoem(''); setDesc(''); setImgUrl('');
      setDisplayDate(new Date().toISOString().split('T')[0]);
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      setSchedDate(tomorrow.toISOString().split('T')[0]);
      const now = new Date();
      setSchedTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
      setPublishMode('now');
    }
    setError('');
  }, [open, editCard]);

  if (!open) return null;

  async function handleSubmit() {
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!poem.trim()) { setError('Poem is required.'); return; }

    setLoading(true);
    try {
      if (isEdit && editCard) {
        await cardsApi.update(editCard.id, {
          title: title.trim(),
          poem: poem.trim(),
          description: desc.trim() || 'A verse without bounds',
          image_url: imgUrl.trim() || undefined,
          display_date: displayDate ? formatDisplayDate(displayDate) : editCard.display_date ?? undefined,
        });
        toast('Verse updated ✦');
      } else {
        if (publishMode === 'schedule') {
          if (!schedDate || !schedTime) { setError('Please pick a date and time.'); setLoading(false); return; }
          const scheduledAt = new Date(`${schedDate}T${schedTime}:00`);
          if (isNaN(scheduledAt.getTime())) { setError('Invalid date or time.'); setLoading(false); return; }
          if (scheduledAt <= new Date()) { setError('Scheduled time must be in the future.'); setLoading(false); return; }
          await cardsApi.create({
            title: title.trim(),
            poem: poem.trim(),
            description: desc.trim() || 'A verse without bounds',
            image_url: imgUrl.trim() || 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
            display_date: formatDisplayDate(schedDate),
            scheduled_at: scheduledAt.toISOString(),
          });
          toast(`"${title.trim()}" scheduled ⏰`);
        } else {
          await cardsApi.create({
            title: title.trim(),
            poem: poem.trim(),
            description: desc.trim() || 'A verse without bounds',
            image_url: imgUrl.trim() || 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
            display_date: displayDate ? formatDisplayDate(displayDate) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            scheduled_at: null,
          });
          toast('Verse published ✦');
        }
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save verse.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.modalTitle}>{isEdit ? 'Edit Verse' : 'New Verse'}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.body}>
          {error && <div style={s.errorBox}>{error}</div>}

          <Field label="Image / GIF URL">
            <input style={s.input} type="url" placeholder="Paste image or GIF URL…" value={imgUrl} onChange={e => setImgUrl(e.target.value)} />
          </Field>
          <Field label="Title">
            <input style={s.input} placeholder="Give your verse a name…" value={title} onChange={e => setTitle(e.target.value)} />
          </Field>
          <Field label="Short Description">
            <input style={s.input} placeholder="A one-line teaser…" value={desc} onChange={e => setDesc(e.target.value)} />
          </Field>
          <Field label="Poem">
            <textarea style={{ ...s.input, minHeight: '110px', resize: 'vertical' }} placeholder="Write your poem here…&#10;&#10;Let each line breathe." value={poem} onChange={e => setPoem(e.target.value)} />
          </Field>

          {!isEdit && (
            <>
              <Field label="Publishing Mode">
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <ModePill label="Post Now" icon="⏱" active={publishMode === 'now'} color="gold" onClick={() => setPublishMode('now')} />
                  <ModePill label="Schedule" icon="📅" active={publishMode === 'schedule'} color="blue" onClick={() => setPublishMode('schedule')} />
                </div>
              </Field>

              {publishMode === 'schedule' && (
                <div style={s.schedBox}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
                    <Field label="Publish Date">
                      <input style={s.input} type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                    </Field>
                    <Field label="Publish Time">
                      <input style={s.input} type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                    </Field>
                  </div>
                  <p style={s.schedNote}>ℹ️ The card's display date will automatically match the scheduled date.</p>
                </div>
              )}

              {publishMode === 'now' && (
                <Field label="Verse Date (shown on card)">
                  <input style={s.input} type="date" value={displayDate} onChange={e => setDisplayDate(e.target.value)} />
                </Field>
              )}
            </>
          )}

          {isEdit && (
            <Field label="Verse Date">
              <input style={s.input} type="date" value={displayDate} onChange={e => setDisplayDate(e.target.value)} />
            </Field>
          )}

          <button
            style={{ ...s.submitBtn, ...(publishMode === 'schedule' && !isEdit ? s.submitBlue : {}), opacity: loading ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving…' : isEdit ? '✦ Save Changes' : publishMode === 'schedule' ? '⏰ Schedule Verse' : '✦ Publish Verse'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '.85rem' }}>
      <label style={{ fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '.35rem' }}>{label}</label>
      {children}
    </div>
  );
}

function ModePill({ label, icon, active, color, onClick }: { label: string; icon: string; active: boolean; color: 'gold' | 'blue'; onClick: () => void }) {
  const activeStyle = active
    ? color === 'gold'
      ? { background: 'rgba(201,168,76,.15)', borderColor: 'var(--gold)', color: 'var(--gold)' }
      : { background: 'rgba(106,159,192,.15)', borderColor: 'var(--sched)', color: 'var(--sched)' }
    : {};
  return (
    <button style={{ ...s.modePill, ...activeStyle }} onClick={onClick}>
      {icon} {label}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' },
  modal: { background: 'var(--dark3)', border: '1px solid rgba(201,168,76,.18)', borderRadius: '22px', maxWidth: '580px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { padding: '1.3rem 1.8rem .9rem', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1.3rem' },
  closeBtn: { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.4)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.75rem' },
  body: { padding: '1.3rem 1.8rem', overflowY: 'auto', flex: 1 },
  errorBox: { fontSize: '.78rem', color: '#e07070', background: 'rgba(200,50,50,.1)', border: '1px solid rgba(200,50,50,.2)', borderRadius: '8px', padding: '.5rem .8rem', marginBottom: '.8rem', textAlign: 'center' },
  input: { width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '9px', padding: '.65rem .9rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', outline: 'none' },
  modePill: { display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.45rem .9rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.2)', color: 'var(--text-muted)', fontSize: '.78rem', cursor: 'pointer', background: 'transparent', fontFamily: "'DM Sans', sans-serif', transition: 'all .25s'" },
  schedBox: { background: 'rgba(106,159,192,.04)', border: '1px solid rgba(106,159,192,.15)', borderRadius: '10px', padding: '.9rem 1rem', marginBottom: '.85rem' },
  schedNote: { fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.5rem', fontStyle: 'italic' },
  submitBtn: { padding: '.8rem 2rem', borderRadius: '50px', border: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: '.88rem', fontWeight: 500, cursor: 'pointer', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', transition: 'opacity .25s' },
  submitBlue: { background: 'linear-gradient(135deg,#6a9fc0,#2e6085)', color: '#fff' },
};
