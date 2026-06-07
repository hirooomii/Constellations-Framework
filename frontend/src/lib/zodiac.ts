export interface ZodiacSign {
  sign: string;
  symbol: string;
  emoji: string;
  constellation: string;
  element: string;
  elementEmoji: string;
  color: string;
  dateRange: string;
  traits: string[];
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    sign: 'Aries',
    symbol: '♈',
    emoji: '🐏',
    constellation: 'Aries',
    element: 'Fire',
    elementEmoji: '🔥',
    color: '#c9a84c',
    dateRange: 'Mar 21 – Apr 19',
    traits: ['Bold', 'Ambitious', 'Passionate'],
  },
  {
    sign: 'Taurus',
    symbol: '♉',
    emoji: '🐂',
    constellation: 'Taurus',
    element: 'Earth',
    elementEmoji: '🌍',
    color: '#d4af37',
    dateRange: 'Apr 20 – May 20',
    traits: ['Reliable', 'Patient', 'Devoted'],
  },
  {
    sign: 'Gemini',
    symbol: '♊',
    emoji: '👯',
    constellation: 'Gemini',
    element: 'Air',
    elementEmoji: '💨',
    color: '#e0c36a',
    dateRange: 'May 21 – Jun 20',
    traits: ['Curious', 'Adaptable', 'Witty'],
  },
  {
    sign: 'Cancer',
    symbol: '♋',
    emoji: '🦀',
    constellation: 'Cancer',
    element: 'Water',
    elementEmoji: '💧',
    color: '#b8902f',
    dateRange: 'Jun 21 – Jul 22',
    traits: ['Intuitive', 'Loyal', 'Empathetic'],
  },
  {
    sign: 'Leo',
    symbol: '♌',
    emoji: '🦁',
    constellation: 'Leo',
    element: 'Fire',
    elementEmoji: '🔥',
    color: '#f4d03f',
    dateRange: 'Jul 23 – Aug 22',
    traits: ['Confident', 'Creative', 'Generous'],
  },
  {
    sign: 'Virgo',
    symbol: '♍',
    emoji: '🌾',
    constellation: 'Virgo',
    element: 'Earth',
    elementEmoji: '🌍',
    color: '#c7a94d',
    dateRange: 'Aug 23 – Sep 22',
    traits: ['Analytical', 'Kind', 'Hardworking'],
  },
  {
    sign: 'Libra',
    symbol: '♎',
    emoji: '⚖️',
    constellation: 'Libra',
    element: 'Air',
    elementEmoji: '💨',
    color: '#d9b95a',
    dateRange: 'Sep 23 – Oct 22',
    traits: ['Diplomatic', 'Gracious', 'Fair'],
  },
  {
    sign: 'Scorpio',
    symbol: '♏',
    emoji: '🦂',
    constellation: 'Scorpius',
    element: 'Water',
    elementEmoji: '💧',
    color: '#a57c1b',
    dateRange: 'Oct 23 – Nov 21',
    traits: ['Brave', 'Resourceful', 'Passionate'],
  },
  {
    sign: 'Sagittarius',
    symbol: '♐',
    emoji: '🏹',
    constellation: 'Sagittarius',
    element: 'Fire',
    elementEmoji: '🔥',
    color: '#e6c766',
    dateRange: 'Nov 22 – Dec 21',
    traits: ['Generous', 'Idealistic', 'Adventurous'],
  },
  {
    sign: 'Capricorn',
    symbol: '♑',
    emoji: '🐐',
    constellation: 'Capricornus',
    element: 'Earth',
    elementEmoji: '🌍',
    color: '#b89a44',
    dateRange: 'Dec 22 – Jan 19',
    traits: ['Responsible', 'Disciplined', 'Ambitious'],
  },
  {
    sign: 'Aquarius',
    symbol: '♒',
    emoji: '🏺',
    constellation: 'Aquarius',
    element: 'Air',
    elementEmoji: '💨',
    color: '#d1ae4f',
    dateRange: 'Jan 20 – Feb 18',
    traits: ['Progressive', 'Original', 'Independent'],
  },
  {
    sign: 'Pisces',
    symbol: '♓',
    emoji: '🐟',
    constellation: 'Pisces',
    element: 'Water',
    elementEmoji: '💧',
    color: '#c9a84c',
    dateRange: 'Feb 19 – Mar 20',
    traits: ['Compassionate', 'Artistic', 'Intuitive'],
  },
];

export function getZodiacSign(birthday: string): ZodiacSign | null {
  if (!birthday) return null;
  try {
    const date = new Date(birthday);
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return ZODIAC_SIGNS[0];  // Aries
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return ZODIAC_SIGNS[1];  // Taurus
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return ZODIAC_SIGNS[2];  // Gemini
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return ZODIAC_SIGNS[3];  // Cancer
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return ZODIAC_SIGNS[4];  // Leo
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return ZODIAC_SIGNS[5];  // Virgo
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return ZODIAC_SIGNS[6]; // Libra
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return ZODIAC_SIGNS[7]; // Scorpio
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return ZODIAC_SIGNS[8]; // Sagittarius
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return ZODIAC_SIGNS[9];  // Capricorn
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return ZODIAC_SIGNS[10]; // Aquarius
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return ZODIAC_SIGNS[11]; // Pisces
  } catch { return null; }
  return null;
}

