import { useMemo, useState } from 'react'
import type { Dentition, ToothType } from './odontogram_model'
import {
  teethFor,
  toothStroke,
  toothTone,
  TOOTH_TYPE_LABEL,
} from './odontogram_model'

// ---------------------------------------------------------------------------
// Panoramic odontogram — side-view teeth (crown + root) with occlusal views
// arranged in a clinical grid.  Layout:
//
//   Row 1  Upper teeth side-view (roots up, crowns down)
//   Row 2  Upper occlusal view (small biting-surface circles)
//   ---- numbers 1-8 per quadrant ----
//   Row 3  Lower occlusal view
//   Row 4  Lower teeth side-view (crowns up, roots down)
// ---------------------------------------------------------------------------

const VIEW_W = 980
const VIEW_H = 420

// ---- side-view tooth paths ------------------------------------------------
// Crown at y≈0, root extends upward (upper) or downward (lower).
// Normalized to roughly ±14 wide, crown ~20 tall, root ~30 tall.

const SIDE: Record<ToothType, { crown: string; root: string; rootLines?: string[] }> = {
  incisor: {
    crown: 'M-8 0Q-9-2-9-6Q-9-14-7-18Q-4-22 0-22Q4-22 7-18Q9-14 9-6Q9-2 8 0Z',
    root:  'M-5-18Q-3-20 0-20Q3-20 5-18C4-28 2-38 0-44C-2-38-4-28-5-18Z',
  },
  canine: {
    crown: 'M-9 0Q-10-3-10-8Q-10-16-7-20Q-4-24 0-28Q4-24 7-20Q10-16 10-8Q10-3 9 0Z',
    root:  'M-6-22Q-3-24 0-24Q3-24 6-22C5-32 3-44 0-52C-3-44-5-32-6-22Z',
  },
  premolar: {
    crown: 'M-10 0Q-11-3-11-8Q-11-14-9-18Q-6-22-2-22Q0-20 2-22Q6-22 9-18Q11-14 11-8Q11-3 10 0Z',
    root:  'M-7-18Q-4-20 0-20Q4-20 7-18C6-26 4-34 1-40L0-38L-1-40C-4-34-6-26-7-18Z',
    rootLines: ['M-3-20L-2-38', 'M3-20L2-38'],
  },
  molar: {
    crown: 'M-13 0Q-14-3-14-8Q-14-14-12-18Q-9-22-5-22Q-2-20 0-20Q2-20 5-22Q9-22 12-18Q14-14 14-8Q14-3 13 0Z',
    root:  'M-10-18Q-7-20-4-20L-2-20Q0-20 2-20L4-20Q7-20 10-18C9-26 7-34 5-38L3-36L1-38L-1-36L-3-38L-5-34C-7-30-9-24-10-18Z',
    rootLines: ['M-6-20L-4-36', 'M0-20L0-36', 'M6-20L4-36'],
  },
}

// ---- occlusal-view paths (biting surface from above) ----------------------

const OCCL: Record<ToothType, string> = {
  incisor: 'M-6-7Q-7-7-7-5L-7 0Q-7 4-5 7Q-3 8 0 8Q3 8 5 7L7 0Q7-4 7-5Q7-7 6-7Q3-8 0-8Q-3-8-6-7Z',
  canine:  'M-6-8Q-6-8-5-7L-4 0Q-3 4-2 6Q-1 8 0 8Q1 8 2 6L4 0Q5-7 6-8Q6-8 5-9Q3-9 0-9Q-3-9-5-9Z',
  premolar:'M-7-7Q-8-7-8-5L-8-1Q-8 2-7 4Q-5 7-3 8Q-1 9 0 9Q1 9 3 8Q5 7 7 4L8-1Q8-5 8-7Q8-8 7-8Q3-9 0-9Q-3-9-7-8Z',
  molar:   'M-9-7Q-10-7-10-4L-10 0Q-10 4-9 7Q-7 9-4 9L-2 9Q0 10 2 9L4 9Q7 9 9 7L10 0Q10-4 10-7Q10-8 9-8Q7-9 4-9Q2-10 0-10Q-2-10-4-9Q-7-9-9-8Z',
}

// Grooves on occlusal surface.
const OCCL_GROOVES: Record<ToothType, string[]> = {
  incisor: ['M-4-3L4-3', 'M-3 3L3 3'],
  canine:  ['M0-6L0 4'],
  premolar:['M-5 0Q-2 2 0 0Q2-2 5 0', 'M0-7L0 7'],
  molar:   ['M-7 0L7 0', 'M0-7L0 7', 'M-4-5Q-2-2-1-4', 'M1 3Q2 2 4 5', 'M-5 4Q-2 5 0 3', 'M0-3Q2-5 5-4'],
}

