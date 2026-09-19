import { useEffect, useMemo, useState } from 'react'
import {
  Bank,
  CaretDown,
  Check,
  CheckCircle,
  CurrencyDollar,
  FolderSimplePlus,
  NotePencil,
  Plus,
  Prohibit,
  Trash,
  Users,
} from '@phosphor-icons/react'
import './treatment_workbench.css'
import type { Dentition } from './odontogram_model'
import type { PlanGroup, TreatmentCategory, TreatmentRecord, TreatmentStatus } from '../types'
import { api, useBackendReady, type PatientRecord } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { currency, dateShort } from '../utils/format'
import { Modal } from '../components/Modal'
import { useToast } from '../components/toastStore'
import { Odontogram } from './Odontogram'

// ---------------------------------------------------------------------------
// Treatment workbench — record procedures on a patient, mark them done and
// collect per-procedure payments. A treatment plan is an optional named group
// a procedure can belong to; there are no phases or approval workflows.
// ---------------------------------------------------------------------------

interface TreatmentPlansProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

type RowFilter = 'all' | TreatmentStatus

const ADULT_ROWS: Record<string, number[]> = {
  UR: [1, 2, 3, 4, 5, 6, 7, 8],
  UL: [9, 10, 11, 12, 13, 14, 15, 16],
  LL: [17, 18, 19, 20, 21, 22, 23, 24],
  LR: [25, 26, 27, 28, 29, 30, 31, 32],
}

const CHILD_ROWS: Record<string, string[]> = {
  Upper: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  Lower: ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
}

const CATEGORIES = [
  'Diagnostic', 'Preventive', 'Restorative', 'Endodontics', 'Oral Surgery',
  'Periodontics', 'Prosthodontics', 'Orthodontics', 'Cosmetic', 'General',
]

const METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'check', label: 'Check' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

