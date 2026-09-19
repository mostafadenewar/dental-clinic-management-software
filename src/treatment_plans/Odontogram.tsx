import { useMemo, useState } from 'react'
import type { Dentition, ToothDef, ToothType } from './odontogram_model'
import {
  teethFor,
  jawFrame,
  toothGlyph,
  toothStroke,
  toothTextColor,
  toothTone,
  TOOTH_TYPE_LABEL,
} from './odontogram_model'
import type { TreatmentRecord } from '../types'
import './odontogram.css'

// ---------------------------------------------------------------------------
// Flat clinical odontogram. The geometry follows the Universal adult chart
// and the A-T primary chart, with tooth silhouettes drawn as SVG paths.
// ---------------------------------------------------------------------------

const VIEW_W = 760
const VIEW_H = 470
const MID_X = 380

const QUAD_LABELS: { quad: string; x: number; y: number; anchor: 'start' | 'end'; text: string }[] = [
  { quad: 'UR', x: 64, y: 40, anchor: 'start', text: 'UR · Upper Right' },
  { quad: 'UL', x: VIEW_W - 64, y: 40, anchor: 'end', text: 'Upper Left · UL' },
  { quad: 'LR', x: 64, y: VIEW_H - 34, anchor: 'start', text: 'LR · Lower Right' },
  { quad: 'LL', x: VIEW_W - 64, y: VIEW_H - 34, anchor: 'end', text: 'Lower Left · LL' },
]

interface OdontogramProps {
  dentition?: Dentition
  procedures?: TreatmentRecord[]
  highlight?: TreatmentRecord | null
  selectedTooth?: number | string | null
  onToothClick?: (n: number | string) => void
  interactive?: boolean
  showLegend?: boolean
  compact?: boolean
}

const GLYPH_VIEWBOX = '-19 -35 38 72'
const GLYPH_LIST: ToothType[] = ['incisor', 'canine', 'premolar', 'molar']

