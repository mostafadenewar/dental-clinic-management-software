import type { ToothNumbering } from '../types'
import './toothMap.css'

export interface ToothMapProps {
  numbering?: ToothNumbering
  selected: number[]
  planned?: number[]
  completed?: number[]
  interactive?: boolean
  onToothClick?: (tooth: number) => void
  showLegend?: boolean
}

interface ToothDef {
  number: number
  archIndex: number
}

// Universal/US numbering is displayed so the patient's own right side sits on
// the viewer's left (as if facing the patient).
const UPPER_ARCH: ToothDef[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((number, i) => ({ number, archIndex: i })),
  ...[9, 10, 11, 12, 13, 14, 15, 16].map((number, i) => ({ number, archIndex: i + 8 })),
]

const LOWER_ARCH: ToothDef[] = [
  ...[32, 31, 30, 29, 28, 27, 26, 25].map((number, i) => ({ number, archIndex: i })),
  ...[24, 23, 22, 21, 20, 19, 18, 17].map((number, i) => ({ number, archIndex: i + 8 })),
]

const UPPER_LABELS = ['UR', 'UL']
const LOWER_LABELS = ['LR', 'LL']

const archOffset = (archIndex: number, row: 'upper' | 'lower'): number => {
  // Gentle smile curve: back teeth raised for the maxilla, lowered for the mandible.
  const spread = Math.pow(archIndex - 7.5, 2)
  return row === 'upper' ? -spread * 0.035 : spread * 0.035
}

export function ToothMap({
  numbering = 'universal',
  selected,
  planned = [],
  completed = [],
  interactive = false,
  onToothClick,
  showLegend = false,
}: ToothMapProps) {
  const renderRow = (row: 'upper' | 'lower', teeth: ToothDef[], labels: string[]) => {
    const half = teeth.length / 2
    const quads = [
      { teeth: teeth.slice(0, half), label: labels[0], side: 'l' },
      { teeth: teeth.slice(half), label: labels[1], side: 'r' },
    ]
    return (
      <div className={`toothmap-row toothmap-${row}`}>
        {quads.map((quad) => (
          <div key={quad.label} className={`toothmap-quad toothmap-quad-${quad.side}`}>
            <span className="toothmap-quad-label">{quad.label}</span>
            <div className="toothmap-teeth">
              {quad.teeth.map((t) => {
                const isSelected = selected.includes(t.number)
                const isCompleted = completed.includes(t.number)
                const isPlanned = planned.includes(t.number)
                const cls = [
                  'tm-tooth',
                  isCompleted ? 'completed' : isPlanned ? 'planned' : 'plain',
                  isSelected ? 'selected' : '',
                  interactive ? 'clickable' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={t.number}
                    type="button"
                    className={cls}
                    style={{ transform: `translateY(${archOffset(t.archIndex, row)}px)` }}
                    onClick={interactive && onToothClick ? () => onToothClick(t.number) : undefined}
                    aria-pressed={isSelected}
                    aria-label={`Tooth ${t.number}`}
                    title={`Tooth ${t.number}${isCompleted ? ' (completed)' : isPlanned ? ' (planned)' : ''}`}
                  >
                    {t.number}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="toothmap">
      <div className="toothmap-head">
        <span>Universal Numbering{numbering === 'universal' ? '' : ` · ${numbering}`}</span>
        {showLegend && (
          <div className="toothmap-legend">
            <span className="toothmap-legend-item planned-dot">Planned</span>
            <span className="toothmap-legend-item completed-dot">Completed</span>
            <span className="toothmap-legend-item selected-dot">Selected</span>
          </div>
        )}
      </div>
      {renderRow('upper', UPPER_ARCH, UPPER_LABELS)}
      <div className="toothmap-midline" />
      {renderRow('lower', LOWER_ARCH, LOWER_LABELS)}
    </div>
  )
}