const ToothPicker = ({
  dentition,
  selected,
  onToggle,
}: {
  dentition: Dentition
  selected: Array<number | string>
  onToggle: (t: number | string) => void
}) => {
  const rows: Record<string, Array<number | string>> = dentition === 'child' ? CHILD_ROWS : ADULT_ROWS
  return (
    <div className="wb-toothpicks">
      {Object.entries(rows).map(([quad, teeth]) => (
        <div key={quad} className="wb-toothpick-row">
          <span className="wb-toothpick-quad">{quad}</span>
          {teeth.map((t) => (
            <button
              key={String(t)}
              type="button"
              className={`wb-toothpick${selected.includes(t) ? ' on' : ''}`}
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

interface AddModalState {
  mode: 'create' | 'edit'
  rec?: TreatmentRecord
  presetTeeth?: Array<number | string>
}

const TreatmentPlans = ({ searchQuery, createOpen, onCreateOpenChange }: TreatmentPlansProps) => {
  const toast = useToast()
  const ready = useBackendReady()
  const { patients, providers, catalog } = useLookups()

  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([])
  const [groups, setGroups] = useState<PlanGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickQuery, setPickQuery] = useState('')
  const [dentition, setDentition] = useState<Dentition>('adult')
  const [rowFilter, setRowFilter] = useState<RowFilter>('all')
  const [selectedTooth, setSelectedTooth] = useState<number | string | null>(null)
  const [addOpen, setAddOpen] = useState<AddModalState | null>(null)
  const [payRec, setPayRec] = useState<TreatmentRecord | null>(null)

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) ?? null

  const pickList = useMemo(() => {
    const q = (pickQuery || searchQuery).trim().toLowerCase()
    return patients.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    )
  }, [patients, pickQuery, searchQuery])

  const providerById = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers])

  useEffect(() => {
    if (ready && patients.length > 0 && !selectedPatient) {
      setSelectedPatientId(pickList[0]?.id ?? patients[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, patients])

  useEffect(() => {
    if (createOpen) {
      setPickerOpen(true)
      onCreateOpenChange(false)
    }
  }, [createOpen, onCreateOpenChange])

  useEffect(() => {
    if (selectedPatient) setDentition(selectedPatient.age < 16 ? 'child' : 'adult')
  }, [selectedPatient])

  useEffect(() => {
    setSelectedTooth(null)
    setRowFilter('all')
    if (!selectedPatientId) {
      setTreatments([])
      return
    }
    let alive = true
    setLoading(true)
    api
      .treatments(selectedPatientId)
      .then((tr) => {
        if (alive) setTreatments(tr)
      })
      .catch((e) => toast.push(e instanceof Error ? e.message : 'Failed to load treatments', { tone: 'danger' }))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedPatientId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return
    let alive = true
    api
      .planGroups()
      .then((g) => {
        if (alive) setGroups(g)
      })
      .catch(() => {
        /* groups are auxiliary */
      })
    return () => {
      alive = false
    }
  }, [ready])

  const reload = async () => {
    if (!selectedPatientId) return
    setTreatments(await api.treatments(selectedPatientId))
    setGroups(await api.planGroups())
  }

  const patientGroups = useMemo(
    () => groups.filter((g) => g.patient.id === selectedPatientId),
    [groups, selectedPatientId],
  )

  const toothTreatments = useMemo(() => {
    if (selectedTooth === null) return []
    return treatments.filter((t) => t.teeth.includes(selectedTooth))
  }, [treatments, selectedTooth])

  const filtered = useMemo(() => {
    if (rowFilter === 'all') return treatments
    return treatments.filter((t) => t.status === rowFilter)
  }, [treatments, rowFilter])

  const plannedCount = treatments.filter((t) => t.status === 'planned').length
  const dentalFees = treatments.reduce((sum, t) => sum + t.fee, 0)
  const paidSoFar = treatments.reduce((sum, t) => sum + t.amountPaid + t.insuranceAmount, 0)

  const handleAdd = async (payload: {
    procedureName: string
    code: string
    category: string
    fee: number
    teeth: Array<number | string>
    providerId: string
    planId: string | null
    status: TreatmentStatus
    notes: string
  }) => {
    try {
      await api.createTreatment({ ...payload, patientId: selectedPatientId })
      toast.push('Treatment added')
      setAddOpen(null)
      await reload()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to add treatment', { tone: 'danger' })
    }
  }

  const handleEdit = async (rec: TreatmentRecord, payload: {
    procedureName: string
    code: string
    category: string
    fee: number
    teeth: Array<number | string>
    providerId: string
    planId: string | null
    status: TreatmentStatus
    notes: string
  }) => {
    try {
      await api.updateTreatment(rec.id, { ...payload, doneDate: payload.status === 'done' ? rec.doneDate : null })
      toast.push('Treatment updated')
      setAddOpen(null)
      await reload()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to update treatment', { tone: 'danger' })
    }
  }

  const toggleDone = async (rec: TreatmentRecord) => {
    const next: TreatmentStatus = rec.status === 'done' ? 'planned' : 'done'
    try {
      await api.updateTreatment(rec.id, { status: next, doneDate: next === 'done' ? null : null })
      await reload()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to update', { tone: 'danger' })
    }
  }

  const remove = async (rec: TreatmentRecord) => {
    try {
      await api.deleteTreatment(rec.id)
      toast.push('Treatment deleted')
      await reload()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to delete', { tone: 'danger' })
    }
  }

  const handlePay = async (rec: TreatmentRecord, payload: {
    amountPaid: number
    insuranceAmount: number
    method: string
    date: string
    reference: string
  }) => {
    try {
      await api.recordTreatmentPayment(rec.id, payload)
      toast.push('Payment recorded')
      setPayRec(null)
      await reload()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to record payment', { tone: 'danger' })
    }
  }

  const createGroup = async (name: string) => {
    try {
      const g = await api.createPlanGroup({ patientId: selectedPatientId, name })
      setGroups(await api.planGroups())
      return g
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to create group', { tone: 'danger' })
      return null
    }
  }

  const deleteGroup = async (g: PlanGroup) => {
    try {
      await api.deletePlanGroup(g.id)
      await reload()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to delete group', { tone: 'danger' })
    }
  }

  const openAddForTooth = (tooth: number | string) => {
    setAddOpen({ mode: 'create', presetTeeth: [tooth] })
  }

  return (
    <div className="wb-page">
      <div className="wb-toolbar">
        <div className="wb-patient-pick">
          {selectedPatient ? (
            <button type="button" className="wb-pick-trigger" onClick={() => setPickerOpen((v) => !v)}>
              <span className="wb-avatar">{selectedPatient.initials}</span>
              <span className="wb-pick-name">
                <strong>{selectedPatient.name}</strong>
                <small>
                  {selectedPatient.gender}, {selectedPatient.age} · {selectedPatient.insuranceProvider || 'Self-pay'}
                </small>
              </span>
              <CaretDown size={13} weight="bold" />
            </button>
          ) : (
            <button type="button" className="wb-pick-trigger" onClick={() => setPickerOpen((v) => !v)}>
              <Users size={15} />
              <span className="wb-pick-name">
                <strong>Choose a patient</strong>
                <small>Start a treatment session</small>
              </span>
              <CaretDown size={13} weight="bold" />
            </button>
          )}
          {pickerOpen && (
            <div className="wb-pick-menu">
              <div className="wb-pick-head">
                <input
                  value={pickQuery}
                  onChange={(e) => setPickQuery(e.target.value)}
                  placeholder="Search patients…"
                  className="wb-pick-search"
                />
              </div>
              <div className="wb-pick-list">
                {pickList.length === 0 && <div className="wb-pick-empty">No patients found</div>}
                {pickList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`wb-pick-item${p.id === selectedPatientId ? ' on' : ''}`}
                    onClick={() => {
                      setSelectedPatientId(p.id)
                      setPickerOpen(false)
                    }}
                  >
                    <span className="wb-avatar">{p.initials}</span>
                    <span className="wb-pick-name">
                      <strong>{p.name}</strong>
                      <small>
                        {p.gender}, {p.age} · {p.insuranceProvider || 'Self-pay'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="wb-toolbar-right">
          <div className="wb-seg" role="group" aria-label="Dentition">
            <button
              type="button"
              className={dentition === 'adult' ? 'on' : ''}
              onClick={() => setDentition('adult')}
            >
              Adult
            </button>
            <button
              type="button"
              className={dentition === 'child' ? 'on' : ''}
              onClick={() => setDentition('child')}
            >
              Child
            </button>
          </div>
          <button
            type="button"
            className="wb-primary"
            disabled={!selectedPatient}
            onClick={() => setAddOpen({ mode: 'create' })}
          >
            <Plus size={14} weight="bold" />
            Add Treatment
          </button>
        </div>
      </div>

      {selectedPatient ? (
        <div className="wb-grid">
          <section className="wb-card wb-odo">
            <div className="wb-card-head">
              <div>
                <h3>Odontogram</h3>
                <p>
                  Click a tooth to view its treatments and actions
                </p>
              </div>
              <span className="wb-fill-meta">
                {dentition === 'child' ? 'Primary dentition (A–T)' : 'Universal dentition (1–32)'}
              </span>
            </div>
            <Odontogram
              dentition={dentition}
              procedures={treatments}
              selectedTooth={selectedTooth}
              onToothClick={(n) => setSelectedTooth((cur) => (cur === n ? null : n))}
            />

            {selectedTooth !== null && (
              <div className="wb-tooth-strip">
                <div className="wb-tooth-strip-head">
                  <strong>Tooth {selectedTooth}</strong>
                  <button
                    type="button"
                    className="wb-link"
                    onClick={() => openAddForTooth(selectedTooth)}
                  >
                    <Plus size={12} weight="bold" /> Add treatment
                  </button>
                </div>
                {toothTreatments.length === 0 && (
                  <p className="wb-tooth-strip-empty">No treatments recorded on this tooth yet.</p>
                )}
                {toothTreatments.map((t) => (
                  <div key={t.id} className="wb-tooth-row">
                    <span className={`wb-pill ${t.status === 'done' ? 'wb-pill-done' : 'wb-pill-planned'}`}>
                      {t.status === 'done' ? 'Done' : 'Planned'}
                    </span>
                    <span className="wb-tooth-row-name">{t.procedureName}</span>
                    <span className="wb-tooth-row-fee">{currency(t.fee)}</span>
                    {t.balance > 0 ? (
                      <button type="button" className="wb-mini" onClick={() => setPayRec(t)}>
                        <CurrencyDollar size={12} weight="bold" /> {currency(t.balance)}
                      </button>
                    ) : (
                      <span className="wb-paid-tag"><Check size={12} weight="bold" /> Paid</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="wb-card wb-list">
            <div className="wb-card-head">
              <div>
                <h3>Treatments</h3>
                <p>
                  {treatments.length} recorded · {plannedCount} planned ·{' '}
                  {currency(dentalFees)} fee · {currency(paidSoFar)} collected
                </p>
              </div>
              <div className="wb-seg wb-seg-sm" role="group" aria-label="Filter treatments">
                <button type="button" className={rowFilter === 'all' ? 'on' : ''} onClick={() => setRowFilter('all')}>All</button>
                <button type="button" className={rowFilter === 'planned' ? 'on' : ''} onClick={() => setRowFilter('planned')}>Planned</button>
                <button type="button" className={rowFilter === 'done' ? 'on' : ''} onClick={() => setRowFilter('done')}>Done</button>
              </div>
            </div>

            {loading ? (
              <div className="wb-empty">Loading treatments…</div>
            ) : filtered.length === 0 ? (
              <div className="wb-empty">
                No {rowFilter === 'all' ? '' : rowFilter} treatments yet.
              </div>
            ) : (
              <div className="wb-list-scroll">
                {filtered.map((t) => (
                  <div key={t.id} className="wb-row">
                    <div className="wb-row-main">
                      <div className="wb-row-title">
                        <span className={`wb-pill ${t.status === 'done' ? 'wb-pill-done' : 'wb-pill-planned'}`}>
                          {t.status === 'done' ? 'Done' : 'Planned'}
                        </span>
                        <strong>{t.procedureName}</strong>
                        {t.code && <span className="wb-code">{t.code}</span>}
                      </div>
                      <div className="wb-row-meta">
                        <span>{t.category}</span>
                        {t.teeth.length > 0 && (
                          <span className="wb-chips">
                            {t.teeth.map((n) => (
                              <span key={String(n)} className="wb-chip">
                                {n}
                              </span>
                            ))}
                          </span>
                        )}
                        {t.planName && <span className="wb-group-tag"><Bank size={11} weight="fill" /> {t.planName}</span>}
                        {t.providerId && <span className="wb-muted">{providerById.get(t.providerId) ?? ''}</span>}
                        {t.status === 'done' && t.doneDate && <span className="wb-muted">{dateShort(t.doneDate)}</span>}
                      </div>
                    </div>
                    <div className="wb-row-fig">
                      <strong>{currency(t.fee)}</strong>
                      <small>
                        {t.amountPaid > 0 && <>Paid {currency(t.amountPaid)}</>}
                        {t.insuranceAmount > 0 && <> · Ins {currency(t.insuranceAmount)}</>}
                        {t.balance > 0 && <> · Due {currency(t.balance)}</>}
                        {t.applied === 0 && 'No payment'}
                      </small>
                    </div>
                    <div className="wb-row-actions">
                      {t.status === 'planned' ? (
                        <button type="button" className="wb-action" title="Mark done" onClick={() => void toggleDone(t)}>
                          <CheckCircle size={15} />
                        </button>
                      ) : (
                        <button type="button" className="wb-action" title="Revert to planned" onClick={() => void toggleDone(t)}>
                          <Prohibit size={15} />
                        </button>
                      )}
                      {t.balance > 0 && (
                        <button type="button" className="wb-action wb-action-pay" title="Record payment" onClick={() => setPayRec(t)}>
                          <CurrencyDollar size={15} weight="bold" />
                        </button>
                      )}
                      <button type="button" className="wb-action" title="Edit treatment" onClick={() => setAddOpen({ mode: 'edit', rec: t })}>
                        <NotePencil size={15} />
                      </button>
                      <button type="button" className="wb-action wb-action-danger" title="Delete" onClick={() => void remove(t)}>
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="wb-groups">
              <div className="wb-groups-head">
                <span>
                  <Bank size={13} weight="bold" /> Plan groups
                </span>
                {patientGroups.length > 0 && (
                  <span className="wb-muted">{patientGroups.length}</span>
                )}
              </div>
              {patientGroups.length === 0 && (
                <p className="wb-groups-empty">No plan groups for this patient — treatments can be grouped under a named plan.</p>
              )}
              {patientGroups.map((g) => (
                <div key={g.id} className="wb-group-row">
                  <div>
                    <strong>{g.name}</strong>
                    <small>
                      {g.procedureCount} treatment{g.procedureCount === 1 ? '' : 's'} · created {dateShort(g.createdAt.split(' ')[0])}
                    </small>
                  </div>
                  <button type="button" className="wb-action wb-action-danger" title="Delete group" onClick={() => void deleteGroup(g)}>
                    <Trash size={14} />
                  </button>
                </div>
              ))}
              <CreateGroupInline
                onDone={async (name) => {
                  const g = await createGroup(name)
                  if (g) toast.push(`Plan group "${name}" created`)
                }}
              />
            </div>
          </section>
        </div>
      ) : (
        <div className="wb-card wb-empty wb-empty-big">
          <Users size={28} weight="duotone" />
          <h3>Select a patient to start</h3>
          <p>The treatment workbench records procedures per patient — choose one above to begin.</p>
        </div>
      )}

      {addOpen && (
        <TreatmentModal
          patient={selectedPatient}
          dentition={dentition}
          groups={patientGroups}
          providers={providers.map((p) => ({ id: p.id, name: p.name }))}
          catalog={catalog}
          state={addOpen}
          onClose={() => setAddOpen(null)}
          onCreateGroup={createGroup}
          onSave={(payload) => {
            if (addOpen.mode === 'edit' && addOpen.rec) {
              return void handleEdit(addOpen.rec, payload)
            }
            return void handleAdd(payload)
          }}
        />
      )}

      {payRec && (
        <PaymentModal
          rec={payRec}
          onClose={() => setPayRec(null)}
          onSave={(payload) => void handlePay(payRec, payload)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create / edit treatment modal
// ---------------------------------------------------------------------------

interface TreatmentModalProps {
  patient: PatientRecord | null
  dentition: Dentition
  groups: PlanGroup[]
  providers: Array<{ id: string; name: string }>
  catalog: { code: string; name: string; defaultFee: number }[]
  state: AddModalState
  onClose: () => void
  onCreateGroup: (name: string) => Promise<PlanGroup | null>
  onSave: (payload: {
    procedureName: string
    code: string
    category: string
    fee: number
    teeth: Array<number | string>
    providerId: string
    planId: string | null
    status: TreatmentStatus
    notes: string
  }) => void
}

function TreatmentModal({
  patient,
  dentition,
  groups,
  providers,
  catalog,
  state,
  onClose,
  onCreateGroup,
  onSave,
}: TreatmentModalProps) {
  const rec = state.mode === 'edit' ? state.rec : null
  const preset = state.mode === 'create' ? (state.presetTeeth ?? []) : (rec?.teeth ?? [])

  const [name, setName] = useState(rec?.procedureName ?? '')
  const [code, setCode] = useState(rec?.code ?? '')
  const [category, setCategory] = useState(rec?.category ?? 'Restorative')
  const [fee, setFee] = useState(rec?.fee ? String(rec.fee) : '')
  const [teeth, setTeeth] = useState<Array<number | string>>(preset)
  const [providerId, setProviderId] = useState(rec?.providerId ?? providers[0]?.id ?? 'DOC-01')
  const [planId, setPlanId] = useState<string | null>(rec?.planId ?? null)
  const [newGroupMode, setNewGroupMode] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [status, setStatus] = useState<TreatmentStatus>(rec?.status ?? 'planned')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const toggleTooth = (t: number | string) => {
    setTeeth((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.push('Procedure name is required', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      let planIdOut = planId
      if (newGroupMode && newGroupName.trim()) {
        const g = await onCreateGroup(newGroupName.trim())
        if (g) planIdOut = g.id
      }
      onSave({
        procedureName: name.trim(),
        code,
        category,
        fee: Number(fee) || 0,
        teeth,
        providerId,
        planId: planIdOut,
        status,
        notes,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={state.mode === 'edit' ? 'Edit treatment' : 'Add treatment'}
      subtitle={patient ? `${patient.name} · ${patient.insuranceProvider || 'Self-pay'}` : ''}
      size="md"
    >
      <div className="patient-form">
        <label className="pf-field pf-full">
          <span>Procedure name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Root Canal Therapy — Molar" />
        </label>

        <label className="pf-field">
          <span>Type a CDT code</span>
          <input
            list="wb-catalog"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="D2740"
          />
          <datalist id="wb-catalog">
            {catalog.map((c) => (
              <option key={c.code} value={c.code}>{c.name} · ${c.defaultFee}</option>
            ))}
          </datalist>
        </label>

        <label className="pf-field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as TreatmentCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="pf-field">
          <span>Fee ($)</span>
          <input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0.00" />
        </label>

        <label className="pf-field">
          <span>Provider</span>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="pf-field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as TreatmentStatus)}>
            <option value="planned">Planned</option>
            <option value="done">Done</option>
          </select>
        </label>

        <div className="pf-field pf-full">
          <span>Teeth</span>
          <ToothPicker dentition={dentition} selected={teeth} onToggle={toggleTooth} />
        </div>

        <div className="pf-field pf-full">
          <span>Plan group (optional)</span>
          <div className="wb-plan-select">
            <select
              value={planId ?? ''}
              onChange={(e) => {
                setPlanId(e.target.value || null)
                setNewGroupMode(false)
              }}
              disabled={newGroupMode}
            >
              <option value="">— No group —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button type="button" className="wb-link" onClick={() => setNewGroupMode((v) => !v)}>
              <FolderSimplePlus size={13} weight="bold" /> {newGroupMode ? 'Cancel new group' : 'New group'}
            </button>
          </div>
          {newGroupMode && (
            <input
              className="wb-new-group-input"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name, e.g. Full-Mouth Restoration"
            />
          )}
        </div>

        <label className="pf-field pf-full">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </label>
      </div>
      <div className="patient-form-actions">
        <button type="button" className="pf-btn pf-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="pf-btn pf-save" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {state.mode === 'edit' ? 'Save changes' : 'Add treatment'}
        </button>
      </div>
    </Modal>
  )
}

function CreateGroupInline({ onDone }: { onDone: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const toast = useToast()
  return (
    <div className="wb-group-new">
      {open ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Plan group name"
            autoFocus
          />
          <button
            type="button"
            className="wb-mini wb-mini-primary"
            disabled={!name.trim()}
            onClick={() => void (async () => {
              await onDone(name.trim())
              setName('')
              setOpen(false)
              toast.push('Plan group created')
            })()}
          >
            Create
          </button>
          <button type="button" className="wb-mini" onClick={() => setOpen(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="wb-link" onClick={() => setOpen(true)}>
          <FolderSimplePlus size={13} weight="bold" /> New plan group
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment modal — fee is split into patient-paid and insurance portions
// ---------------------------------------------------------------------------

interface PaymentModalProps {
  rec: TreatmentRecord
  onClose: () => void
  onSave: (payload: {
    amountPaid: number
    insuranceAmount: number
    method: string
    date: string
    reference: string
  }) => void
}

function PaymentModal({ rec, onClose, onSave }: PaymentModalProps) {
  const remaining = rec.balance
  const todayIso = new Date().toISOString().slice(0, 10)
  const [amountPaid, setAmountPaid] = useState(remaining > 0 ? String(remaining) : '')
  const [insuranceAmount, setInsuranceAmount] = useState('')
  const [method, setMethod] = useState('card')
  const [date, setDate] = useState(todayIso)
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  const ap = Number(amountPaid) || 0
  const ins = Number(insuranceAmount) || 0
  const invalid = ap + ins <= 0 || ap + ins > rec.fee - (rec.amountPaid + rec.insuranceAmount)

  const handleSave = async () => {
    if (invalid) return
    setSaving(true)
    try {
      onSave({ amountPaid: ap, insuranceAmount: ins, method, date, reference })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      subtitle={`${rec.procedureName} · ${rec.patient.name}`}
      size="sm"
    >
      <div className="wb-pay-summary">
        <div><span>Fee</span><strong>{currency(rec.fee)}</strong></div>
        <div><span>Already paid</span><strong>{currency(rec.amountPaid + rec.insuranceAmount)}</strong></div>
        <div className="wb-pay-due"><span>Due now</span><strong>{currency(remaining)}</strong></div>
        {rec.insuranceProvider && (
          <div className="wb-pay-ins">
            <Bank size={12} weight="fill" /> {rec.insuranceProvider} — enter the insurance portion below
          </div>
        )}
      </div>
      <div className="patient-form">
        <label className="pf-field">
          <span>Patient pays ($)</span>
          <input type="number" min={0} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
        </label>
        <label className="pf-field">
          <span>Insurance ($)</span>
          <input type="number" min={0} step="0.01" value={insuranceAmount} onChange={(e) => setInsuranceAmount(e.target.value)} />
        </label>
        <label className="pf-field">
          <span>Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="pf-field pf-full">
          <span>Reference (optional)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN-…" />
        </label>
      </div>
      {invalid && ap + ins > 0 && (
        <p className="wb-pay-error">Amount + insurance can’t exceed the remaining balance of {currency(remaining)}.</p>
      )}
      <div className="patient-form-actions">
        <button type="button" className="pf-btn pf-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="pf-btn pf-save" onClick={() => void handleSave()} disabled={saving || invalid}>
          <CurrencyDollar size={13} weight="bold" /> Record payment
        </button>
      </div>
    </Modal>
  )
}

export default TreatmentPlans