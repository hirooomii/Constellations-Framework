'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, User, Profile } from '@/types';
import { profiles, follows } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getZodiacSign, getDailyHoroscope, getCompatibility, ZODIAC_SIGNS } from '@/lib/zodiac';

const CLOUDINARY_CLOUD  = 'dky9pzz0r';
const CLOUDINARY_PRESET = 'constellation_uploads';
const CARDS_PER_PAGE    = 9;

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

interface FollowUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
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
  const [cardPage, setCardPage]             = useState(1);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList]         = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
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
    setCardPage(1);
    setFollowListType(null);

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

  async function loadFollowList(type: 'followers' | 'following') {
    if (!profile) return;
    setFollowListType(type);
    setFollowListLoading(true);
    setFollowList([]);
    try {
      const data = type === 'followers'
        ? await follows.followers(profile.username)
        : await follows.following(profile.username);
      if (data) setFollowList(data.users);
    } catch {}
    setFollowListLoading(false);
  }

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

  const totalPages     = Math.ceil(cards.length / CARDS_PER_PAGE);
  const paginatedCards = cards.slice((cardPage - 1) * CARDS_PER_PAGE, cardPage * CARDS_PER_PAGE);

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
          padding: '.3rem 1.1rem', borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid',
          borderColor: isFollowing ? 'rgba(255,255,255,.15)' : 'rgba(201,168,76,.4)',
          background: isFollowing ? 'rgba(255,255,255,.05)' : 'rgba(201,168,76,.12)',
          color: isFollowing ? 'var(--text-muted)' : 'var(--gold)',
          cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif",
          transition: 'all .25s', opacity: loading ? 0.6 : 1, fontWeight: 500,
        }}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? '…' : isFollowing ? 'Following ✓' : '+ Follow'}
      </button>
    );
  }

  // ── Follow List View ──
  if (followListType) {
    return (
      <div style={s.backdrop} onClick={e => e.target === e.currentTarget && setFollowListType(null)}>
        <div style={s.modal}>
          <button style={s.closeBtn} onClick={() => setFollowListType(null)}>✕</button>
          <div style={{ padding: '1.25rem 1.5rem .75rem', borderBottom: '1px solid rgba(201,168,76,.1)', textAlign: 'center' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', margin: 0 }}>
              {followListType === 'followers' ? 'Followers' : 'Following'}
            </h3>
            <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>@{profile?.username}</p>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '.5rem .75rem' }}>
            {followListLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.2rem' }}>✦</div>
                <p style={{ fontSize: '.75rem', marginTop: '.5rem' }}>Loading…</p>
              </div>
            ) : followList.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.8rem', padding: '2rem 0', fontStyle: 'italic' }}>
                {followListType === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </p>
            ) : (
              followList.map(u => (
                <div key={u.id} style={s.followListRow}>
                  <div style={s.followListAvatarBtn}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.display_name} style={s.followListAvatar as React.CSSProperties} />
                    ) : (
                      <div style={{ ...s.followListAvatar, background: getAvatarColor(u.display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.9rem', fontWeight: 700, color: '#fff' } as React.CSSProperties}>
                        {u.display_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={s.followListInfo}>
                    <span style={{ fontSize: '.85rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{u.display_name}</span>
                    <span style={{ fontSize: '.7rem', color: 'var(--gold)', opacity: .7 }}>@{u.username}</span>
                  </div>
                  {currentUser && currentUser.username !== u.username && (
                    <FollowButton
                      username={u.username}
                      currentUser={currentUser}
                      toast={toast}
                      onFollowChange={() => {}}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
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

            {/* ── Instagram-style Profile Header ── */}
            <div style={s.profileHeader}>

              {/* Top row: avatar + stats */}
              <div style={s.profileTopRow}>
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
                  {zodiac && !isEditing && (
                    <div style={{ ...s.zodiacBadge, background: zodiac.color + '33', borderColor: zodiac.color + '66', color: zodiac.color }}>
                      {zodiac.symbol}
                    </div>
                  )}
                </div>

                {/* Stats — Instagram style */}
                {!isEditing && (
                  <div style={s.statsBlock}>
                    <div style={s.statItem}>
                      <strong style={s.statNum}>{totalVerses}</strong>
                      <span style={s.statLabel}>verses</span>
                    </div>
                    <button style={s.statItemBtn} onClick={() => loadFollowList('followers')}>
                      <strong style={s.statNum}>{profile.followers_count ?? 0}</strong>
                      <span style={s.statLabel}>followers</span>
                    </button>
                    <button style={s.statItemBtn} onClick={() => loadFollowList('following')}>
                      <strong style={s.statNum}>{profile.following_count ?? 0}</strong>
                      <span style={s.statLabel}>following</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Name + username */}
              <h2 style={s.displayName}>{profile.display_name}</h2>
              <p style={s.usernameText}>@{profile.username}</p>

              {/* Zodiac inline */}
              {zodiac && !isEditing && (
                <div style={s.zodiacInline}>
                  <span style={{ color: zodiac.color, fontSize: '.72rem', fontWeight: 600 }}>{zodiac.symbol} {zodiac.sign}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>· {zodiac.element} {zodiac.elementEmoji}</span>
                  {zodiac.traits.slice(0, 2).map(t => (
                    <span key={t} style={{ ...s.traitPill, borderColor: zodiac.color + '44', color: zodiac.color }}>{t}</span>
                  ))}
                </div>
              )}

              {/* Birthday */}
              {profile.birthday && profile.birthday_public && !isEditing && (
                <p style={s.birthday}>
                  🎂 {new Date(profile.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
              )}

              {/* Bio */}
              {profile.bio && !isEditing && <p style={s.bio}>{profile.bio}</p>}

              {/* Reactions compact */}
              {overallActive.length > 0 && !isEditing && (
                <div style={s.overallReactions}>
                  {overallActive.map(([type, count]) => (
                    <span key={type} style={s.overallPill}>
                      <span style={{ fontSize: '.72rem' }}>{REACTION_EMOJIS[type] ?? '✦'}</span>{count}
                    </span>
                  ))}
                  <span style={s.totalBadge}>{totalReactions} total</span>
                </div>
              )}

              {/* Action buttons */}
              {!isEditing && (
                <div style={s.actionRow}>
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
                  {isOwnProfile && (
                    <button style={s.editProfileBtn} onClick={() => setIsEditing(true)}>✎ Edit Profile</button>
                  )}
                </div>
              )}

              {/* Compatibility */}
              {compatibility && !isEditing && (
                <div style={{ ...s.compatBox, borderColor: compatibility.color + '44' }}>
                  <div style={s.compatHeader}>
                    <span style={{ fontSize: '.65rem', color: 'var(--text-muted)', letterSpacing: '.08em' }}>✦ Compatibility</span>
                    <span style={{ fontSize: '.75rem', color: compatibility.color, fontWeight: 600 }}>{compatibility.label} · {compatibility.score}%</span>
                  </div>
                  <div style={s.compatBar}>
                    <div style={{ ...s.compatFill, width: `${compatibility.score}%`, background: compatibility.color }} />
                  </div>
                  <p style={{ fontSize: '.68rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>{compatibility.description}</p>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div style={{ ...s.editForm, width: '100%', marginTop: '.5rem' }}>
                  <input style={s.editInput} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Display name" maxLength={50} />
                  <textarea style={{ ...s.editInput, minHeight: '55px', resize: 'vertical' as const }} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Write a short bio…" maxLength={200} />
                  <div>
                    <label style={s.editLabel}>🎂 Birthday</label>
                    <input style={s.editInput} type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} />
                    {previewZodiac && (
                      <div style={{ ...s.zodiacPreview, borderColor: previewZodiac.color + '44' }}>
                        <span style={{ fontSize: '1.1rem' }}>{previewZodiac.symbol}</span>
                        <div>
                          <div style={{ fontSize: '.78rem', color: previewZodiac.color, fontWeight: 600 }}>{previewZodiac.sign}</div>
                          <div style={{ fontSize: '.62rem', color: 'var(--text-muted)' }}>{previewZodiac.element} {previewZodiac.elementEmoji} · {previewZodiac.dateRange}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={s.toggleRow}>
                    <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Show birthday publicly</span>
                    <div style={{ ...s.toggleTrack, background: editBirthdayPublic ? 'rgba(201,168,76,.35)' : 'rgba(255,255,255,.1)' }} onClick={() => setEditBirthdayPublic(p => !p)}>
                      <div style={{ ...s.toggleThumb, transform: editBirthdayPublic ? 'translateX(17px)' : 'translateX(0)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', marginTop: '.25rem' }}>
                    <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '✦ Save'}</button>
                    <button style={s.cancelBtn} onClick={() => setIsEditing(false)}>Cancel</button>
                  </div>
                </div>
              )}
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
              <>
                <div style={s.cardsGrid}>
                  {cards.length === 0 ? (
                    <p style={s.noCards}>No verses yet.</p>
                  ) : (
                    paginatedCards.map(card => {
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={s.pagination}>
                    <button
                      style={{ ...s.pageBtn, ...(cardPage === 1 ? s.pageBtnDisabled : {}) }}
                      onClick={() => setCardPage(p => Math.max(1, p - 1))}
                      disabled={cardPage === 1}
                    >← Prev</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        style={{ ...s.pageBtn, ...(cardPage === p ? s.pageBtnActive : {}) }}
                        onClick={() => setCardPage(p)}
                      >{p}</button>
                    ))}
                    <button
                      style={{ ...s.pageBtn, ...(cardPage === totalPages ? s.pageBtnDisabled : {}) }}
                      onClick={() => setCardPage(p => Math.min(totalPages, p + 1))}
                      disabled={cardPage === totalPages}
                    >Next →</button>
                  </div>
                )}
              </>
            )}

            {/* ── Horoscope Tab ── */}
            {activeTab === 'horoscope' && zodiac && !isEditing && (
              <div style={s.horoscopeSection}>
                <div style={{ ...s.signHero, background: `linear-gradient(135deg,${zodiac.color}22,${zodiac.color}11)`, borderColor: zodiac.color + '33' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(201,168,76,.15), rgba(139,105,20,.1))', border: '1px solid rgba(201,168,76,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--gold)', flexShrink: 0 }}>
                    {zodiac.symbol}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontFamily: "'Playfair Display', serif", color: zodiac.color }}>{zodiac.sign}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{zodiac.constellation} · {zodiac.dateRange}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>{zodiac.element} Sign {zodiac.elementEmoji}</div>
                  </div>
                </div>

                <div style={s.horoscopeCard}>
                  <div style={s.horoscopeHeader}>
                    <span style={s.horoscopeTitle}>✦ Today's Reading</span>
                    <span style={s.horoscopeDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                  </div>
                  {horoscopeLoading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '.5rem' }}>✦</div>
                      <p style={{ fontSize: '.78rem' }}>Reading the stars…</p>
                    </div>
                  ) : horoscope ? (
                    <p style={s.horoscopeText}>{horoscope}</p>
                  ) : (
                    <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>The stars are quiet today. Check back later.</p>
                  )}
                </div>

                <div style={s.traitsSection}>
                  <p style={s.sectionTitle}>✦ Key Traits</p>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' as const }}>
                    {zodiac.traits.map(t => (
                      <span key={t} style={{ ...s.traitPillLarge, borderColor: zodiac.color + '55', color: zodiac.color, background: zodiac.color + '11' }}>{t}</span>
                    ))}
                  </div>
                </div>

                {isOwnProfile && (
                  <div style={s.traitsSection}>
                    <p style={s.sectionTitle}>✦ Compatibility with All Signs</p>
                    <div style={s.compatGrid}>
                      {ZODIAC_SIGNS.map(z => {
                        const compat = getCompatibility(zodiac.sign, z.sign);
                        return (
                          <div key={z.sign} style={{ ...s.compatItem, borderColor: compat.color + '33' }}>
                            <span style={{ fontSize: '1.1rem', color: 'var(--gold)', filter: 'drop-shadow(0 0 4px rgba(201,168,76,.4))' }}>{z.symbol}</span>
                            <span style={{ fontSize: '.6rem', color: 'var(--text-muted)' }}>{z.sign}</span>
                            <div style={s.compatMiniBar}><div style={{ ...s.compatMiniFill, width: `${compat.score}%`, background: compat.color }} /></div>
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
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(5,4,2,.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' },
  modal: { background: 'var(--dark2)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.2)', borderRadius: '24px', maxWidth: '680px', width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' },
  scroll: { overflowY: 'auto', flex: 1 },
  closeBtn: { position: 'absolute', top: '.8rem', right: '.8rem', width: '32px', height: '32px', borderRadius: '50%', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.15)', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', cursor: 'pointer', fontSize: '.75rem', zIndex: 5 },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' },

  // Instagram-style header
  profileHeader: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '1.25rem 1.25rem .75rem', gap: '.3rem' },
  profileTopRow: { display: 'flex', alignItems: 'center', width: '100%', gap: '1.5rem', marginBottom: '.4rem' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '78px', height: '78px', borderRadius: '50%', objectFit: 'cover', borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.35)' },
  avatarFallback: { width: '78px', height: '78px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', fontWeight: 700, color: '#fff', borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.35)' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0,0,0,.8)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.3)', cursor: 'pointer', fontSize: '.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  zodiacBadge: { position: 'absolute', top: '-3px', left: '-3px', width: '24px', height: '24px', borderRadius: '50%', borderWidth: '1px', borderStyle: 'solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700 },
  statsBlock: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.05rem' },
  statItemBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.05rem', background: 'none', border: 'none', cursor: 'pointer', padding: '.2rem .4rem', borderRadius: '8px', transition: 'background .2s' },
  statNum: { fontSize: '1.05rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontWeight: 700 },
  statLabel: { fontSize: '.62rem', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" },
  displayName: { fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', margin: '0' },
  usernameText: { fontSize: '.72rem', color: 'var(--gold)', margin: '0', opacity: .8 },
  zodiacInline: { display: 'flex', alignItems: 'center', gap: '.35rem', flexWrap: 'wrap' as const, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '8px', padding: '.28rem .6rem', marginTop: '.1rem' },
  traitPill: { fontSize: '.58rem', padding: '.1rem .4rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid' },
  traitPillLarge: { fontSize: '.75rem', padding: '.3rem .75rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent' },
  birthday: { fontSize: '.7rem', color: 'var(--text-muted)', margin: '0' },
  bio: { fontSize: '.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0' },
  overallReactions: { display: 'flex', alignItems: 'center', gap: '.3rem', flexWrap: 'wrap' as const, marginTop: '.1rem' },
  overallPill: { display: 'inline-flex', alignItems: 'center', gap: '.2rem', background: 'rgba(201,168,76,.08)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.2)', borderRadius: '50px', padding: '.15rem .45rem', fontSize: '.7rem', color: 'var(--text)' },
  totalBadge: { fontSize: '.62rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  actionRow: { display: 'flex', gap: '.5rem', marginTop: '.3rem' },
  editProfileBtn: { padding: '.3rem 1rem', borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.05)', color: 'var(--text)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  compatBox: { background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderRadius: '10px', padding: '.6rem .85rem', marginTop: '.35rem', width: '100%', boxSizing: 'border-box' as const },
  compatHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.3rem' },
  compatBar: { height: '4px', background: 'rgba(255,255,255,.08)', borderRadius: '50px', overflow: 'hidden' },
  compatFill: { height: '100%', borderRadius: '50px', transition: 'width .6s ease' },
  editForm: { display: 'flex', flexDirection: 'column', gap: '.4rem' },
  editLabel: { fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '.2rem' },
  editInput: { width: '100%', background: 'rgba(255,255,255,.04)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.15)', borderRadius: '9px', padding: '.55rem .8rem', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' as const },
  zodiacPreview: { display: 'flex', alignItems: 'center', gap: '.6rem', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderRadius: '8px', padding: '.4rem .7rem', marginTop: '.35rem' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.06)', borderRadius: '8px', padding: '.4rem .7rem' },
  toggleTrack: { width: '38px', height: '21px', borderRadius: '50px', cursor: 'pointer', position: 'relative', transition: 'background .25s', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.15)', flexShrink: 0 },
  toggleThumb: { width: '15px', height: '15px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: '2px', transition: 'transform .25s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' },
  saveBtn: { padding: '.4rem 1rem', borderRadius: '8px', borderWidth: '0', borderStyle: 'solid', borderColor: 'transparent', background: 'linear-gradient(135deg,var(--gold),#8b6914)', color: 'var(--dark)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 },
  cancelBtn: { padding: '.4rem 1rem', borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.15)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.78rem', fontFamily: "'DM Sans', sans-serif" },

  // Tabs
  tabs: { display: 'flex', gap: '.5rem', padding: '.75rem 1.25rem', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgba(201,168,76,.08)' },
  tab: { padding: '.35rem .85rem', borderRadius: '50px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.1)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.72rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  tabActive: { background: 'rgba(201,168,76,.12)', borderColor: 'rgba(201,168,76,.35)', color: 'var(--gold)' },

  // Cards grid
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem', padding: '0 1.25rem 1rem' },
  noCards: { gridColumn: '1/-1', textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '.82rem', fontStyle: 'italic', padding: '2rem 0' },
  cardThumb: { position: 'relative', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', aspectRatio: '3/4', transition: 'transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease' },
  starField: { position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' },
  star: { position: 'absolute', width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(201,168,76,.9)', boxShadow: '0 0 4px rgba(201,168,76,.8)', animation: 'starPop .4s ease forwards', opacity: 0 },
  cardThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardThumbOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(8,6,4,.95) 0%,rgba(8,6,4,.3) 60%,transparent 100%)' },
  cardThumbStats: { position: 'absolute', top: '.3rem', left: '.3rem', zIndex: 5, display: 'flex', gap: '.2rem', flexWrap: 'wrap' as const, maxWidth: '90%' },
  cardThumbPill: { display: 'inline-flex', alignItems: 'center', gap: '.2rem', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.12)', borderRadius: '50px', padding: '.12rem .35rem', fontSize: '.58rem', color: 'rgba(255,255,255,.85)' },
  cardThumbContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '.5rem .6rem' },
  cardThumbDate: { fontSize: '.5rem', letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--gold)', opacity: .8, marginBottom: '.15rem' },
  cardThumbTitle: { fontFamily: "'Playfair Display', serif", fontSize: '.72rem', lineHeight: 1.2, color: 'var(--text)' },

  // Pagination
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.35rem', padding: '.5rem 1.25rem 1.25rem', flexWrap: 'wrap' as const },
  pageBtn: { padding: '.28rem .7rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.7rem', fontFamily: "'DM Sans', sans-serif", transition: 'all .25s' },
  pageBtnActive: { background: 'rgba(201,168,76,.15)', borderColor: 'rgba(201,168,76,.4)', color: 'var(--gold)' },
  pageBtnDisabled: { opacity: .35, cursor: 'not-allowed' },

  // Horoscope
  horoscopeSection: { padding: '0 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '.75rem' },
  signHero: { display: 'flex', alignItems: 'center', gap: '.85rem', padding: '1rem', borderRadius: '12px', borderWidth: '1px', borderStyle: 'solid' },
  horoscopeCard: { background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(201,168,76,.12)', borderRadius: '12px', padding: '1rem' },
  horoscopeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.65rem' },
  horoscopeTitle: { fontSize: '.65rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: 'var(--gold)' },
  horoscopeDate: { fontSize: '.65rem', color: 'var(--text-muted)' },
  horoscopeText: { fontSize: '.85rem', color: 'var(--text)', lineHeight: 1.75, fontStyle: 'italic' },
  traitsSection: { background: 'rgba(255,255,255,.02)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,.06)', borderRadius: '12px', padding: '.85rem' },
  sectionTitle: { fontSize: '.65rem', letterSpacing: '.15em', textTransform: 'uppercase' as const, color: 'var(--gold)', marginBottom: '.65rem' },
  compatGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.4rem', marginTop: '.5rem' },
  compatItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem', background: 'rgba(255,255,255,.03)', borderWidth: '1px', borderStyle: 'solid', borderRadius: '10px', padding: '.45rem .25rem' },
  compatMiniBar: { width: '100%', height: '3px', background: 'rgba(255,255,255,.08)', borderRadius: '50px', overflow: 'hidden' },
  compatMiniFill: { height: '100%', borderRadius: '50px' },

  // Follow list
  followListRow: { display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.55rem .25rem', borderBottom: '1px solid rgba(255,255,255,.04)' },
  followListAvatarBtn: { flexShrink: 0 },
  followListAvatar: { width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,.2)' },
  followListInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '.08rem' },

  // Legacy
  profileInfo: { flex: 1, minWidth: 0 },
  statsRow: { display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' as const },
  stat: { fontSize: '.75rem', color: 'var(--text-muted)' },
  statDot: { color: 'var(--text-muted)', fontSize: '.75rem' },
  followRow: { display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' as const },
  followStat: { fontSize: '.75rem', color: 'var(--text-muted)' },
  followStatBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '.75rem', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif", padding: 0 },
};