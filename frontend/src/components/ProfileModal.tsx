'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, User, Profile } from '@/types';
import { profiles, follows } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getZodiacSign, getDailyHoroscope, getCompatibility, ZODIAC_SIGNS } from '@/lib/zodiac';

const CLOUDINARY_CLOUD  = 'dky9pzz0r';
const CLOUDINARY_PRESET = 'constellation_uploads';

const REACTION_EMOJIS: Record<string, string> = {
  touched:   '🌸',
  magical:   '💫',
  brilliant: '🌟',
  beautiful: '⭐',
  dreamy:    '🌙',
  powerful:  '☄️',
};

const thumbShimmerStyle = `
@keyframes starPop {
  0%   { opacity: 0; transform: scale(0); }
  60%  { opacity: 1; transform: scale(1.4); }
  100% { opacity: .7; transform: scale(1); }
}
@keyframes thumbShimmerMove {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.thumb-shimmer {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border-radius: 12px;
  background: linear-gradient(
    105deg,
    rgba(201,168,76,0) 30%,
    rgba(201,168,76,.15) 48%,
    rgba(255,220,120,.22) 52%,
    rgba(201,168,76,0) 70%
  );
  background-size: 200% 100%;
  animation: thumbShimmerMove 3.5s ease-in-out infinite;
  transition: opacity .3s ease;
}
`;

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
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [cards, setCards]                   = useState<Card[]>([]);
  const [loading, setLoading]               = useState(false);
  const [isEditing, setIsEditing]           = useState(false);
  const [editName, setEditName]             = useState('');
  const [editBio, setEditBio]               = useState('');
  const [editBirthday, setEditBirthday]     = useState('');
  const [editBirthdayPublic, setEditBirthdayPublic] = useState(true);
  const [avatarPreview, setAvatarPreview]   = useState('');
  const [uploading, setUploading]           = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [horoscope, setHoroscope]           = useState('');
  const [horoscopeLoading, setHoroscopeLoading] = useState(false);
  const [activeTab, setActiveTab]           = useState<'verses' | 'horoscope'>('verses');
  const [hoveredCard, setHoveredCard]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !!currentUser && currentUser.username === username;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setProfile(null);
    setCards([]);
    setIsEditing(false);
    setHoroscope('');
    setActiveTab('verses');

    profiles.get(username)
    .then(data => {
      if (!data) return;
      setProfile(data.profile);
      setCards(data.cards);
      setEditName(data.profile.display_name || '');
      setEditBio(data.profile.bio || '');
      setEditBirthday(data.profile.birthday || '');
      setEditBirthdayPublic(data.profile.birthday_public ?? true);
      setAvatarPreview(data.profile.avatar_url || '');
    })
    .catch(() => toast('Could not load profile'))
    .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (activeTab !== 'horoscope' || !profile?.zodiac_sign) return;
    setHoroscopeLoading(true);
    getDailyHoroscope(profile.zodiac_sign)
      .then(text => setHoroscope(text))
      .finally(() => setHoroscopeLoading(false));
  }, [activeTab, profile?.zodiac_sign]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!username) return null;

  const zodiac = profile?.zodiac_sign
    ? getZodiacSign(profile.birthday || '') ?? ZODIAC_SIGNS.find(z => z.sign === profile.zodiac_sign) ?? null
    : null;
  const currentUserZodiac = currentUser?.birthday ? getZodiacSign(currentUser.birthday) : null;
  const compatibility = zodiac && currentUserZodiac && !isOwnProfile
    ? getCompatibility(currentUserZodiac.sign, zodiac.sign)
    : null;

  const totalVerses    = cards.length;
  const totalReactions = cards.reduce((sum, c) => sum + (c.reaction_count ?? c.hearts ?? 0), 0);
  const overallReactionCounts = cards.reduce<Record<string, number>>((acc, card) => {
    const counts = card.reaction_counts ?? {};
    Object.entries(counts).forEach(([type, count]) => {
      acc[type] = (acc[type] ?? 0) + (count as number);
    });
    return acc;
  }, {});
  const overallActive = Object.entries(overallReactionCounts).filter(([, v]) => v > 0);
  const previewZodiac = editBirthday ? getZodiacSign(editBirthday) : null;

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
    } catch { toast('Avatar upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const zodiacFromBirthday = editBirthday ? getZodiacSign(editBirthday) : null;
      await updateProfile({
        display_name:    editName.trim(),
        bio:             editBio.trim(),
        avatar_url:      avatarPreview || undefined,
        birthday:        editBirthday || undefined,
        zodiac_sign:     zodiacFromBirthday?.sign || undefined,
        birthday_public: editBirthdayPublic,
      });
      setProfile(prev => prev ? {
        ...prev,
        display_name:    editName.trim(),
        bio:             editBio.trim(),
        avatar_url:      avatarPreview,
        birthday:        editBirthday,
        zodiac_sign:     zodiacFromBirthday?.sign || prev.zodiac_sign,
        birthday_public: editBirthdayPublic,
      } : prev);
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

  function getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg,#c9a84c,#8b6914)',
      'linear-gradient(135deg,#6a9fc0,#2e6085)',
      'linear-gradient(135deg,#9c6ab5,#5c3570)',
      'linear-gradient(135deg,#e07070,#9c2020)',
      'linear-gradient(135deg,#70b870,#2a6e2a)',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  }

  function FollowButton({ username, currentUser, toast, onFollowChange }: {
    username: string;
    currentUser: User;
    toast: (msg: string) => void;
    onFollowChange: (isFollowing: boolean) => void;
  }) {
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading]         = useState(false);
    const [checked, setChecked]         = useState(false);

    useEffect(() => {
      follows.status(username)
      .then(data => { 
        if (!data) return;
        setIsFollowing(data.is_following); 
        setChecked(true); 
      })
      .catch(() => setChecked(true));
    }, [username]);

    async function handleToggle() {
      setLoading(true);
      try {
        const res = await follows.toggle(username);
        if (!res) return;
        const nowFollowing = res.action === 'followed';
        setIsFollowing(nowFollowing);
        onFollowChange(nowFollowing);
        toast(nowFollowing ? `Following @${username} ✦` : `Unfollowed @${username}`);
      } catch { toast('Failed to update follow'); }
      finally { setLoading(false); }
    }

    if (!checked) return null;

    return (
      <button
        style={{
          padding: '.3rem .9rem',
          borderRadius: '50px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isFollowing ? 'rgba(255,255,255,.15)' : 'rgba(201,168,76,.4)',
          background: isFollowing ? 'rgba(255,255,255,.05)' : 'rgba(201,168,76,.12)',
          color: isFollowing ? 'var(--text-muted)' : 'var(--gold)',
          cursor: 'pointer',
          fontSize: '.75rem',
          fontFamily: "'DM Sans', sans-serif",
          transition: 'all .25s',
          opacity: loading ? 0.6 : 1,
        }}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? '…' : isFollowing ? 'Following ✓' : '+ Follow'}
      </button>
    );
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
          <div style={s.scroll}>

            {/* ── Profile Header ── */}
            <div style={s.profileHeader}>
              {/* Avatar */}
              <div style={s.avatarWrap}>
                {avatarPreview || profile.avatar_url ? (
                  <img src={avatarPreview || profile.avatar_url} alt={profile.display_name} style={s.avatar} />
                ) : (
                  <div style={{ ...s.avatarFallback, background: getAvatarColor(profile.display_name) }}>
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                {isOwnProfile && isEditing && (
                  <button style={s.avatarEditBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? '⏳' : '📷'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

                {/* Zodiac badge */}
                {zodiac && !isEditing && (
                  <div style={{ ...s.zodiacBadge, background: zodiac.color + '33', borderColor: zodiac.color + '66', color: zodiac.color }}>
                    {zodiac.symbol}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={s.profileInfo}>
                {isEditing ? (
                  <div style={s.editForm}>
                    <input style={s.editInput} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Display name" maxLength={50} />
                    <textarea style={{ ...s.editInput, minHeight: '55px', resize: 'vertical' as const }} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Write a short bio…" maxLength={200} />

                    {/* Birthday */}
                    <div>
                      <label style={s.editLabel}>🎂 Birthday</label>
                      <input style={s.editInput} type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} />
                      {previewZodiac && (
                        <div style={{ ...s.zodiacPreview, borderColor: previewZodiac.color + '44' }}>
                          <span style={{ fontSize: '1.2rem' }}>{previewZodiac.symbol}</span>
                          <div>
                            <div style={{ fontSize: '.8rem', color: previewZodiac.color, fontWeight: 600 }}>{previewZodiac.sign}</div>
                            <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{previewZodiac.element} {previewZodiac.elementEmoji} · {previewZodiac.dateRange}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Birthday public toggle */}
                    <div style={s.toggleRow}>
                      <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Show birthday publicly</span>
                      <div
                        style={{ ...s.toggleTrack, background: editBirthdayPublic ? 'rgba(201,168,76,.35)' : 'rgba(255,255,255,.1)' }}
                        onClick={() => setEditBirthdayPublic(p => !p)}
                      >
                        <div style={{ ...s.toggleThumb, transform: editBirthdayPublic ? 'translateX(17px)' : 'translateX(0)' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem' }}>
                      <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '✦ Save'}</button>
                      <button style={s.cancelBtn} onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 style={s.displayName}>{profile.display_name}</h2>
                    <p style={s.usernameText}>@{profile.username}</p>

                    {/* Follow stats + button */}
                    {!isEditing && (
                      <div style={s.followRow}>
                        <span style={s.followStat}>
                          <strong>{profile.followers_count ?? 0}</strong> followers
                        </span>
                        <span style={s.statDot}>·</span>
                        <span style={s.followStat}>
                          <strong>{profile.following_count ?? 0}</strong> following
                        </span>
                        {!isOwnProfile && currentUser && (
                          <FollowButton
                            username={profile.username}
                            currentUser={currentUser}
                            toast={toast}
                            onFollowChange={(isFollowing) => {
                              setProfile(prev => prev ? {
                                ...prev,
                                followers_count: (prev.followers_count ?? 0) + (isFollowing ? 1 : -1)
                              } : prev);
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Zodiac row */}
                    {zodiac && (
                      <div style={{ ...s.zodiacRow, borderColor: zodiac.color + '33' }}>
                        <span style={{ fontSize: '1rem' }}>{zodiac.symbol}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: '.78rem', color: zodiac.color, fontWeight: 600 }}>{zodiac.sign}</span>
                          <span style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>{zodiac.element} {zodiac.elementEmoji}</span>
                          {zodiac.traits.map(t => (
                            <span key={t} style={{ ...s.traitPill, borderColor: zodiac.color + '44', color: zodiac.color }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Birthday */}
                    {profile.birthday && profile.birthday_public && (
                      <p style={s.birthday}>
                        🎂 {new Date(profile.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </p>
                    )}

                    {profile.bio && <p style={s.bio}>{profile.bio}</p>}

                    {/* Stats */}
                    <div style={s.statsRow}>
                      <span style={s.stat}><strong>{totalVerses}</strong> {totalVerses === 1 ? 'verse' : 'verses'}</span>
                      <span style={s.statDot}>·</span>
                      <span style={s.stat}>joined {new Date(profile.created_at || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    </div>

                    {/* Overall reactions */}
                    {overallActive.length > 0 && (
                      <div style={s.overallReactions}>
                        {overallActive.map(([type, count]) => (
                          <span key={type} style={s.overallPill}>
                            <span style={{ fontSize: '.75rem' }}>{REACTION_EMOJIS[type] ?? '✦'}</span>
                            {count}
                          </span>
                        ))}
                        <span style={s.totalBadge}>{totalReactions} total</span>
                      </div>
                    )}

                    {/* Compatibility */}
                    {compatibility && (
                      <div style={{ ...s.compatBox, borderColor: compatibility.color + '44' }}>
                        <div style={s.compatHeader}>
                          <span style={{ fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }}>✦ Compatibility</span>
                          <span style={{ fontSize: '.8rem', color: compatibility.color, fontWeight: 600 }}>{compatibility.label}</span>
                        </div>
                        <div style={s.compatBar}>
                          <div style={{ ...s.compatFill, width: `${compatibility.score}%`, background: compatibility.color }} />
                        </div>
                        <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>{compatibility.description}</p>
                      </div>
                    )}

                    {isOwnProfile && (
                      <button style={s.editProfileBtn} onClick={() => setIsEditing(true)}>✎ Edit Profile</button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Tabs ── */}
            {!isEditing && (
              <div style={s.tabs}>
                <button style={{ ...s.tab, ...(activeTab === 'verses' ? s.tabActive : {}) }} onClick={() => setActiveTab('verses')}>
                  ✦ Verses ({totalVerses})
                </button>
                {profile.zodiac_sign && (
                  <button style={{ ...s.tab, ...(activeTab === 'horoscope' ? s.tabActive : {}) }} onClick={() => setActiveTab('horoscope')}>
                    {zodiac?.symbol} Today's Horoscope
                  </button>
                )}
              </div>
            )}

            {/* ── Verses Tab ── */}
            {activeTab === 'verses' && !isEditing && (
              <div style={s.cardsGrid}>
                {cards.length === 0 ? (
                  <p style={s.noCards}>No verses yet.</p>
                ) : (
                  cards.map(card => {
                    const counts = card.reaction_counts ?? {};
                    const activeReactions = Object.entries(counts).filter(([, v]) => v > 0);
                    const total = card.reaction_count ?? activeReactions.reduce((s, [, v]) => s + v, 0) ?? 0;
                    const isHovered = hoveredCard === card.id;

                    return (
                      <div
                        key={card.id}
                        style={{
                          ...s.cardThumb,
                          transform: isHovered ? 'translateY(-4px) scale(1.03)' : 'translateY(0) scale(1)',
                          boxShadow: isHovered
                            ? '0 16px 40px rgba(0,0,0,.7), 0 0 0 1px rgba(201,168,76,.4)'
                            : '0 4px 16px rgba(0,0,0,.5)',
                        }}
                        onMouseEnter={() => setHoveredCard(card.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                        onClick={() => { onCardClick(card); onClose(); }}
                      >
                        <style>{thumbShimmerStyle}</style>
                        <img src={getImageSrc(card.image_url)} alt={card.title} style={s.cardThumbImg} />
                        <div style={s.cardThumbOverlay} />
                        <div className="thumb-shimmer" style={{ opacity: isHovered ? 1 : 0 }} />

                        {isHovered && (
                          <div style={s.starField}>
                            {['10% 20%','80% 15%','25% 70%','70% 60%','50% 40%','90% 80%','15% 85%'].map((pos, i) => (
                              <div key={i} style={{ ...s.star, top: pos.split(' ')[1], left: pos.split(' ')[0], animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                        )}

                        <div style={s.cardThumbStats}>
                          {activeReactions.length > 0 ? (
                            activeReactions.map(([type, count]) => (
                              <span key={type} style={s.cardThumbPill}>
                                <span style={{ fontSize: '.6rem' }}>{REACTION_EMOJIS[type] ?? '✦'}</span>
                                {count}
                              </span>
                            ))
                          ) : (
                            <span style={{ ...s.cardThumbPill, opacity: .5 }}>✦ {total}</span>
                          )}
                        </div>

                        <div style={s.cardThumbContent}>
                          <div style={s.cardThumbDate}>{card.display_date}</div>
                          <div style={s.cardThumbTitle}>{card.title}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Horoscope Tab ── */}
            {activeTab === 'horoscope' && zodiac && !isEditing && (
              <div style={s.horoscopeSection}>

                {/* Sign hero */}
                <div style={{ ...s.signHero, background: `linear-gradient(135deg,${zodiac.color}22,${zodiac.color}11)`, borderColor: zodiac.color + '33' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(201,168,76,.15), rgba(139,105,20,.1))',
                    border: '1px solid rgba(201,168,76,.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    color: 'var(--gold)',
                    boxShadow: '0 0 20px rgba(201,168,76,.15), inset 0 1px 0 rgba(201,168,76,.2)',
                    flexShrink: 0,
                  }}>
                    {zodiac.symbol}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontFamily: "'Playfair Display', serif", color: zodiac.color }}>{zodiac.sign}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{zodiac.constellation} · {zodiac.dateRange}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>{zodiac.element} Sign {zodiac.elementEmoji}</div>
                  </div>
                </div>

                {/* Daily horoscope */}
                <div style={s.horoscopeCard}>
                  <div style={s.horoscopeHeader}>
                    <span style={s.horoscopeTitle}>✦ Today's Reading</span>
                    <span style={s.horoscopeDate}>
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  {horoscopeLoading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '.5rem' }}>✦</div>
                      <p style={{ fontSize: '.78rem' }}>Reading the stars…</p>
                    </div>
                  ) : horoscope ? (
                    <p style={s.horoscopeText}>{horoscope}</p>
                  ) : (
                    <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      The stars are quiet today. Check back later.
                    </p>
                  )}
                </div>

                {/* Traits */}
                <div style={s.traitsSection}>
                  <p style={s.sectionTitle}>✦ Key Traits</p>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' as const }}>
                    {zodiac.traits.map(t => (
                      <span key={t} style={{ ...s.traitPillLarge, borderColor: zodiac.color + '55', color: zodiac.color, background: zodiac.color + '11' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Compatibility grid (own profile) */}
                {isOwnProfile && (
                  <div style={s.traitsSection}>
                    <p style={s.sectionTitle}>✦ Compatibility with All Signs</p>
                    <div style={s.compatGrid}>
                      {ZODIAC_SIGNS.map(z => {
                        const compat = getCompatibility(zodiac.sign, z.sign);
                        return (
                          <div key={z.sign} style={{ ...s.compatItem, borderColor: compat.color + '33' }}>
                            <span style={{ 
                              fontSize: '1.1rem', 
                              color: 'var(--gold)',
                              filter: 'drop-shadow(0 0 4px rgba(201,168,76,.4))'
                            }}>
                              {z.symbol}
                            </span>
                            <span style={{ fontSize: '.6rem', color: 'var(--text-muted)' }}>{z.sign}</span>
                            <div style={s.compatMiniBar}>
                              <div style={{ ...s.compatMiniFill, width: `${compat.score}%`, background: compat.color }} />
                            </div>
                            <span style={{ fontSize: '.58rem', color: compat.color }}>{compat.score}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  followRow: { display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem', flexWrap: 'wrap' as const },
  followStat: { fontSize: '.75rem', color: 'var(--text-muted)' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' },
  modal: { background: 'var(--dark2)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.2)', borderRadius: '24px', maxWidth: '700px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' },
  scroll: { overflowY: 'auto', flex: 1 },
  closeBtn: { position: 'absolute', top: '.8rem', right: '.8rem', width: '34px', height: '34px', borderRadius: '50%', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.15)', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: '.8rem', zIndex: 5 },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' },
  profileHeader: { display: 'flex', gap: '1.5rem', padding: '2rem 2rem 1rem', alignItems: 'flex-start' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '85px', height: '85px', borderRadius: '50%', objectFit: 'cover', borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.3)' },
  avatarFallback: { width: '85px', height: '85px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: '#fff', borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.3)' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,0,0,.8)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.3)', cursor: 'pointer', fontSize: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  zodiacBadge: { position: 'absolute', top: '-4px', left: '-4px', width: '26px', height: '26px', borderRadius: '50%', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.82rem', fontWeight: 700 },
  profileInfo: { flex: 1, minWidth: 0 },
  displayName: { fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', marginBottom: '.15rem' },
  usernameText: { fontSize: '.78rem', color: 'var(--gold)', marginBottom: '.5rem' },
  zodiacRow: { display: 'flex', alignItems: 'center', gap: '.5rem', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent', borderRadius: '10px', padding: '.45rem .7rem', marginBottom: '.5rem', flexWrap: 'wrap' as const },
  traitPill: { fontSize: '.58rem', padding: '.12rem .45rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent' },
  traitPillLarge: { fontSize: '.75rem', padding: '.3rem .75rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent' },
  birthday: { fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '.4rem' },
  bio: { fontSize: '.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '.5rem' },
  statsRow: { display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem', flexWrap: 'wrap' as const },
  stat: { fontSize: '.75rem', color: 'var(--text-muted)' },
  statDot: { color: 'var(--text-muted)', fontSize: '.75rem' },
  overallReactions: { display: 'flex', alignItems: 'center', gap: '.35rem', flexWrap: 'wrap' as const, marginBottom: '.6rem' },
  overallPill: { display: 'inline-flex', alignItems: 'center', gap: '.25rem', background: 'rgba(201,168,76,.08)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.2)', borderRadius: '50px', padding: '.18rem .5rem', fontSize: '.72rem', color: 'var(--text)' },
  totalBadge: { fontSize: '.65rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  compatBox: { background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent', borderRadius: '12px', padding: '.7rem .9rem', marginBottom: '.65rem' },
  compatHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.35rem' },
  compatBar: { height: '5px', background: 'rgba(255,255,255,.08)', borderRadius: '50px', overflow: 'hidden' },
  compatFill: { height: '100%', borderRadius: '50px', transition: 'width .6s ease' },
  editProfileBtn: { padding: '.35rem .9rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: '.75rem', fontFamily: "'DM Sans', sans-serif" },
  editForm: { display: 'flex', flexDirection: 'column', gap: '.45rem' },
  editLabel: { fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '.2rem' },
  editInput: { width: '100%', background: 'rgba(255,255,255,.04)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.15)', borderRadius: '9px', padding: '.55rem .8rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' as const },
  zodiacPreview: { display: 'flex', alignItems: 'center', gap: '.6rem', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent', borderRadius: '8px', padding: '.4rem .7rem', marginTop: '.35rem' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.06)', borderRadius: '8px', padding: '.45rem .7rem' },
  toggleTrack: { width: '38px', height: '21px', borderRadius: '50px', cursor: 'pointer', position: 'relative', transition: 'background .25s', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.15)', flexShrink: 0 },
  toggleThumb: { width: '15px', height: '15px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: '2px', transition: 'transform .25s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' },
  saveBtn: { padding: '.4rem 1rem', borderRadius: '50px', borderWidth: '0', borderStyle: 'solid', borderColor: 'transparent', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif" },
  cancelBtn: { padding: '.4rem 1rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.15)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif" },
  tabs: { display: 'flex', gap: '.5rem', padding: '1rem 2rem 1rem', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgba(201,168,76,.08)' },
  tab: { padding: '.4rem .9rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.1)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.75rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  tabActive: { background: 'rgba(201,168,76,.12)', borderColor: 'rgba(201,168,76,.35)', color: 'var(--gold)' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.75rem', padding: '0 2rem 2rem' },
  noCards: { gridColumn: '1/-1', textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '.82rem', fontStyle: 'italic', padding: '2rem 0' },
  cardThumb: { position: 'relative', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', aspectRatio: '3/4', transition: 'transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease' },
  starField: { position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' },
  star: { position: 'absolute', width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(201,168,76,.9)', boxShadow: '0 0 4px rgba(201,168,76,.8)', animation: 'starPop .4s ease forwards', opacity: 0 },
  cardThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardThumbOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(8,6,4,.95) 0%,rgba(8,6,4,.3) 60%,transparent 100%)' },
  cardThumbStats: { position: 'absolute', top: '.35rem', left: '.35rem', zIndex: 5, display: 'flex', gap: '.2rem', flexWrap: 'wrap' as const, maxWidth: '90%' },
  cardThumbPill: { display: 'inline-flex', alignItems: 'center', gap: '.2rem', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.12)', borderRadius: '50px', padding: '.15rem .4rem', fontSize: '.6rem', color: 'rgba(255,255,255,.85)' },
  cardThumbContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '.6rem .7rem' },
  cardThumbDate: { fontSize: '.55rem', letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--gold)', opacity: .8, marginBottom: '.2rem' },
  cardThumbTitle: { fontFamily: "'Playfair Display', serif", fontSize: '.78rem', lineHeight: 1.2, color: 'var(--text)' },
  horoscopeSection: { padding: '0 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '.9rem' },
  signHero: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.2rem', borderRadius: '14px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent' },
  horoscopeCard: { background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.12)', borderRadius: '14px', padding: '1.2rem' },
  horoscopeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.8rem' },
  horoscopeTitle: { fontSize: '.68rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: 'var(--gold)' },
  horoscopeDate: { fontSize: '.68rem', color: 'var(--text-muted)' },
  horoscopeText: { fontSize: '.88rem', color: 'var(--text)', lineHeight: 1.8, fontStyle: 'italic' },
  traitsSection: { background: 'rgba(255,255,255,.02)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.06)', borderRadius: '14px', padding: '1rem' },
  sectionTitle: { fontSize: '.68rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: 'var(--gold)', marginBottom: '.75rem' },
  compatGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.45rem', marginTop: '.5rem' },
  compatItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent', borderRadius: '10px', padding: '.5rem .3rem' },
  compatMiniBar: { width: '100%', height: '4px', background: 'rgba(255,255,255,.08)', borderRadius: '50px', overflow: 'hidden' },
  compatMiniFill: { height: '100%', borderRadius: '50px' },
};