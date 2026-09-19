import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Printer,
  PencilSimple,
  CalendarCheck,
  Check,
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  DotsThreeVertical,
  PaperPlaneTilt,
  FileArrowDown,
  ShieldCheck,
  Warning,
  BuildingOffice,
  SealCheck,
  Hourglass,
  Sparkle,
} from '@phosphor-icons/react'
import './treatment_plans.css'
import type {
  TreatmentPlan,
  TreatmentProcedure,
  PlanFilterKey,
  PlanStatus,
  ProcedureStatus,
  TreatmentCategory,
  InsuranceBenefit,
  EligibilityStatus,
  PreAuthStatus,
} from '../types'
import { api, useBackendReady, type ProcedureCatalogEntry } from '../api/client'
import { useLookups } from '../api/lookups-context'
import {
  PLAN_STATUS_LABEL,
  planFinancials,
  planProcedures,
  FILTER_MATCHES,
} from '../data/treatmentData'
import { currency, currencyWhole, dateShort } from '../utils/format'
import { Modal } from '../components/Modal'
import { DonutChart } from '../components/Charts'
import { ToothMap } from './ToothMap'
import { useToast } from '../components/toastStore'

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`

const PLAN_STATUS_TONE: Record<PlanStatus, string> = {
  draft: 'ui-pill-slate',
  pending_approval: 'ui-pill-amber',
  approved: 'ui-pill-blue',
  scheduled: 'ui-pill-violet',
  in_progress: 'ui-pill-green',
  completed: 'ui-pill-green',
  cancelled: 'ui-pill-red',
}

const PROC_STATUS_TONE: Record<ProcedureStatus, string> = {
  planned: 'ui-pill-slate',
  scheduled: 'ui-pill-violet',
  in_progress: 'ui-pill-blue',
  completed: 'ui-pill-green',
  pending: 'ui-pill-amber',
  cancelled: 'ui-pill-red',
}

const PROC_STATUS_LABEL: Record<ProcedureStatus, string> = {
  planned: 'Planned',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  pending: 'Pending',
  cancelled: 'Cancelled',
}

interface PlanFilterChip {
  key: PlanFilterKey
  label: string
}

const BROWSER_FILTERS: PlanFilterChip[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active / In Progress' },
  { key: 'pending', label: 'Awaiting Approval' },
  { key: 'draft', label: 'Drafts' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
]

interface SummaryDef {
  key: PlanFilterKey
  label: string
  hint: string
}

const SUMMARY_CARDS: SummaryDef[] = [
  { key: 'draft', label: 'New Drafts', hint: 'Not yet reviewed' },
  { key: 'pending', label: 'Pending Approval', hint: 'Awaiting sign-off' },
  { key: 'approved', label: 'Approved', hint: 'Ready to schedule' },
  { key: 'scheduled', label: 'Scheduled', hint: 'On the calendar' },
]

const matchesQuery = (plan: TreatmentPlan, q: string): boolean => {
  const query = q.trim().toLowerCase()
  if (!query) return true
  return (
    plan.patient.name.toLowerCase().includes(query) ||
    plan.title.toLowerCase().includes(query) ||
    plan.id.toLowerCase().includes(query)
  )
}

interface TreatmentPlansProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

const TreatmentPlans = ({ searchQuery, createOpen, onCreateOpenChange }: TreatmentPlansProps) => {
  const toast = useToast()
  const ready = useBackendReady()
  const { patients, providers, coordinators, insurance: insuranceList, catalog } = useLookups()
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [filter, setFilter] = useState<PlanFilterKey>('all')
  const [selectedId, setSelectedId] = useState<string>('')
  const [expandedProc, setExpandedProc] = useState<string | null>(null)
  const [procModal, setProcModal] = useState<ProcModalState | null>(null)
  const [toothSel, setToothSel] = useState<number[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)

  const providerById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers])
  const coordinatorById = useMemo(() => new Map(coordinators.map((p) => [p.id, p])), [coordinators])
  const insuranceById = useMemo(() => new Map(insuranceList.map((i) => [i.id, i])), [insuranceList])

  const load = useCallback(async () => {
    try {
      setPlans(await api.plans())
    } catch {
      setPlans([])
    } finally {
      setLoadingPlans(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  useEffect(() => {
    if (plans.length > 0 && !plans.some((p) => p.id === selectedId)) {
      setSelectedId(plans[0].id)
    }
  }, [plans, selectedId])

  const applyPlan = (p: TreatmentPlan | null) => {
    if (!p) return
    setPlans((prev) =>
      prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev],
    )
  }

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? plans[0],
    [plans, selectedId],
  )

  const filtered = useMemo(
    () => plans.filter((p) => FILTER_MATCHES[filter](p.status) && matchesQuery(p, searchQuery)),
    [plans, filter, searchQuery],
  )

  const setProcStatus = async (pr: TreatmentProcedure, status: ProcedureStatus) => {
    try {
      const updated = await api.setProcedureStatus(pr.id, status)
      applyPlan(updated)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', { tone: 'danger' })
    }
  }

  const handleSchedule = async (proc: TreatmentProcedure) => {
    await setProcStatus(proc, 'scheduled')
    toast.push(`${proc.procedureName} marked as scheduled`)
  }

  const handleComplete = async (pr: TreatmentProcedure) => {
    await setProcStatus(pr, 'completed')
    toast.push(`${pr.procedureName} completed · plan progress updated`)
  }

  const handleReturnPending = async (pr: TreatmentProcedure) => {
    await setProcStatus(pr, 'planned')
    toast.push(`${pr.procedureName} returned to pending`, { tone: 'info' })
  }

  const handleApprove = async () => {
    if (!selectedPlan) return
    try {
      const updated = await api.updatePlan(selectedPlan.id, { status: 'approved' })
      applyPlan(updated)
      toast.push(`${selectedPlan.title} approved · ready to schedule`)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Approval failed', { tone: 'danger' })
    }
  }

  const handleCreatePlan = async (input: NewPlanInput) => {
    if (!input.patientId) {
      toast.push('Select a patient', { tone: 'warning' })
      return
    }
    try {
      const created = await api.createPlan({
        patientId: input.patientId,
        title: input.title.trim() || 'Untitled Treatment Plan',
        description: input.description.trim(),
        status: input.startAsDraft ? 'draft' : 'pending_approval',
      })
      setPlans((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
      setSelectedId(created.id)
      setFilter('all')
      onCreateOpenChange(false)
      toast.push(
        `Treatment plan created for ${created.patient.name} as ${input.startAsDraft ? 'draft' : 'pending approval'}`,
      )
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to create plan', { tone: 'danger' })
    }
  }

  const handleSaveProcedure = async (phaseId: string, draft: ProcedureDraft) => {
    if (!procModal) return
    if (!draft.procedureName.trim()) {
      toast.push('Procedure name is required', { tone: 'warning' })
      return
    }
    try {
      if (procModal.mode === 'edit' && procModal.existing) {
        const updated = await api.updateProcedure(procModal.existing.id, {
          procedureName: draft.procedureName.trim(),
          code: draft.code.trim(),
          category: draft.category,
          teeth: draft.teeth,
          providerId: draft.providerId,
          fee: draft.fee,
          insuranceEstimate: draft.insuranceEstimate,
          plannedDate: draft.plannedDate || null,
          notes: draft.notes,
        })
        applyPlan(updated)
        toast.push('Procedure updated')
      } else {
        const updated = await api.createProcedure(selectedPlan.id, {
          phaseId,
          procedureName: draft.procedureName.trim(),
          code: draft.code.trim(),
          category: draft.category,
          teeth: draft.teeth,
          providerId: draft.providerId,
          fee: draft.fee,
          insuranceEstimate: draft.insuranceEstimate,
          plannedDate: draft.plannedDate || null,
          notes: draft.notes,
        })
        applyPlan(updated)
        toast.push(
          `${draft.procedureName} added to plan · ${currencyWhole(planFinancials(selectedPlan).estimatedValue + draft.fee)} in plan value`,
        )
      }
      setProcModal(null)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to save procedure', { tone: 'danger' })
    }
  }

  const handleToothClick = (tooth: number) => {
    setToothSel((prev) => (prev.includes(tooth) ? prev.filter((t) => t !== tooth) : [...prev, tooth]))
    toast.push(
      `Tooth #${tooth} ${toothSel.includes(tooth) ? 'removed from' : 'selected for'} clinical mapping`,
      { tone: 'info' },
    )
  }

  const plan = selectedPlan
  const fin = useMemo(
    () =>
      plan
        ? planFinancials(plan)
        : {
            estimatedValue: 0,
            insuranceContribution: 0,
            patientShare: 0,
            completedCount: 0,
            totalCount: 0,
            coveragePercent: 0,
            progressPercent: 0,
          },
    [plan],
  )
  const insurance = plan?.insuranceId ? insuranceById.get(plan.insuranceId) : undefined

  const mapData = useMemo(() => {
    if (!plan) return { completed: [], planned: [] }
    const completedSet = new Set<number>()
    const plannedSet = new Set<number>()
    for (const pr of planProcedures(plan)) {
      for (const t of pr.toothSelection.teeth) {
        if (pr.status === 'completed') completedSet.add(t)
        else plannedSet.add(t)
      }
    }
    return { completed: [...completedSet], planned: [...plannedSet] }
  }, [plan])

  const selectedProcs = useMemo(() => {
    if (!plan) return []
    const result: { tooth: number; procedures: TreatmentProcedure[] }[] = []
    for (const tooth of toothSel) {
      const procs = planProcedures(plan).filter((pr) => pr.toothSelection.teeth.includes(tooth))
      result.push({ tooth, procedures: procs })
    }
    return result
  }, [plan, toothSel])

  const recentPlans = useMemo(
    () =>
      [...plans]
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .slice(0, 4),
    [plans],
  )

  const pendingProcedures = plan
    ? planProcedures(plan).filter((pr) => pr.status === 'planned' || pr.status === 'pending')
    : []

  if (!plan) {
    return (
      <div className="tp-page">
        <div className="ui-empty" style={{ padding: 60 }}>
          <strong>{loadingPlans ? 'Loading treatment plans…' : 'No treatment plans yet'}</strong>
          <span>Create your first plan with the New Plan button.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="tp-page">
      <div className="tp-summary-row">
        {SUMMARY_CARDS.map((card) => {
          const count = plans.filter((p) => FILTER_MATCHES[card.key](p.status)).length
          const active = filter === card.key
          return (
            <button
              key={card.key}
              type="button"
              className={`tp-summary-card${active ? ' active' : ''}`}
              onClick={() => setFilter(card.key)}
              aria-pressed={active}
            >
              <div className="tp-summary-count">{count}</div>
              <div className="tp-summary-text">
                <div className="tp-summary-label">{card.label}</div>
                <div className="tp-summary-hint">{card.hint}</div>
              </div>
              <span className="tp-summary-arrow">
                <CaretRight size={11} weight="bold" />
              </span>
            </button>
          )
        })}
      </div>

      <div className="tp-workspace">
        <PlanBrowser
          plans={filtered}
          filter={filter}
          onFilter={setFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <div className="tp-builder">
          <div className="tp-builder-top">
            <div className="tp-patient">
              <span className="ui-avatar">{plan.patient.initials}</span>
              <div className="tp-patient-text">
                <div className="tp-patient-name">
                  {plan.patient.name}
                  <span className={`ui-pill ${PLAN_STATUS_TONE[plan.status]}`}>{PLAN_STATUS_LABEL[plan.status]}</span>
                </div>
                <div className="tp-patient-meta">
                  {plan.patient.id} · {plan.patient.gender}, {plan.patient.age} · {plan.patient.phone}
                </div>
              </div>
            </div>
            <div className="tp-builder-actions">
              {plan.status === 'pending_approval' && (
                <button type="button" className="ui-btn ui-btn-soft ui-btn-sm" onClick={handleApprove}>
                  <SealCheck size={12} weight="fill" />
                  Approve Plan
                </button>
              )}
              <button
                type="button"
                className="ui-icn"
                title="Print plan"
                onClick={() => toast.push('Print preview is queued for the print workflow', { tone: 'info' })}
              >
                <Printer size={14} />
              </button>
              <div className="tp-more">
                <button
                  type="button"
                  className="ui-icn"
                  title="More actions"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  <DotsThreeVertical size={15} />
                </button>
                {moreOpen && (
                  <div className="tp-more-menu" role="menu">
                    {['Duplicate plan', 'Add clinical note', 'Share secure link', 'Archive plan'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false)
                          toast.push(`"${item}" · wired to Electron menu services later`, { tone: 'info' })
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tp-plan-body">
            <div className="tp-plan-title">
              <h2>{plan.title}</h2>
              <span className="tp-plan-id">{plan.id}</span>
            </div>
            <p className="tp-plan-desc">{plan.description || 'No clinical note added yet.'}</p>

            <div className="tp-meta-grid">
              <div className="tp-meta-cell">
                <span className="tp-meta-label">Plan ID</span>
                <span className="tp-meta-value mono">{plan.id}</span>
                <span className="tp-meta-label">Created</span>
                <span className="tp-meta-value">{dateShort(plan.createdAt)}</span>
              </div>
              <div className="tp-meta-cell">
                <span className="tp-meta-label">Attending Doctor</span>
                <span className="tp-meta-value">{providerById.get(plan.doctorId)?.name ?? '—'}</span>
                <span className="tp-meta-label">Coordinator</span>
                <span className="tp-meta-value">{coordinatorById.get(plan.coordinatorId)?.name ?? '—'}</span>
              </div>
              <div className="tp-meta-cell">
                <span className="tp-meta-label">Updated</span>
                <span className="tp-meta-value">{dateShort(plan.updatedAt)}</span>
                <span className="tp-meta-label">Insurance</span>
                <span className="tp-meta-value">{insurance?.provider ?? 'Self-pay'}</span>
              </div>
            </div>

            <div className="tp-progress">
              <div className="tp-progress-text">
                <span>
                  Plan progress <strong>{fin.progressPercent}%</strong>
                </span>
                <span className="muted">
                  {fin.completedCount} of {fin.totalCount} procedures complete
                </span>
              </div>
              <div className="ui-progress">
                <div
                  className={`ui-progress-fill ${fin.progressPercent === 100 ? 'green' : ''}`}
                  style={{ width: `${fin.progressPercent}%` }}
                />
              </div>
              {pendingProcedures.length > 0 && (
                <div className="tp-next-up">
                  <CaretRight size={10} weight="bold" />
                  Next up: {pendingProcedures[0].procedureName} · {currencyWhole(pendingProcedures[0].fee)}
                </div>
              )}
            </div>
          </div>

          <div className="tp-phases">
            <div className="tp-section-head">
              <div>
                <h3>Phased Treatment Timeline</h3>
                <p>Expand a procedure to review financials and scheduling</p>
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-primary ui-btn-sm"
                onClick={() =>
                  setProcModal({
                    key: uid('PM'),
                    mode: 'add',
                    planId: plan.id,
                    phaseId: plan.phases[0]?.id,
                  })
                }
              >
                <Plus size={12} weight="bold" />
                Add Procedure
              </button>
            </div>

            {plan.phases.map((phase) => {
              const phaseTotal = phase.procedures.reduce((sum, pr) => sum + pr.fee, 0)
              return (
                <div key={phase.id} className="tp-phase">
                  <div className="tp-phase-head">
                    <span className="tp-phase-order">{phase.order}</span>
                    <div className="tp-phase-text">
                      <div className="tp-phase-name">{phase.name}</div>
                      <div className="tp-phase-desc">{phase.description}</div>
                    </div>
                    <div className="tp-phase-total">
                      <span>{currencyWhole(phaseTotal)}</span>
                      <span className="muted">{phase.procedures.length} {phase.procedures.length === 1 ? 'procedure' : 'procedures'}</span>
                    </div>
                    <button
                      type="button"
                      className="ui-icn"
                      title={`Add procedure to ${phase.name}`}
                      onClick={() =>
                        setProcModal({ key: uid('PM'), mode: 'add', planId: plan.id, phaseId: phase.id })
                      }
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {phase.procedures.length === 0 && (
                    <div className="tp-phase-empty">No procedures in this phase yet.</div>
                  )}

                  {phase.procedures.map((pr) => (
                    <ProcedureRow
                      key={pr.id}
                      procedure={pr}
                      providerName={providerById.get(pr.providerId)?.name ?? '—'}
                      expanded={expandedProc === pr.id}
                      onToggle={() => setExpandedProc((cur) => (cur === pr.id ? null : pr.id))}
                      onEdit={() =>
                        setProcModal({ key: uid('PM'), mode: 'edit', planId: plan.id, phaseId: phase.id, existing: pr })
                      }
                      onSchedule={handleSchedule}
                      onComplete={handleComplete}
                      onReturnPending={handleReturnPending}
                    />
                  ))}
                </div>
              )
            })}
          </div>

          <div className="tp-map">
            <div className="tp-section-head">
              <div>
                <h3>Tooth Map · Procedure Coverage</h3>
                <p>Select a tooth to highlight related procedures</p>
              </div>
            </div>
            <ToothMap
              numbering="universal"
              selected={toothSel}
              planned={mapData.planned}
              completed={mapData.completed}
              interactive
              onToothClick={handleToothClick}
              showLegend
            />
            {selectedProcs.length > 0 && (
              <div className="tp-map-results">
                {selectedProcs.map(({ tooth, procedures }) => (
                  <div key={tooth} className="tp-map-tooth">
                    <span className="tp-map-tooth-num">#{tooth}</span>
                    <div className="tp-map-procs">
                      {procedures.length === 0 && <span className="muted">No procedures mapped to this tooth</span>}
                      {procedures.map((pr) => (
                        <span key={pr.id} className={`ui-pill ${PROC_STATUS_TONE[pr.status]}`}>
                          {pr.procedureName} ({pr.code}) · {PROC_STATUS_LABEL[pr.status]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <FinancialSidebar
          plan={plan}
          financials={fin}
          insurance={insurance}
          onToggleTask={async (taskId) => {
            try {
              const updated = await api.toggleCareTask(taskId)
              applyPlan(updated)
            } catch (err) {
              toast.push(err instanceof Error ? err.message : 'Task update failed', { tone: 'danger' })
            }
          }}
          onSend={() =>
            toast.push(`Treatment plan shared with ${plan.patient.name} via secure messaging`)
          }
          onExport={() => toast.push('Exporting plan PDF · scheduled for the file service', { tone: 'info' })}
        />
      </div>

      <div className="tp-recent">
        <div className="tp-section-head flat">
          <div>
            <h3>Recently Updated Plans</h3>
            <p>Plans touched in the last 14 days</p>
          </div>
        </div>
        <div className="tp-recent-list">
          {recentPlans.map((p) => {
            const f = planFinancials(p)
            return (
              <button
                key={p.id}
                type="button"
                className="tp-recent-card"
                onClick={() => {
                  setSelectedId(p.id)
                  setFilter('all')
                }}
              >
                <span className="ui-avatar">{p.patient.initials}</span>
                <div className="tp-recent-body">
                  <div className="tp-recent-name">{p.patient.name}</div>
                  <div className="tp-recent-title">{p.title}</div>
                  <div className="tp-recent-meta">
                    {p.id} · {f.totalCount} {f.totalCount === 1 ? 'procedure' : 'procedures'} · updated {dateShort(p.updatedAt)}
                  </div>
                </div>
                <span className={`ui-pill ${PLAN_STATUS_TONE[p.status]}`}>{PLAN_STATUS_LABEL[p.status]}</span>
                <strong className="tp-recent-value">{currencyWhole(f.estimatedValue)}</strong>
              </button>
            )
          })}
        </div>
      </div>

      {createOpen && (
        <CreatePlanModal
          patients={patients}
          onClose={() => onCreateOpenChange(false)}
          onCreate={handleCreatePlan}
        />
      )}

      {procModal && (
        <ProcedureModal
          key={procModal.key}
          mode={procModal.mode}
          plan={plan}
          phaseId={procModal.phaseId}
          existing={procModal.existing}
          coveragePct={fin.coveragePercent}
          catalog={catalog}
          providers={providers}
          onClose={() => setProcModal(null)}
          onSave={(draft) => {
            if (procModal.phaseId) void handleSaveProcedure(procModal.phaseId, draft)
          }}
        />
      )}
    </div>
  )
}

export default TreatmentPlans

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const DEFAULT_TASKS = [
  { id: 't1', label: 'Present estimate', done: false },
  { id: 't2', label: 'Confirm appointment', done: false },
  { id: 't3', label: 'Collect consent', done: false },
]

interface PlanBrowserProps {
  plans: TreatmentPlan[]
  filter: PlanFilterKey
  onFilter: (f: PlanFilterKey) => void
  selectedId: string
  onSelect: (id: string) => void
}

function PlanBrowser({ plans, filter, onFilter, selectedId, onSelect }: PlanBrowserProps) {
  return (
    <div className="tp-browser">
      <div className="tp-browser-head">
        <h3>Treatment Plans</h3>
        <span className="tp-browser-count">{plans.length}</span>
      </div>

      <div className="tp-browser-filters">
        {BROWSER_FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`tp-chip${filter === chip.key ? ' active' : ''}`}
            onClick={() => onFilter(chip.key)}
            aria-pressed={filter === chip.key}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="tp-browser-list">
        {plans.map((p) => {
          const count = planProcedures(p).length
          const active = p.id === selectedId
          return (
            <button
              key={p.id}
              type="button"
              className={`tp-plan-item${active ? ' active' : ''}`}
              onClick={() => onSelect(p.id)}
              aria-current={active ? 'true' : undefined}
            >
              <span className="ui-avatar">{p.patient.initials}</span>
              <span className="tp-plan-item-body">
                <span className="tp-plan-item-top">
                  <span className="tp-plan-item-name">{p.patient.name}</span>
                  <span className={`ui-pill ${PLAN_STATUS_TONE[p.status]}`}>{PLAN_STATUS_LABEL[p.status]}</span>
                </span>
                <span className="tp-plan-item-title">{p.title}</span>
                <span className="tp-plan-item-meta">
                  {p.id} · {count} {count === 1 ? 'procedure' : 'procedures'}
                </span>
              </span>
              <CaretRight size={11} className="tp-plan-item-chev" weight="bold" />
            </button>
          )
        })}
        {plans.length === 0 && (
          <div className="ui-empty">
            <strong>No plans match</strong>
            <span>Try widening your filters or clearing the search.</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface ProcedureRowProps {
  procedure: TreatmentProcedure
  providerName: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onSchedule: (pr: TreatmentProcedure) => void
  onComplete: (pr: TreatmentProcedure) => void
  onReturnPending: (pr: TreatmentProcedure) => void
}

function ProcedureRow({
  procedure: pr,
  providerName,
  expanded,
  onToggle,
  onEdit,
  onSchedule,
  onComplete,
  onReturnPending,
}: ProcedureRowProps) {
  const teeth = pr.toothSelection.teeth.length > 0 ? pr.toothSelection.teeth.join(', ') : 'None'

  return (
    <div className={`tp-proc${expanded ? ' expanded' : ''}`}>
      <button type="button" className="tp-proc-row" onClick={onToggle} aria-expanded={expanded}>
        <span className="tp-proc-caret">
          <CaretDown size={12} weight="bold" />
        </span>
        <span className="tp-proc-name">
          <span className="tp-proc-title">{pr.procedureName}</span>
          <span className="tp-proc-code">{pr.code}</span>
        </span>
        <span className="tp-proc-teeth">#{teeth}</span>
        <span className={`ui-pill ${PROC_STATUS_TONE[pr.status]}`}>{PROC_STATUS_LABEL[pr.status]}</span>
        <span className="tp-proc-fee">{currencyWhole(pr.fee)}</span>
      </button>

      {expanded && (
        <div className="tp-proc-detail">
          <div className="tp-proc-grid">
            <DetailCell label="Category" value={pr.category} />
            <DetailCell label="Provider" value={providerName} />
            <DetailCell label="Teeth" value={teeth} />
            <DetailCell label="Planned date" value={pr.plannedDate ? dateShort(pr.plannedDate) : '—'} />
            <DetailCell label="Scheduled date" value={pr.scheduledDate ? dateShort(pr.scheduledDate) : '—'} />
            <DetailCell label="Completed date" value={pr.completedDate ? dateShort(pr.completedDate) : '—'} />
            <DetailCell label="Fee" value={currency(pr.fee)} strong />
            <DetailCell label="Insurance estimate" value={currency(pr.insuranceEstimate)} />
            <DetailCell label="Patient responsibility" value={currency(pr.patientResponsibility)} strong />
          </div>
          {pr.notes && (
            <div className="tp-proc-notes">
              <span className="tp-meta-label">Clinical note</span>
              <p>{pr.notes}</p>
            </div>
          )}
          <div className="tp-proc-actions">
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-xs" onClick={onEdit}>
              <PencilSimple size={11} />
              Edit
            </button>
            {pr.status !== 'scheduled' && (
              <button
                type="button"
                className="ui-btn ui-btn-soft ui-btn-xs"
                onClick={() => onSchedule(pr)}
                disabled={pr.status === 'completed'}
              >
                <CalendarCheck size={11} />
                Schedule
              </button>
            )}
            {pr.status !== 'completed' && (
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-xs" onClick={() => onComplete(pr)}>
                <Check size={11} weight="bold" />
                Complete
              </button>
            )}
            {(pr.status === 'scheduled' || pr.status === 'in_progress' || pr.status === 'completed') && (
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-xs" onClick={() => onReturnPending(pr)}>
                <ArrowCounterClockwise size={11} />
                Return to pending
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="tp-detail-cell">
      <span className="tp-meta-label">{label}</span>
      <span className={`tp-meta-value${strong ? ' strong' : ''}`}>{value}</span>
    </div>
  )
}

interface FinancialSidebarProps {
  plan: TreatmentPlan
  financials: ReturnType<typeof planFinancials>
  insurance?: InsuranceBenefit
  onToggleTask: (taskId: string) => void
  onSend: () => void
  onExport: () => void
}

function FinancialSidebar({
  plan,
  financials: fin,
  insurance,
  onToggleTask,
  onSend,
  onExport,
}: FinancialSidebarProps) {
  const tasks = plan.careTasks ?? DEFAULT_TASKS
  const remaining = insurance ? Math.max(0, insurance.annualMaximum - insurance.usedThisYear) : null

  return (
    <div className="tp-fin">
      <div className="tp-fin-card">
        <div className="tp-fin-head">
          <h4>Financial Summary</h4>
          <span className="ui-pill ui-pill-blue">{fin.coveragePercent}% covered</span>
        </div>
        <div className="tp-fin-donut">
          <DonutChart
            size={128}
            thickness={15}
            segments={[
              { value: fin.estimatedValue > 0 ? fin.insuranceContribution : 0, color: '#2563eb', label: 'Insurance' },
              { value: fin.estimatedValue > 0 ? fin.patientShare : 0, color: '#cbd5e1', label: 'Patient' },
            ]}
            centerTitle={currencyWhole(fin.estimatedValue)}
            centerSub="Plan value"
          />
        </div>
        <div className="tp-fin-rows">
          <div className="tp-fin-row">
            <span className="dot-blue" />
            <span>Insurance contribution</span>
            <strong>{currencyWhole(fin.insuranceContribution)}</strong>
          </div>
          <div className="tp-fin-row">
            <span className="dot-slate" />
            <span>Patient share</span>
            <strong>{currencyWhole(fin.patientShare)}</strong>
          </div>
          <div className="tp-fin-row total">
            <span />
            <span>Estimated plan value</span>
            <strong>{currencyWhole(fin.estimatedValue)}</strong>
          </div>
        </div>
      </div>

      <div className="tp-fin-card">
        <div className="tp-fin-head">
          <h4>Coverage & Benefits</h4>
          <span className="tp-provider-chip">
            <BuildingOffice size={11} />
            {insurance?.provider ?? 'Self-pay'}
          </span>
        </div>

        <div className="tp-coverage">
          <div className="tp-coverage-top">
            <span>Insurance coverage</span>
            <strong>{fin.coveragePercent}%</strong>
          </div>
          <div className="ui-progress">
            <div className="ui-progress-fill" style={{ width: `${fin.coveragePercent}%` }} />
          </div>
        </div>

        <div className="tp-benefit-list">
          <div className="tp-benefit-item">
            <span className="tp-benefit-label">Pre-authorization</span>
            <BenefitPill preAuth={insurance?.preAuthStatus ?? 'not_required'} />
          </div>
          <div className="tp-benefit-item">
            <span className="tp-benefit-label">Eligibility</span>
            <EligibilityPill eligibility={insurance?.eligibilityStatus ?? 'not_verified'} />
          </div>
          {insurance && (
            <div className="tp-benefit-item">
              <span className="tp-benefit-label">Last verified</span>
              <span className="tp-benefit-value mono">{insurance.lastVerified ? dateShort(insurance.lastVerified) : '—'}</span>
            </div>
          )}
        </div>

        {remaining !== null && (
          <div className="tp-limit">
            <div className="tp-coverage-top">
              <span>Annual plan limit</span>
              <strong>
                {currencyWhole(remaining)} <span className="muted">remaining</span>
              </strong>
            </div>
            <div className="ui-progress">
              <div
                className="ui-progress-fill amber"
                style={{ width: `${Math.min(100, (insurance?.usedThisYear ?? 0) / (insurance?.annualMaximum ?? 1) * 100)}%` }}
              />
            </div>
            <div className="tp-limit-sub">
              {currencyWhole(insurance?.usedThisYear ?? 0)} of {currencyWhole(insurance?.annualMaximum ?? 0)} used this year
            </div>
          </div>
        )}
      </div>

      <div className="tp-fin-card">
        <div className="tp-fin-head">
          <h4>Next Steps</h4>
        </div>
        <div className="tp-checklist">
          {tasks.map((task) => (
            <label key={task.id} className={`tp-task${task.done ? ' done' : ''}`}>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onToggleTask(task.id)}
              />
              <span>{task.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="tp-fin-actions">
        <button type="button" className="ui-btn ui-btn-primary tp-fin-send" onClick={onSend}>
          <PaperPlaneTilt size={13} weight="bold" />
          Send to Patient
        </button>
        <button type="button" className="ui-btn ui-btn-secondary tp-fin-export" onClick={onExport}>
          <FileArrowDown size={13} />
          Export Plan PDF
        </button>
      </div>

      <div className="tp-insights">
        <Sparkle size={14} className="tp-insights-icon" />
        <div>
          <strong>Clinical Insights</strong>
          <p>Summaries will appear here once intelligence workflows are enabled.</p>
        </div>
      </div>
    </div>
  )
}

function BenefitPill({ preAuth }: { preAuth: PreAuthStatus }) {
  if (preAuth === 'approved')
    return (
      <span className="ui-pill ui-pill-green">
        <SealCheck size={10} weight="fill" /> Approved
      </span>
    )
  if (preAuth === 'requested')
    return (
      <span className="ui-pill ui-pill-amber">
        <Hourglass size={10} weight="fill" /> Requested
      </span>
    )
  if (preAuth === 'denied')
    return (
      <span className="ui-pill ui-pill-red">
        <Warning size={10} weight="fill" /> Denied
      </span>
    )
  return <span className="ui-pill ui-pill-slate">Not required</span>
}

function EligibilityPill({ eligibility }: { eligibility: EligibilityStatus }) {
  if (eligibility === 'verified')
    return (
      <span className="ui-pill ui-pill-green">
        <ShieldCheck size={10} weight="fill" /> Verified
      </span>
    )
  if (eligibility === 'pending')
    return (
      <span className="ui-pill ui-pill-amber">
        <Hourglass size={10} weight="fill" /> Pending
      </span>
    )
  return (
    <span className="ui-pill ui-pill-red">
      <Warning size={10} weight="fill" /> Not verified
    </span>
  )
}

interface ProcedureDraft {
  procedureName: string
  code: string
  category: TreatmentCategory
  teeth: number[]
  providerId: string
  fee: number
  insuranceEstimate: number
  plannedDate: string
  notes: string
}

interface ProcModalState {
  key: string
  mode: 'add' | 'edit'
  planId: string
  phaseId: string | undefined
  existing?: TreatmentProcedure
}

interface ProcedureModalProps {
  mode: 'add' | 'edit'
  plan: TreatmentPlan
  phaseId: string | undefined
  existing?: TreatmentProcedure
  coveragePct: number
  catalog: ProcedureCatalogEntry[]
  providers: { id: string; name: string; role: string; title: string }[]
  onClose: () => void
  onSave: (draft: ProcedureDraft) => void
}

const CATEGORY_OPTIONS: TreatmentCategory[] = [
  'Diagnostic',
  'Preventive',
  'Restorative',
  'Endodontics',
  'Oral Surgery',
  'Periodontics',
  'Prosthodontics',
  'Orthodontics',
  'Cosmetic',
]

function ProcedureModal({ mode, plan, existing, coveragePct, catalog, providers, onClose, onSave }: ProcedureModalProps) {
  const [search, setSearch] = useState('')
  const [name, setName] = useState(existing?.procedureName ?? '')
  const [code, setCode] = useState(existing?.code ?? '')
  const [category, setCategory] = useState<TreatmentCategory>(existing?.category ?? 'Restorative')
  const [teeth, setTeeth] = useState<number[]>(existing?.toothSelection.teeth ?? [])
  const [provider, setProvider] = useState(existing?.providerId ?? 'DOC-01')
  const [fee, setFee] = useState(existing?.fee ?? 0)
  const [insurance, setInsurance] = useState(existing?.insuranceEstimate ?? 0)
  const [plannedDate, setPlannedDate] = useState(existing?.plannedDate ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const patientShare = Math.max(0, fee - insurance)

  const query = search.trim().toLowerCase()
  const results = useMemo(
    () =>
      catalog.filter(
        (c) =>
          !query ||
          c.name.toLowerCase().includes(query) ||
          c.code.toLowerCase().includes(query),
      ).slice(0, 6),
    [query, catalog],
  )

  const pickCatalog = (entry: ProcedureCatalogEntry) => {
    setName(entry.name)
    setCode(entry.code)
    setCategory(entry.category)
    setFee(entry.defaultFee)
    setInsurance(Math.round((entry.defaultFee * coveragePct) / 100))
  }

  const toggleTooth = (t: number) => {
    setTeeth((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const handleFee = (v: string) => {
    const n = Number(v) || 0
    setFee(Math.max(0, n))
  }

  const save = () => {
    onSave({
      procedureName: name,
      code,
      category,
      teeth,
      providerId: provider,
      fee,
      insuranceEstimate: insurance,
      plannedDate,
      notes,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'add' ? 'Add Procedure' : 'Edit Procedure'}
      subtitle={`${plan.patient.name} · ${plan.title}`}
      size="lg"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={save}>
            {mode === 'add' ? 'Add to Plan' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="pm-search">
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-search">
            Procedure search
          </label>
          <input
            id="pm-search"
            className="ui-input"
            type="text"
            placeholder="Search catalog by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {results.length > 0 && (
          <div className="pm-catalog">
            {results.map((c) => (
              <button key={c.code} type="button" className="pm-catalog-item" onClick={() => pickCatalog(c)}>
                <span className="pm-catalog-code">{c.code}</span>
                <span className="pm-catalog-name">{c.name}</span>
                <span className="ui-pill ui-pill-slate">{c.category}</span>
                <span className="pm-catalog-fee mono">{currencyWhole(c.defaultFee)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ui-form-grid">
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="pm-name">
            Procedure name
          </label>
          <input
            id="pm-name"
            className="ui-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crown – Porcelain/Ceramic"
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-code">
            CDT code
          </label>
          <input
            id="pm-code"
            className="ui-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="D____"
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-category">
            Treatment category
          </label>
          <select
            id="pm-category"
            className="ui-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as TreatmentCategory)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-provider">
            Provider
          </label>
          <select
            id="pm-provider"
            className="ui-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-date">
            Planned date
          </label>
          <input
            id="pm-date"
            className="ui-input"
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-fee">
            Fee (${fee})
          </label>
          <input
            id="pm-fee"
            className="ui-input"
            type="number"
            min={0}
            value={fee || ''}
            onChange={(e) => handleFee(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-ins">
            Insurance estimate
          </label>
          <input
            id="pm-ins"
            className="ui-input"
            type="number"
            min={0}
            value={insurance || ''}
            onChange={(e) => setInsurance(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="pm-notes">
            Clinical notes
          </label>
          <textarea
            id="pm-notes"
            className="ui-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional clinical rationale…"
          />
        </div>
      </div>

      <div className="pm-share">
        <span>
          Patient responsibility <strong className="mono">{currency(patientShare)}</strong>
        </span>
        <span>
          Coverage {coveragePct}% · auto-estimate is editable
        </span>
      </div>

      <div className="pm-teeth">
        <div className="pm-teeth-head">
          <span className="ui-label">Tooth selection</span>
          <span className="ui-hint">
            {teeth.length === 0 ? 'No teeth selected' : `Selected: #${[...teeth].sort((a, b) => a - b).join(', #')}`}
          </span>
        </div>
        <ToothSelectorRing selected={teeth} onToggle={toggleTooth} />
      </div>
    </Modal>
  )
}

function ToothSelectorRing({
  selected,
  onToggle,
}: {
  selected: number[]
  onToggle: (t: number) => void
}) {
  const rows = [
    { label: 'UR', teeth: [1, 2, 3, 4, 5, 6, 7, 8] },
    { label: 'UL', teeth: [9, 10, 11, 12, 13, 14, 15, 16] },
    { label: 'LR', teeth: [32, 31, 30, 29, 28, 27, 26, 25] },
    { label: 'LL', teeth: [24, 23, 22, 21, 20, 19, 18, 17] },
  ]
  return (
    <div className="pm-tooth-rows">
      {rows.map((row) => (
        <div key={row.label} className="pm-tooth-row">
          <span className="pm-tooth-quad">{row.label}</span>
          {row.teeth.map((t) => (
            <button
              key={t}
              type="button"
              className={`pm-tooth${selected.includes(t) ? ' on' : ''}`}
              aria-pressed={selected.includes(t)}
              onClick={() => onToggle(t)}
            >
              {t}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

interface NewPlanInput {
  patientId: string
  title: string
  description: string
  startAsDraft: boolean
}

function CreatePlanModal({
  patients,
  onClose,
  onCreate,
}: {
  patients: { id: string; name: string }[]
  onClose: () => void
  onCreate: (input: NewPlanInput) => void
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAsDraft, setStartAsDraft] = useState(true)

  const submit = () => {
    onCreate({ patientId, title, description, startAsDraft })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Treatment Plan"
      subtitle="Start with a draft, build phases, then request approval."
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={submit}>
            <Plus size={13} weight="bold" />
            Create Draft
          </button>
        </>
      }
    >
      <div className="ui-form-grid">
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="np-patient">
            Patient
          </label>
          <select
            id="np-patient"
            className="ui-select"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        </div>
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="np-title">
            Plan name
          </label>
          <input
            id="np-title"
            className="ui-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Full-Mouth Restoration"
          />
        </div>
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="np-desc">
            Clinical notes <span className="ui-hint">(optional)</span>
          </label>
          <textarea
            id="np-desc"
            className="ui-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize the clinical findings and treatment rationale…"
          />
        </div>
        <label className="np-draft">
          <input
            type="checkbox"
            checked={startAsDraft}
            onChange={(e) => setStartAsDraft(e.target.checked)}
          />
          <span>
            Start as draft
            <span className="ui-hint">Unchecked, the plan will move straight to pending approval.</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}