export function getCompatibility(sign1: string, sign2: string): {
  score: number;
  label: string;
  description: string;
  color: string;
} {
  const compatibilityMap: Record<string, Record<string, number>> = {
    Aries:       { Aries: 70, Taurus: 50, Gemini: 85, Cancer: 45, Leo: 95, Virgo: 55, Libra: 65, Scorpio: 60, Sagittarius: 95, Capricorn: 45, Aquarius: 80, Pisces: 55 },
    Taurus:      { Aries: 50, Taurus: 80, Gemini: 50, Cancer: 90, Leo: 60, Virgo: 95, Libra: 70, Scorpio: 85, Sagittarius: 50, Capricorn: 95, Aquarius: 45, Pisces: 85 },
    Gemini:      { Aries: 85, Taurus: 50, Gemini: 75, Cancer: 55, Leo: 85, Virgo: 60, Libra: 95, Scorpio: 45, Sagittarius: 80, Capricorn: 55, Aquarius: 95, Pisces: 60 },
    Cancer:      { Aries: 45, Taurus: 90, Gemini: 55, Cancer: 80, Leo: 55, Virgo: 80, Libra: 55, Scorpio: 95, Sagittarius: 45, Capricorn: 75, Aquarius: 50, Pisces: 95 },
    Leo:         { Aries: 95, Taurus: 60, Gemini: 85, Cancer: 55, Leo: 75, Virgo: 55, Libra: 85, Scorpio: 55, Sagittarius: 95, Capricorn: 50, Aquarius: 70, Pisces: 55 },
    Virgo:       { Aries: 55, Taurus: 95, Gemini: 60, Cancer: 80, Leo: 55, Virgo: 70, Libra: 60, Scorpio: 85, Sagittarius: 55, Capricorn: 95, Aquarius: 55, Pisces: 75 },
    Libra:       { Aries: 65, Taurus: 70, Gemini: 95, Cancer: 55, Leo: 85, Virgo: 60, Libra: 75, Scorpio: 60, Sagittarius: 85, Capricorn: 60, Aquarius: 95, Pisces: 65 },
    Scorpio:     { Aries: 60, Taurus: 85, Gemini: 45, Cancer: 95, Leo: 55, Virgo: 85, Libra: 60, Scorpio: 75, Sagittarius: 55, Capricorn: 85, Aquarius: 50, Pisces: 95 },
    Sagittarius: { Aries: 95, Taurus: 50, Gemini: 80, Cancer: 45, Leo: 95, Virgo: 55, Libra: 85, Scorpio: 55, Sagittarius: 75, Capricorn: 55, Aquarius: 85, Pisces: 60 },
    Capricorn:   { Aries: 45, Taurus: 95, Gemini: 55, Cancer: 75, Leo: 50, Virgo: 95, Libra: 60, Scorpio: 85, Sagittarius: 55, Capricorn: 80, Aquarius: 60, Pisces: 75 },
    Aquarius:    { Aries: 80, Taurus: 45, Gemini: 95, Cancer: 50, Leo: 70, Virgo: 55, Libra: 95, Scorpio: 50, Sagittarius: 85, Capricorn: 60, Aquarius: 75, Pisces: 65 },
    Pisces:      { Aries: 55, Taurus: 85, Gemini: 60, Cancer: 95, Leo: 55, Virgo: 75, Libra: 65, Scorpio: 95, Sagittarius: 60, Capricorn: 75, Aquarius: 65, Pisces: 80 },
  };

  const score = compatibilityMap[sign1]?.[sign2] ?? 50;

  if (score >= 90) return { score, label: 'Soulmates ✨', description: 'A cosmic match made in the stars.', color: '#c9a84c' };
  if (score >= 75) return { score, label: 'Highly Compatible 💫', description: 'Your energies align beautifully.', color: '#70b870' };
  if (score >= 60) return { score, label: 'Good Match 🌟', description: 'A harmonious connection with potential.', color: '#6a9fc0' };
  if (score >= 45) return { score, label: 'Neutral ⭐', description: 'Different energies that can still work.', color: '#9a8f78' };
  return { score, label: 'Challenging 🌙', description: 'Opposites that can learn from each other.', color: '#e07070' };
}

export async function getDailyHoroscope(sign: string): Promise<string> {
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const res = await fetch(`${BASE}/horoscope/${sign.toLowerCase()}`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    return data?.data?.horoscope ?? '';
  } catch {
    return '';
  }
}