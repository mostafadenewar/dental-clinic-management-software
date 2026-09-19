// Anatomically correct odontogram model.
//
// Layout follows the clinical/Universal charting convention (patient-facing,
// i.e. the patient's RIGHT appears on the LEFT of the page):
//
//   Upper Right (UR) 1–8   |  Upper Left (UL) 9–16
//   Lower Right (LR) 25–32 |  Lower Left (LL) 17–24
//
// Permanent teeth are numbered 1–32 (Universal). Primary teeth use letters
// A–T: A=UR 2nd molar … E=UR central, F=UL central … J=UL 2nd molar,
// K=LL 2nd molar … O=LL central, P=LR central … T=LR 2nd molar.
//
// Each quadrant wraps around an elliptical dental arch, from the distal end
// (molar, page-outer edge) to the midline (central incisor). Tooth type drives
// the silhouette (incisor/canine/premolar/molar); 8 permanent teeth per
// quadrant (2I 1C 2P 3M), 5 primary teeth per quadrant (2I 1C 2M).

export type Dentition = 'adult' | 'child'
export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'
export type Quadrant = 'UR' | 'UL' | 'LL' | 'LR'

export interface ToothDef {
  n: number | string
  quad: Quadrant
  type: ToothType
  /** page x of the tooth centre */
  x: number
  /** page y of the tooth centre */
  y: number
  /** decorative fan tilt in degrees (applied around the tooth centre) */
  tilt: number
}

// ---- arch geometry --------------------------------------------------------

const CX = 380

const ADULT_GEOM = {
  RX: 318,
  RY: 146,
  CY_U: 234,
  CY_L: 250,
  // quadrants in page order: f = 0 at the page-left edge of each quadrant.
  // Upper ends fan up-outward, lower ends down-outward so the posterior
  // molars of the two arches separate instead of overlapping.
  arc: {
    UR: { a0: 178, a1: 95 },
    UL: { a0: 89, a1: 2 },
    LR: { a0: 188, a1: 271 },
    LL: { a0: 265, a1: 352 },
  } as Record<Quadrant, { a0: number; a1: number }>,
}

// Primary jaws are smaller, so the arch tightens slightly.
const CHILD_GEOM = {
  RX: 262,
  RY: 122,
  CY_U: 236,
  CY_L: 250,
  arc: ADULT_GEOM.arc,
}

// ---- tooth types per designation ------------------------------------------

const M = 'molar'
const P = 'premolar'
const C = 'canine'
const I = 'incisor'

const ADULT_TYPE: Record<number, ToothType> = {
  1: M, 2: M, 3: M, 4: P, 5: P, 6: C, 7: I, 8: I,
  9: I, 10: I, 11: C, 12: P, 13: P, 14: M, 15: M, 16: M,
  17: M, 18: M, 19: M, 20: P, 21: P, 22: C, 23: I, 24: I,
  25: I, 26: I, 27: C, 28: P, 29: P, 30: M, 31: M, 32: M,
}

const CHILD_TYPE: Record<string, ToothType> = {
  A: M, B: M, C: C, D: I, E: I,
  F: I, G: I, H: C, I: M, J: M,
  K: M, L: M, M: C, N: I, O: I,
  P: I, Q: I, R: C, S: M, T: M,
}

// ---- build teeth ----------------------------------------------------------

interface Slot {
  n: number | string
}

/**
 * Page order for each quadrant (left → right):
 *  upper right:  1 2 3 4 5 6 7 8
 *  upper left :  9 10 11 12 13 14 15 16
 *  lower right:  32 31 30 29 28 27 26 25
 *  lower left :  24 23 22 21 20 19 18 17
 */
const ADULT_SLOTS: Record<Quadrant, Slot[]> = {
  UR: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ n })),
  UL: [9, 10, 11, 12, 13, 14, 15, 16].map((n) => ({ n })),
  LR: [32, 31, 30, 29, 28, 27, 26, 25].map((n) => ({ n })),
  LL: [24, 23, 22, 21, 20, 19, 18, 17].map((n) => ({ n })),
}