/** Interact‑to‑select arch for the treatment workbench. */
export function Odontogram({
  dentition = 'adult',
  procedures = [],
  highlight = null,
  selectedTooth = null,
  onToothClick,
  interactive = true,
  showLegend = true,
  compact = false,
}: OdontogramProps) {
  const [hover, setHover] = useState<number | string | null>(null)

  const TEETH = useMemo(() => teethFor(dentition), [dentition])
  const frame = useMemo(() => jawFrame(), [])

  const { plannedSet, completedSet } = useMemo(() => {
    const planned = new Set<number | string>()
    const completed = new Set<number | string>()
    for (const rec of procedures) {
      const target = rec.status === 'done' ? completed : planned
      for (const t of rec.teeth) target.add(t)
    }
    return { plannedSet: planned, completedSet: completed }
  }, [procedures])

  const byTooth = useMemo(() => {
    const map = new Map<number | string, TreatmentRecord[]>()
    for (const rec of procedures) {
      for (const t of rec.teeth) {
        map.set(t, [...(map.get(t) ?? []), rec])
      }
    }
    return map
  }, [procedures])

  const selectedKey = selectedTooth ?? (highlight && highlight.teeth.length === 1 ? highlight.teeth[0] : null)
  const selectedSet = useMemo(
    () => new Set<number | string>(selectedKey === null ? [] : [selectedKey]),
    [selectedKey],
  )

  const opts = { planned: plannedSet, completed: completedSet, selected: selectedSet }

  const handleClick = (t: ToothDef) => {
    if (!interactive) return
    onToothClick?.(t.n)
  }

  const labelFrom = (t: ToothDef) => {
    const has = byTooth.get(t.n) ?? []
    const done = has.filter((p) => p.status === 'done').length
    if (has.length === 0) return `${TOOTH_TYPE_LABEL[t.type]} · Healthy`
    return `${has.length} treatment${has.length === 1 ? '' : 's'} · ${done} done`
  }

  return (
    <div className={`odo-root${compact ? ' compact' : ''}`}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="odo-svg" role="group" aria-label="Odontogram">
        <path d={frame.outer} className="odo-frame" />
        <path d={frame.inner} className="odo-frame odo-frame-inner" />
        <line x1={MID_X} y1={54} x2={MID_X} y2={VIEW_H - 48} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3 5" />
        <g className="odo-quads">
          {QUAD_LABELS.map((q) => (
            <text key={q.quad} x={q.x} y={q.y} textAnchor={q.anchor}>
              {q.text}
            </text>
          ))}
        </g>
        {TEETH.map((t) => {
          const fill = toothTone(t.n, opts)
          const stroke = toothStroke(t.n, opts)
          const isSelected = selectedSet.has(t.n)
          const glyph = toothGlyph(t.type)
          const rotation = t.quad.startsWith('L') ? 180 : 0
          return (
            <g
              key={String(t.n)}
              transform={`translate(${t.x.toFixed(1)}, ${t.y.toFixed(1)}) rotate(${rotation + t.tilt})`}
              className={`odo-tooth${interactive ? ' clickable' : ''}${isSelected ? ' selected' : ''}`}
              onClick={interactive ? () => { setHover(t.n); handleClick(t) } : undefined}
              onMouseEnter={() => setHover(t.n)}
              onMouseLeave={() => setHover((h) => (h === t.n ? null : h))}
              role={interactive ? 'button' : undefined}
              aria-label={`Tooth ${t.n} ${TOOTH_TYPE_LABEL[t.type]}`}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(t) }
              } : undefined}
            >
              <title>{`Tooth ${t.n} · ${TOOTH_TYPE_LABEL[t.type]} · ${labelFrom(t)}`}</title>
              <g className="odo-glyph">
                <path d={glyph.root ?? ''} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2.2 : 1.3} strokeLinejoin="round" />
                <path d={glyph.crown} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2.5 : 1.5} strokeLinejoin="round" />
                {glyph.roots && <path d={glyph.roots} fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />}
                {glyph.grooves?.map((groove) => (
                  <path key={groove} d={groove} fill="none" stroke={stroke} strokeWidth={1} strokeLinecap="round" opacity={0.8} />
                ))}
              </g>
              {isSelected && <circle r={31} fill="none" stroke="#2563eb" strokeWidth={1.8} strokeDasharray="3 3" />}
            </g>
          )
        })}
        <g className="odo-tooth-labels" aria-hidden>
          {TEETH.map((t) => (
            <text
              key={`label-${String(t.n)}`}
              x={t.x}
              y={t.quad.startsWith('L') ? t.y + 39 : t.y - 39}
              textAnchor="middle"
              fontSize={dentition === 'child' ? 9.5 : 8}
              fontWeight={700}
              fill={toothTextColor(t.n, opts)}
            >
              {String(t.n)}
            </text>
          ))}
        </g>
        {hover !== null && !compact && (
          <g transform={`translate(${MID_X}, 26)`} textAnchor="middle" pointerEvents="none">
            <rect x={-130} y={-15} width={260} height={26} rx={8} fill="#0f172a" opacity={0.92} />
            <text fontSize={11} fill="#f1f5f9" fontWeight={600}>
              Tooth {hover} · {labelFrom(TEETH.find((t) => t.n === hover)!)}
            </text>
          </g>
        )}
      </svg>

      {showLegend && (
        <div className="odo-legend">
          <span className="odo-lg"><i className="s healthy" /> Healthy</span>
          <span className="odo-lg"><i className="s planned" /> Proposed</span>
          <span className="odo-lg"><i className="s completed" /> Completed</span>
          <span className="odo-lg"><i className="s selected" /> Selected</span>
          <span className="odo-lg-sep" />
          <span className="odo-type-legend">
            {GLYPH_LIST.map((t) => (
              <span key={t} className="odo-tg">
                <svg viewBox={GLYPH_VIEWBOX} className="odo-glyph-mini" aria-hidden>
                  <ToothShape type={t} />
                </svg>
                {TOOTH_TYPE_LABEL[t]}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

/** Static silhouette used in the legend (no interaction). */
function ToothShape({ type }: { type: ToothType }) {
  const g = toothGlyph(type)
  return (
    <>
      <path d={g.crown} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.2} strokeLinejoin="round" />
      {g.root && <path d={g.root} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} strokeLinejoin="round" />}
      {g.roots && <path d={g.roots} fill="none" stroke="#94a3b8" strokeWidth={2.2} strokeLinecap="round" />}
    </>
  )
}