// ---- tooth position within each row ---------------------------------------

// ---- treatment-marking patterns (hatching, dots, etc.) --------------------
// These are SVG <defs> patterns overlaid on teeth.

function TreatmentDefs() {
  return (
    <defs>
      {/* Red diagonal hatching for extractions / planned */}
      <pattern id="pat-hatch-red" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="#e74c3c" strokeWidth="2" />
      </pattern>
      {/* Green diagonal hatching */}
      <pattern id="pat-hatch-green" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="#27ae60" strokeWidth="2" />
      </pattern>
      {/* Blue solid fill for implant / crown */}
      <pattern id="pat-dots-blue" patternUnits="userSpaceOnUse" width="6" height="6">
        <circle cx="3" cy="3" r="1.5" fill="#2563eb" />
      </pattern>
    </defs>
  )
}

interface PanoramicChartProps {
  dentition?: Dentition
  selectedTooth?: number | string | null
  onToothClick?: (n: number | string) => void
  interactive?: boolean
  planned?: Set<number | string>
  completed?: Set<number | string>
}

export function PanoramicChart({
  dentition = 'adult',
  selectedTooth = null,
  onToothClick,
  interactive = true,
  planned,
  completed,
}: PanoramicChartProps) {
  const [hover, setHover] = useState<number | string | null>(null)

  const allTeeth = useMemo(() => teethFor(dentition), [dentition])

  const opts = useMemo(() => {
    const pl = planned ?? new Set<number | string>()
    const co = completed ?? new Set<number | string>()
    const sel = selectedTooth === null ? new Set<number | string>() : new Set<number | string>([selectedTooth])
    return { planned: pl, completed: co, selected: sel }
  }, [planned, completed, selectedTooth])

  // Build tooth positions for upper and lower rows
  // Teeth per quadrant are already ordered distal→mesial in the model.
  // Upper: UR (8 teeth) then UL (8 teeth). Lower: LR then LL.
  const upperTeeth = useMemo(() => {
    const ur = allTeeth.filter((t) => t.quad === 'UR')
    const ul = allTeeth.filter((t) => t.quad === 'UL')
    return [...ur, ...ul].map((t) => ({ n: t.n, type: t.type }))
  }, [allTeeth])

  const lowerTeeth = useMemo(() => {
    const lr = allTeeth.filter((t) => t.quad === 'LR')
    const ll = allTeeth.filter((t) => t.quad === 'LL')
    return [...lr, ...ll].map((t) => ({ n: t.n, type: t.type }))
  }, [allTeeth])

  const scale = dentition === 'child' ? 0.82 : 1
  const spacing = 52 * scale
  const midX = VIEW_W / 2
  const gap = 18 * scale

  // Compute x positions for 16 teeth per row
  const toothX = (idx: number) => {
    if (idx < 8) {
      // Right quadrant (UR/LR): far left → midline
      return midX - gap - (7 - idx) * spacing - spacing / 2
    }
    // Left quadrant (UL/LL): midline → far right
    return midX + gap + (idx - 8) * spacing + spacing / 2
  }

  // Row Y centres
  const Y_UPPER_SIDE = 58
  const Y_UPPER_OCCL = 148
  const Y_LOWER_OCCL = 272
  const Y_LOWER_SIDE = 362

  // Side-view tooth SVG (single component reused for both arches)
  const SideTooth = ({
    type,
    x,
    y,
    flip,
    n,
  }: {
    type: ToothType
    x: number
    y: number
    flip: boolean
    n: number | string
  }) => {
    const s = SIDE[type]
    const fill = toothTone(n, opts)
    const stroke = toothStroke(n, opts)
    const isSelected = opts.selected.has(n)
    const transform = `translate(${x},${y}) scale(${flip ? '1 -1' : '1 1'})`
    return (
      <g transform={transform}>
        <path d={s.crown} fill={fill} stroke={stroke} strokeWidth={isSelected ? 1.8 : 1} strokeLinejoin="round" />
        <path d={s.root} fill="#f5f0e8" stroke={stroke} strokeWidth={isSelected ? 1.5 : 0.8} strokeLinejoin="round" />
        {s.rootLines?.map((rl, i) => (
          <path key={i} d={rl} fill="none" stroke={stroke} strokeWidth={0.6} opacity={0.5} />
        ))}
      </g>
    )
  }

  // Occlusal-view tooth SVG
  const OcclTooth = ({
    type,
    x,
    y,
    n,
  }: {
    type: ToothType
    x: number
    y: number
    n: number | string
  }) => {
    const fill = toothTone(n, opts)
    const stroke = toothStroke(n, opts)
    const isSelected = opts.selected.has(n)
    const grooves = OCCL_GROOVES[type]
    return (
      <g transform={`translate(${x},${y})`}>
        <path
          d={OCCL[type]}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 1.8 : 1}
          strokeLinejoin="round"
        />
        {grooves.map((g, i) => (
          <path key={i} d={g} fill="none" stroke={stroke} strokeWidth={0.6} opacity={0.5} />
        ))}
      </g>
    )
  }

  // Tooth number label
  const ToothNum = ({
    x,
    y,
    n,
    fontSize = 9,
  }: {
    x: number
    y: number
    n: number | string
    fontSize?: number
  }) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fontWeight={600}
      fill="#64748b"
      pointerEvents="none"
    >
      {String(n)}
    </text>
  )

  // Clickable wrapper for each tooth
  const Clickable = ({
    children,
    n,
    x,
    y,
    hitR = 22,
  }: {
    children: React.ReactNode
    n: number | string
    x: number
    y: number
    hitR?: number
  }) => (
    <g
      className={`pan-tooth${interactive ? ' clickable' : ''}${opts.selected.has(n) ? ' selected' : ''}`}
      onClick={interactive ? () => { setHover(n); onToothClick?.(n) } : undefined}
      onMouseEnter={() => setHover(n)}
      onMouseLeave={() => setHover((h) => (h === n ? null : h))}
      role={interactive ? 'button' : undefined}
      aria-label={`Tooth ${n}`}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToothClick?.(n) }
      } : undefined}
    >
      <title>{`Tooth ${n} · ${TOOTH_TYPE_LABEL[allTeeth.find((t) => String(t.n) === String(n))?.type ?? 'incisor']}`}</title>
      {children}
      {/* Selection ring */}
      {opts.selected.has(n) && (
        <circle cx={x} cy={y} r={hitR} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="3 2" />
      )}
    </g>
  )

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="odo-svg panoramic-svg" role="group" aria-label="Panoramic chart">
      <TreatmentDefs />

      {/* ---- Row 1: Upper teeth side-view ---- */}
      {upperTeeth.map((t, i) => (
        <Clickable key={`us-${String(t.n)}`} n={t.n} x={toothX(i)} y={Y_UPPER_SIDE} hitR={20}>
          <SideTooth type={t.type} x={toothX(i)} y={Y_UPPER_SIDE} flip={false} n={t.n} />
        </Clickable>
      ))}

      {/* ---- Row 2: Upper occlusal view ---- */}
      {upperTeeth.map((t, i) => (
        <Clickable key={`uo-${String(t.n)}`} n={t.n} x={toothX(i)} y={Y_UPPER_OCCL} hitR={14}>
          <OcclTooth type={t.type} x={toothX(i)} y={Y_UPPER_OCCL} n={t.n} />
        </Clickable>
      ))}

      {/* ---- Numbers between rows ---- */}
      {upperTeeth.map((t, i) => (
        <ToothNum key={`un-${String(t.n)}`} x={toothX(i)} y={Y_UPPER_OCCL + 22} n={t.n} fontSize={8.5} />
      ))}
      {lowerTeeth.map((t, i) => (
        <ToothNum key={`ln-${String(t.n)}`} x={toothX(i)} y={Y_LOWER_OCCL - 22} n={t.n} fontSize={8.5} />
      ))}

      {/* ---- Row 3: Lower occlusal view ---- */}
      {lowerTeeth.map((t, i) => (
        <Clickable key={`lo-${String(t.n)}`} n={t.n} x={toothX(i)} y={Y_LOWER_OCCL} hitR={14}>
          <OcclTooth type={t.type} x={toothX(i)} y={Y_LOWER_OCCL} n={t.n} />
        </Clickable>
      ))}

      {/* ---- Row 4: Lower teeth side-view ---- */}
      {lowerTeeth.map((t, i) => (
        <Clickable key={`ls-${String(t.n)}`} n={t.n} x={toothX(i)} y={Y_LOWER_SIDE} hitR={20}>
          <SideTooth type={t.type} x={toothX(i)} y={Y_LOWER_SIDE} flip={true} n={t.n} />
        </Clickable>
      ))}

      {/* ---- Midline separator ---- */}
      <line x1={midX} y1={20} x2={midX} y2={VIEW_H - 20} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />

      {/* ---- Hover tooltip ---- */}
      {hover !== null && (
        <g transform={`translate(${midX}, 16)`} textAnchor="middle" pointerEvents="none">
          <rect x={-130} y={-13} width={260} height={24} rx={7} fill="#0f172a" opacity={0.92} />
          <text fontSize={11} fill="#f1f5f9" fontWeight={600}>
            Tooth {hover} · {TOOTH_TYPE_LABEL[allTeeth.find((t) => String(t.n) === String(hover))?.type ?? 'incisor']}
          </text>
        </g>
      )}
    </svg>
  )
}
