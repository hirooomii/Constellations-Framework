'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, User, Profile } from '@/types';
import { profiles } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const CLOUDINARY_CLOUD  = 'dky9pzz0r';
const CLOUDINARY_PRESET = 'constellation_uploads';

async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url;
}

interface ProfileModalProps {
  username: string | null;
  onClose: () => void;
  currentUser: User | null;
  toast: (msg: string) => void;
  onCardClick: (card: Card) => void;
  onEditProfile?: () => void;
}

export default function ProfileModal({ username, onClose, currentUser, toast, onCardClick }: ProfileModalProps) {
  const { updateProfile } = useAuth();
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [cards, setCards]         = useState<Card[]>([]);
  const [loading, setLoading]     = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState('');
  const [editBio, setEditBio]     = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !!currentUser && currentUser.username === username;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setProfile(null);
    setCards([]);
    setIsEditing(false);

    profiles.get(username)
      .then(data => {
        setProfile(data.profile);
        setCards(data.cards);
        setEditName(data.profile.display_name || '');
        setEditBio(data.profile.bio || '');
        setAvatarPreview(data.profile.avatar_url || '');
      })
      .catch(() => toast('Could not load profile'))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!username) return null;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarPreview(url);
      await updateProfile({ avatar_url: url });
      toast('Avatar updated ✦');
    } catch {
      toast('Avatar upload failed');
    } finally { setUploading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        display_name: editName.trim(),
        bio: editBio.trim(),
        avatar_url: avatarPreview || undefined,
      });
      setProfile(prev => prev ? { ...prev, display_name: editName.trim(), bio: editBio.trim(), avatar_url: avatarPreview } : prev);
      setIsEditing(false);
      toast('Profile updated ✦');
    } catch { toast('Failed to update profile'); }
    finally { setSaving(false); }
  }

  function getImageSrc(url?: string | null): string {
    if (!url) return 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif';
    if (url.includes('lh3.googleusercontent.com')) {
      return url.replace('https://lh3.googleusercontent.com', '/img-proxy');
    }
    return url;
  }

  return (
    <div style={s.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>

        {loading ? (
          <div style={s.loadingWrap}>
            <div style={{ fontSize: '1.5rem' }}>✦</div>
            <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>Loading profile…</p>
          </div>
        ) : !profile ? (
          <div style={s.loadingWrap}>
            <p style={{ color: 'var(--text-muted)' }}>Profile not found.</p>
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div style={s.profileHeader}>
              {/* Avatar */}
              <div style={s.avatarWrap}>
                {avatarPreview || profile.avatar_url ? (
                  <img src={avatarPreview || profile.avatar_url} alt={profile.display_name} style={s.avatar} />
                ) : (
                  <div style={s.avatarFallback}>
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                {isOwnProfile && isEditing && (
                  <button style={s.avatarEditBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? '⏳' : '📷'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>

              {/* Info */}
              <div style={s.profileInfo}>
                {isEditing ? (
                  <>
                    <input
                      style={s.editInput}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Display name"
                      maxLength={50}
                    />
                    <textarea
                      style={{ ...s.editInput, minHeight: '60px', resize: 'vertical' }}
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      placeholder="Write a short bio…"
                      maxLength={200}
                    />
                    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                      <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : '✦ Save'}
                      </button>
                      <button style={s.cancelBtn} onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 style={s.displayName}>{profile.display_name}</h2>
                    <p style={s.usernameText}>@{profile.username}</p>
                    {profile.bio && <p style={s.bio}>{profile.bio}</p>}
                    <div style={s.stats}>
                      <span style={s.stat}><strong>{cards.length}</strong> verses</span>
                      <span style={s.statDot}>·</span>
                      <span style={s.stat}>
                        joined {new Date(profile.created_at || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    {isOwnProfile && (
                      <button style={s.editProfileBtn} onClick={() => setIsEditing(true)}>
                        ✎ Edit Profile
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={s.divider}>
              <div style={s.dividerLine} />
              <span style={s.dividerLabel}>✦ Verses ✦</span>
              <div style={s.dividerLine} />
            </div>

            {/* Cards grid */}
            <div style={s.cardsGrid}>
              {cards.length === 0 ? (
                <p style={s.noCards}>No verses yet.</p>
              ) : (
                cards.map(card => (
                  <div
                    key={card.id}
                    style={s.cardThumb}
                    onClick={() => { onCardClick(card); onClose(); }}
                  >
                    <img src={getImageSrc(card.image_url)} alt={card.title} style={s.cardThumbImg} />
                    <div style={s.cardThumbOverlay} />
                    <div style={s.cardThumbContent}>
                      <div style={s.cardThumbDate}>{card.display_date}</div>
                      <div style={s.cardThumbTitle}>{card.title}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' },
  modal: { background: 'var(--dark2)', border: '1px solid rgba(201,168,76,.2)', borderRadius: '24px', maxWidth: '680px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' },
  closeBtn: { position: 'absolute', top: '.8rem', right: '.8rem', width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: '.8rem', zIndex: 5 },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' },
  profileHeader: { display: 'flex', gap: '1.5rem', padding: '2rem 2rem 1.5rem', alignItems: 'flex-start' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,.3)' },
  avatarFallback: { width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, border: '2px solid rgba(201,168,76,.3)' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,0,0,.8)', border: '1px solid rgba(201,168,76,.3)', cursor: 'pointer', fontSize: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, minWidth: 0 },
  displayName: { fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', marginBottom: '.2rem' },
  usernameText: { fontSize: '.78rem', color: 'var(--gold)', marginBottom: '.5rem' },
  bio: { fontSize: '.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '.6rem' },
  stats: { display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' },
  stat: { fontSize: '.75rem', color: 'var(--text-muted)' },
  statDot: { color: 'var(--text-muted)', fontSize: '.75rem' },
  editProfileBtn: { padding: '.35rem .9rem', borderRadius: '50px', border: '1px solid rgba(201,168,76,.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: '.75rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  editInput: { width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '9px', padding: '.55rem .8rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', outline: 'none', marginBottom: '.4rem', boxSizing: 'border-box' },
  saveBtn: { padding: '.4rem 1rem', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif" },
  cancelBtn: { padding: '.4rem 1rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif" },
  divider: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 2rem', marginBottom: '1rem' },
  dividerLine: { flex: 1, height: '1px', background: 'rgba(201,168,76,.15)' },
  dividerLabel: { fontSize: '.62rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.75rem', padding: '0 2rem 2rem', overflowY: 'auto', flex: 1 },
  noCards: { gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem', fontStyle: 'italic', padding: '2rem 0' },
  cardThumb: { position: 'relative', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', aspectRatio: '3/4', transition: 'transform .3s ease', boxShadow: '0 4px 16px rgba(0,0,0,.5)' },
  cardThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardThumbOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(8,6,4,.95) 0%,rgba(8,6,4,.3) 60%,transparent 100%)' },
  cardThumbContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '.6rem .7rem' },
  cardThumbDate: { fontSize: '.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', opacity: .8, marginBottom: '.2rem' },
  cardThumbTitle: { fontFamily: "'Playfair Display', serif", fontSize: '.78rem', lineHeight: 1.2, color: 'var(--text)' },
};