/**
 * Page order for the primary dentition (left → right):
 *  upper right:  A B C D E
 *  upper left :  F G H I J
 *  lower right:  T S R Q P
 *  lower left :  O N M L K
 */
const CHILD_SLOTS: Record<Quadrant, Slot[]> = {
  UR: ['A', 'B', 'C', 'D', 'E'].map((n) => ({ n })),
  UL: ['F', 'G', 'H', 'I', 'J'].map((n) => ({ n })),
  LR: ['T', 'S', 'R', 'Q', 'P'].map((n) => ({ n })),
  LL: ['O', 'N', 'M', 'L', 'K'].map((n) => ({ n })),
}

function place(
  quad: Quadrant,
  slots: Slot[],
  geom: { RX: number; RY: number; CY_U: number; CY_L: number; arc: Record<Quadrant, { a0: number; a1: number }> },
  typeFor: (n: number | string) => ToothType,
): ToothDef[] {
  const { a0, a1 } = geom.arc[quad]
  const cy = quad.startsWith('U') ? geom.CY_U : geom.CY_L
  return slots.map((s, i) => {
    const f = slots.length > 1 ? i / (slots.length - 1) : 0.5
    const a = (a0 + (a1 - a0) * f) * (Math.PI / 180)
    const x = CX + geom.RX * Math.cos(a)
    const y = cy - geom.RY * Math.sin(a)
    // Upright at the midline, fanning outward toward the distal end.
    const tilt = quad === 'UR' || quad === 'LR' ? -34 * (1 - f) : 34 * f
    return { n: s.n, quad, type: typeFor(s.n), x, y, tilt }
  })
}

export const ADULT_TEETH: ToothDef[] = [
  ...place('UR', ADULT_SLOTS.UR, ADULT_GEOM, (n) => ADULT_TYPE[n as number] ?? I),
  ...place('UL', ADULT_SLOTS.UL, ADULT_GEOM, (n) => ADULT_TYPE[n as number] ?? I),
  ...place('LL', ADULT_SLOTS.LL, ADULT_GEOM, (n) => ADULT_TYPE[n as number] ?? I),
  ...place('LR', ADULT_SLOTS.LR, ADULT_GEOM, (n) => ADULT_TYPE[n as number] ?? I),
]

export const CHILD_TEETH: ToothDef[] = [
  ...place('UR', CHILD_SLOTS.UR, CHILD_GEOM, (n) => CHILD_TYPE[n as string] ?? I),
  ...place('UL', CHILD_SLOTS.UL, CHILD_GEOM, (n) => CHILD_TYPE[n as string] ?? I),
  ...place('LL', CHILD_SLOTS.LL, CHILD_GEOM, (n) => CHILD_TYPE[n as string] ?? I),
  ...place('LR', CHILD_SLOTS.LR, CHILD_GEOM, (n) => CHILD_TYPE[n as string] ?? I),
]

export const teethFor = (dentition: Dentition): ToothDef[] =>
  dentition === 'child' ? CHILD_TEETH : ADULT_TEETH

export const TOOTH_TYPE_LABEL: Record<ToothType, string> = {
  incisor: 'Incisor',
  canine: 'Canine',
  premolar: 'Premolar',
  molar: 'Molar',
}

// ---- tooth silhouettes ----------------------------------------------------
// Local coordinates: crown at the top (negative y), roots toward positive y.

export interface ToothGlyph {
  crown: string
  /** filled single-root silhouette (incisor, canine) */
  root?: string
  /** stroked diverging-root lines (premolar, molar) */
  roots?: string
  /** subtle occlusal groove line(s) */
  grooves?: string[]
}

