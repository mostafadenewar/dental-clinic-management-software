import { useMemo } from 'react'
import type { Dentition, ToothDef } from './odontogram_model'
import { teethFor } from './odontogram_model'
import { PanoramicChart } from './PanoramicChart'
import type { TreatmentRecord } from '../types'
import './odontogram.css'

// ---------------------------------------------------------------------------
// Occlusal odontogram — top-down view of the dental arch with biting-surface
// anatomy, groove patterns, and status coloring.
// ---------------------------------------------------------------------------

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
  const TEETH = useMemo(() => teethFor(dentition), [dentition])

  const { plannedSet, completedSet } = useMemo(() => {
    const planned = new Set<number | string>()
    const completed = new Set<number | string>()
    for (const rec of procedures) {
      const target = rec.status === 'done' ? completed : planned
      for (const t of rec.teeth) target.add(t)
    }
    return { plannedSet: planned, completedSet: completed }
  }, [procedures])

  const selectedKey = selectedTooth ?? (highlight && highlight.teeth.length === 1 ? highlight.teeth[0] : null)

  const handleClick = (t: ToothDef) => {
    if (!interactive) return
    onToothClick?.(t.n)
  }

  return (
    <div className={`odo-root${compact ? ' compact' : ''}`}>
      <PanoramicChart
        dentition={dentition}
        selectedTooth={selectedKey}
        onToothClick={(n) => {
          const t = TEETH.find((t) => String(t.n) === String(n))
          if (t) handleClick(t)
        }}
        interactive={interactive}
        planned={plannedSet}
        completed={completedSet}
      />

      {showLegend && (
        <div className="odo-legend">
          <span className="odo-lg"><i className="s healthy" /> Healthy</span>
          <span className="odo-lg"><i className="s planned" /> Proposed</span>
          <span className="odo-lg"><i className="s completed" /> Completed</span>
          <span className="odo-lg"><i className="s selected" /> Selected</span>
        </div>
      )}
    </div>
  )
}
