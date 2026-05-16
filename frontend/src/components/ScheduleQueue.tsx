'use client';
import { useState } from 'react';
import { Card } from '@/types';
import { cards as cardsApi } from '@/lib/api';

interface ScheduleQueueProps {
  scheduledCards: Card[];
  onRefresh: () => void;
  toast: (msg: string) => void;
}

export default function ScheduleQueue({ scheduledCards, onRefresh, toast }: ScheduleQueueProps) {
  const [open, setOpen] = useState(false);

  if (scheduledCards.length === 0 && !open) {
    return (
      <div style={s.wrap}>
        <div style={s.header} onClick={() => setOpen(true)}>
          <span style={s.label}>⏰ Scheduled Verses</span>
          <span style={s.count}>0</span>
        </div>
      </div>
    );
  }

  function getCountdown(scheduledAt: string): string {
    const diff = new Date(scheduledAt).getTime() - Date.now();
    if (diff <= 0) return 'posting soon…';
    const days = Math.floor(diff / 86400000);
    const hrs  = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `in ${days}d ${hrs}h`;
    if (hrs > 0)  return `in ${hrs}h ${mins}m`;
    if (mins > 0) return `in ${mins}m`;
    return 'posting soon…';
  }

  async function publishNow(card: Card) {
    try {
      await cardsApi.publishNow(card.id);
      toast('Verse published now ✦');
      onRefresh();
    } catch { toast('Failed to publish'); }
  }

  async function cancelSchedule(card: Card) {
    try {
      await cardsApi.delete(card.id);
      toast(`"${card.title}" removed from schedule`);
      onRefresh();
    } catch { toast('Failed to cancel'); }
  }

  return (
    <div style={s.wrap}>
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <span style={{ ...s.toggleIcon, transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
        <span style={s.label}>⏰ Scheduled Verses</span>
        <span style={s.count}>{scheduledCards.length}</span>
      </div>

      {open && (
        <div style={s.list}>
          {scheduledCards.length === 0 ? (
            <div style={s.empty}>No scheduled verses.</div>
          ) : scheduledCards.map(card => (
            <div key={card.id} style={s.item}>
              <div style={s.itemBar} />
              <img src={card.image_url || ''} alt={card.title} style={s.thumb} />
              <div style={s.info}>
                <div style={s.itemTitle}>{card.title}</div>
                <div style={s.timeRow}>
                  <span style={s.clock}>
                    🕐 {card.scheduled_at ? new Date(card.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <span style={s.countdown}>{card.scheduled_at ? getCountdown(card.scheduled_at) : ''}</span>
                </div>
              </div>
              <div style={s.actions}>
                <button style={s.publishBtn} title="Publish now" onClick={() => publishNow(card)}>▶</button>
                <button style={s.cancelBtn} title="Cancel" onClick={() => cancelSchedule(card)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: '1300px', margin: '0 auto 2.5rem', padding: '0 1.5rem', position: 'relative', zIndex: 10 },
  header: { display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '1rem', cursor: 'pointer', userSelect: 'none' },
  toggleIcon: { width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(106,159,192,.15)', border: '1px solid rgba(106,159,192,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform .3s', fontSize: '1.1rem', color: 'var(--sched)' },
  label: { fontSize: '.7rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--sched)' },
  count: { background: 'rgba(106,159,192,.2)', border: '1px solid rgba(106,159,192,.3)', color: 'var(--sched)', fontSize: '.65rem', padding: '.1rem .5rem', borderRadius: '50px' },
  list: { display: 'flex', flexDirection: 'column', gap: '.5rem' },
  empty: { fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '.5rem .25rem' },
  item: { display: 'flex', alignItems: 'center', gap: '.75rem', background: 'rgba(106,159,192,.05)', border: '1px solid rgba(106,159,192,.15)', borderRadius: '12px', padding: '.65rem 1rem', position: 'relative', overflow: 'hidden' },
  itemBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg,var(--sched),#2e6085)' },
  thumb: { width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: '.82rem', fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  timeRow: { display: 'flex', alignItems: 'center', gap: '.4rem', marginTop: '.2rem' },
  clock: { fontSize: '.67rem', color: 'var(--sched)' },
  countdown: { fontSize: '.65rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  actions: { display: 'flex', gap: '.35rem', flexShrink: 0 },
  publishBtn: { width: '26px', height: '26px', borderRadius: '50%', border: '1px solid rgba(201,168,76,.3)', background: 'rgba(0,0,0,.4)', color: 'var(--gold)', cursor: 'pointer', fontSize: '.75rem', transition: 'all .2s' },
  cancelBtn: { width: '26px', height: '26px', borderRadius: '50%', border: '1px solid rgba(200,50,50,.3)', background: 'rgba(0,0,0,.4)', color: '#e05555', cursor: 'pointer', fontSize: '.75rem', transition: 'all .2s' },
};