const G: Record<ToothType, ToothGlyph> = {
  incisor: {
    crown: 'M -10 -29 Q -10 -33 -6 -34 Q 0 -36 6 -34 Q 10 -33 10 -29 L 9 -10 Q 8 -3 0 -2 Q -8 -3 -9 -10 Z',
    root: 'M -7 -8 Q -5 -4 0 -4 Q 5 -4 7 -8 C 6 2 4 17 0 28 C -4 17 -6 2 -7 -8 Z',
  },
  canine: {
    crown: 'M -12 -28 Q -11 -34 -5 -34 L 0 -40 L 5 -34 Q 11 -34 12 -28 L 11 -11 Q 9 -4 0 -2 Q -9 -4 -11 -11 Z',
    root: 'M -8 -8 Q -4 -4 0 -4 Q 4 -4 8 -8 C 7 4 4 23 0 33 C -4 23 -7 4 -8 -8 Z',
  },
  premolar: {
    crown: 'M -13 -28 Q -13 -34 -6 -35 Q -2 -36 0 -32 Q 2 -36 6 -35 Q 13 -34 13 -28 L 12 -10 Q 10 -3 0 -2 Q -10 -3 -12 -10 Z',
    root: 'M -9 -8 Q -5 -4 0 -5 Q 5 -4 9 -8 C 8 1 7 8 3 18 L 0 25 L -3 18 C -7 8 -8 1 -9 -8 Z',
    grooves: ['M -7 -22 Q 0 -17 7 -22', 'M 0 -28 L 0 -10'],
  },
  molar: {
    crown: 'M -15 -27 Q -15 -34 -8 -35 Q -3 -36 0 -32 Q 3 -36 8 -35 Q 15 -34 15 -27 L 14 -10 Q 12 -3 0 -2 Q -12 -3 -14 -10 Z',
    root: 'M -11 -8 Q -7 -4 0 -5 Q 7 -4 11 -8 C 11 0 9 7 6 16 L 3 26 L 0 16 L -3 26 L -6 16 C -9 7 -11 0 -11 -8 Z',
    grooves: ['M -10 -22 Q 0 -16 10 -22', 'M 0 -30 L 0 -8', 'M -7 -15 L 7 -15'],
  },
}

export const toothGlyph = (type: ToothType): ToothGlyph => G[type]

/** Tooth fill colors by state. */
export function toothTone(n: number | string, opts: { planned: Set<number | string>; completed: Set<number | string>; selected: Set<number | string> }): string {
  if (opts.selected.has(n)) return '#2563eb'
  if (opts.completed.has(n)) return '#22c55e'
  if (opts.planned.has(n)) return '#dcecff'
  return '#f8fafc'
}

export function toothStroke(n: number | string, opts: { planned: Set<number | string>; completed: Set<number | string>; selected: Set<number | string> }): string {
  if (opts.selected.has(n)) return '#1d4ed8'
  if (opts.completed.has(n)) return '#15803d'
  if (opts.planned.has(n)) return '#3b82f6'
  return '#cbd5e1'
}

export function toothTextColor(n: number | string, opts: { planned: Set<number | string>; completed: Set<number | string>; selected: Set<number | string> }): string {
  if (opts.selected.has(n)) return '#ffffff'
  if (opts.completed.has(n)) return '#ffffff'
  if (opts.planned.has(n)) return '#1d4ed8'
  return '#64748b'
}

/**
 * Nested oval frames suggesting the gum line of both jaws. Returns SVG path
 * data (dense polylines) for a faint dashed outline behind the teeth.
 */
export function jawFrame(): { outer: string; inner: string } {
  const half = (rx: number, ry: number, cyU: number, cyL: number) => {
    const pts: string[] = []
    // upper arc from 180° to 0° (through 90°), then lower back around
    for (let a = 180; a >= 0; a -= 2) {
      const r = a * (Math.PI / 180)
      pts.push(`${(CX + rx * Math.cos(r)).toFixed(1)} ${(cyU - ry * Math.sin(r)).toFixed(1)}`)
    }
    for (let a = 360; a >= 180; a -= 2) {
      const r = a * (Math.PI / 180)
      pts.push(`${(CX + rx * Math.cos(r)).toFixed(1)} ${(cyL - ry * Math.sin(r)).toFixed(1)}`)
    }
    return `M ${pts.join(' L ')} Z`
  }
  return {
    outer: half(ADULT_GEOM.RX, ADULT_GEOM.RY, ADULT_GEOM.CY_U, ADULT_GEOM.CY_L),
    inner: half(CHILD_GEOM.RX, CHILD_GEOM.RY, CHILD_GEOM.CY_U, CHILD_GEOM.CY_L),
  }
}