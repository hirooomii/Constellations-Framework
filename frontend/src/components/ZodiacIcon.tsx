'use client';

type StarDef  = [number, number, number]; // [x, y, radius]
type LineDef  = [number, number];         // [starIndex, starIndex]
type ConsDef  = { stars: StarDef[]; lines: LineDef[] };

const CONSTELLATIONS: Record<string, ConsDef> = {
  Aries: {
    stars: [[8,29,2],[18,19,2.5],[25,22,1.5],[33,12,2]],
    lines: [[0,1],[1,2],[2,3]],
  },
  Taurus: {
    // Hyades V + Aldebaran
    stars: [[20,28,2.5],[10,17,1.5],[6,8,1.5],[16,9,1.5],[30,18,1.5],[36,10,1.5]],
    lines: [[0,1],[1,2],[1,3],[0,4],[4,5]],
  },
  Gemini: {
    // Twin columns + bridge
    stars: [[8,6,2],[10,14,1.5],[8,23,1.5],[10,31,2],[28,5,2],[28,14,1.5],[26,23,1.5],[28,32,2]],
    lines: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[1,5]],
  },
  Cancer: {
    stars: [[20,7,1.5],[12,15,1.5],[22,15,1.5],[8,27,1.5],[28,27,1.5]],
    lines: [[0,1],[0,2],[1,3],[2,4]],
  },
  Leo: {
    // Sickle + trapezoid body
    stars: [[16,6,2],[10,10,1.5],[6,18,1.5],[10,27,2.5],[18,29,1.5],[26,25,1.5],[34,19,2],[20,14,1.5]],
    lines: [[0,1],[1,2],[2,3],[0,7],[7,3],[3,4],[4,5],[5,6]],
  },
  Virgo: {
    stars: [[28,5,2],[24,12,2.5],[16,20,1.5],[8,27,1.5],[12,33,1.5],[26,28,1.5],[34,22,1.5]],
    lines: [[0,1],[1,2],[2,3],[2,4],[2,5],[5,6]],
  },
  Libra: {
    // Scales beam + two pans
    stars: [[20,9,1.5],[8,18,2],[32,18,2],[10,31,1.5],[30,31,1.5]],
    lines: [[0,1],[0,2],[1,2],[1,3],[2,4]],
  },
  Scorpio: {
    stars: [[6,8,2],[10,14,1.5],[16,20,2.5],[22,22,1.5],[28,18,1.5],[32,24,1.5],[34,30,1.5],[30,35,1.5],[34,37,2]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]],
  },
  Sagittarius: {
    // Arrow tip upper-right, bow lower-left
    stars: [[6,34,1.5],[14,26,1.5],[22,16,2],[30,6,1.5],[22,6,1.5],[30,14,1.5],[20,27,1.5]],
    lines: [[0,1],[1,2],[2,3],[3,4],[3,5],[1,6]],
  },
  Capricorn: {
    stars: [[6,10,2],[6,21,1.5],[12,29,1.5],[20,24,1.5],[28,16,2.5],[30,25,1.5],[32,33,1.5]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]],
  },
  Aquarius: {
    // Two wavy rows (water waves)
    stars: [
      [4,15,1.5],[10,11,1.5],[16,17,2],[22,13,1.5],[28,17,1.5],[34,13,1.5],
      [4,27,1.5],[10,23,1.5],[16,29,2],[22,25,1.5],[28,29,1.5],[34,25,1.5],
    ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[6,7],[7,8],[8,9],[9,10],[10,11]],
  },
  Pisces: {
    // Two fish loops + connecting cord
    stars: [[6,8,1.5],[10,14,2],[14,10,1.5],[26,22,1.5],[32,16,2],[34,22,1.5],[30,28,1.5],[12,20,1.5],[20,20,1.5],[24,20,1.5]],
    lines: [[0,1],[1,2],[2,0],[3,4],[4,5],[5,6],[6,3],[1,7],[7,8],[8,9],[9,3]],
  },
};

interface Props {
  sign: string;
  size?: number;
  color?: string;
}

export default function ZodiacIcon({ sign, size = 24, color = '#c9a84c' }: Props) {
  const def = CONSTELLATIONS[sign];
  if (!def) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {def.lines.map(([a, b], i) => (
        <line
          key={i}
          x1={def.stars[a][0]} y1={def.stars[a][1]}
          x2={def.stars[b][0]} y2={def.stars[b][1]}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="0.9"
        />
      ))}
      {def.stars.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x} cy={y} r={r}
          fill={color}
          style={{ filter: `drop-shadow(0 0 2.5px ${color})` }}
        />
      ))}
    </svg>
  );
}
