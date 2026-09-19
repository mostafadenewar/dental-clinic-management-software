import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Funnel,
  Export,
  List,
  SquaresFour,
  SlidersHorizontal,
  Check,
  Eye,
  PencilSimple,
  Trash,
  CaretLeft,
  CalendarBlank,
  Receipt,
} from '@phosphor-icons/react'
import { api, useBackendReady, type PatientHistory, type PatientRecord } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { Modal } from '../components/Modal'
import { PatientCreateModal } from '../components/PatientCreateModal'
import { useToast } from '../components/toastStore'
import { currency, dateShort } from '../utils/format'
import './patients.css'

type FilterKey = 'all' | 'recent' | 'treatment' | 'overdue'
type ViewMode = 'list' | 'grid' | 'compact'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All Patients' },
  { key: 'recent', label: 'Recent' },
  { key: 'treatment', label: 'Active Treatment' },
  { key: 'overdue', label: 'Overdue' },
]

const STATUS_CLASS: Record<PatientRecord['clinicalStatus'], string> = {
  HEALTHY: 'badge-healthy',
  'IN TREATMENT': 'badge-treatment',
  'FOLLOW-UP': 'badge-followup',
  INACTIVE: 'badge-inactive',
}

const APPT_STATUS_CLASS: Record<string, string> = {
  scheduled: 'ph-scheduled',
  confirmed: 'ph-confirmed',
  completed: 'ph-completed',
  cancelled: 'ph-cancelled',
  no_show: 'ph-noshow',
}

const INVOICE_STATUS_CLASS: Record<string, string> = {
  paid: 'ph-paid',
  unpaid: 'ph-unpaid',
  partial: 'ph-partial',
  overdue: 'ph-overdue',
}

const toTime = (hm: string): string => {
  const [h, m] = hm.split(':').map((x) => Number(x) || 0)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve}:${String(m).padStart(2, '0')} ${suffix}`
}

interface PatientsProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

const Patients = ({ searchQuery, createOpen, onCreateOpenChange }: PatientsProps) => {
  const ready = useBackendReady()
  const { insurance } = useLookups()
  const toast = useToast()
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<PatientRecord | null>(null)
  const [history, setHistory] = useState<PatientHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editing, setEditing] = useState<PatientRecord | null>(null)

  const load = useCallback(async () => {
    try {
      setPatients(await api.patients())
    } catch {
      setPatients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  useEffect(() => {
    if (!selected) {
      setHistory(null)
      return
    }
    let live = true
    setHistoryLoading(true)
    api
      .patientHistory(selected.id)
      .then((h) => {
        if (live) setHistory(h)
      })
      .catch(() => {
        if (live) setHistory(null)
      })
      .finally(() => {
        if (live) setHistoryLoading(false)
      })
    return () => {
      live = false
    }
  }, [selected])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let rows = patients
    if (filter === 'recent') {
      rows = [...rows].sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
    } else if (filter === 'treatment') {
      rows = rows.filter((p) => p.clinicalStatus === 'IN TREATMENT')
    } else if (filter === 'overdue') {
      rows = rows.filter((p) => p.overdue)
    }
    if (q) {
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.phone.includes(q),
      )
    }
    return rows
  }, [patients, filter, searchQuery])

  const openEdit = (p: PatientRecord) => {
    setEditing(p)
    onCreateOpenChange(true)
  }

  const closeCreate = () => {
    onCreateOpenChange(false)
    setEditing(null)
  }

  const handleDelete = async (p: PatientRecord) => {
    if (!window.confirm(`Delete ${p.name} (${p.id})?`)) return
    try {
      await api.deletePatient(p.id)
      toast.push(`${p.name} deleted`)
      setSelected(null)
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to delete patient', { tone: 'danger' })
    }
  }

  const insuranceName = (id: string): string => insurance.find((i) => i.id === id)?.provider ?? id

  return (
    <div className="patients-page">
      <section className="tabs-card">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tab${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="tabs-tools">
          <div className="tool-group">
            <button
              type="button"
              className={`tool-btn${filterOpen ? ' tool-active' : ''}`}
              title="Filters"
              onClick={() => setFilterOpen((v) => !v)}
            >
              <Funnel size={14} />
            </button>
            {filterOpen && (
              <div className="filter-menu">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`filter-option${filter === f.key ? ' active' : ''}`}
                    onClick={() => {
                      setFilter(f.key)
                      setFilterOpen(false)
                    }}
                  >
                    <span>{f.label}</span>
                    {filter === f.key && <Check size={12} weight="bold" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="tool-btn" title="Export" onClick={() => toast.push('Export coming soon', { tone: 'info' })}>
            <Export size={14} />
          </button>
          <div className="tool-group">
            <button
              type="button"
              className={`tool-btn${view === 'list' ? ' tool-active' : ''}`}
              title="List view"
              onClick={() => setView('list')}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              className={`tool-btn${view === 'grid' ? ' tool-active' : ''}`}
              title="Grid view"
              onClick={() => setView('grid')}
            >
              <SquaresFour size={14} />
            </button>
          </div>
          <button type="button" className="tool-btn" title="Columns">
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </section>

      <section className="table-card">
        {view === 'list' ? (
          <>
            <div className="pat-header pat-grid">
              <span className="cell c1">PATIENT NAME</span>
              <span className="cell c2">ID</span>
              <span className="cell c3">GENDER / AGE</span>
              <span className="cell c4">LAST VISIT</span>
              <span className="cell c5">STATUS</span>
              <span className="cell c6">OUTSTANDING</span>
              <span className="cell c7">ACTIONS</span>
            </div>

            {loading ? (
              <div className="patients-empty">Loading patients…</div>
            ) : filtered.length === 0 ? (
              <div className="patients-empty">No patients match this view.</div>
            ) : (
              filtered.map((p, index) => (
                <div key={p.id} className="pat-row pat-grid" onClick={() => setSelected(p)}>
                  <div className="cell c1">
                    <div className="pat-name">{p.name}</div>
                    <div className="pat-phone">{p.phone}</div>
                  </div>
                  <span className="cell c2 pat-mono">{p.id}</span>
                  <span className="cell c3">{`${p.gender}, ${p.age}`}</span>
                  <div className="cell c4">
                    <div className="pat-visit">{p.lastVisit ? dateShort(p.lastVisit) : '—'}</div>
                    <div className="pat-doctor">{p.doctorName || '—'}</div>
                  </div>
                  <span className="cell c5">
                    <span className={`status-badge ${STATUS_CLASS[p.clinicalStatus]}`}>{p.clinicalStatus}</span>
                  </span>
                  <span className={`cell c6${p.overdue ? ' overdue' : ''}`}>{currency(p.outstanding)}</span>
                  <span className="cell c7">
                    <button
                      type="button"
                      className="row-action"
                      title="View details"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(p)
                      }}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      className="row-action"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(p)
                      }}
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      type="button"
                      className="row-action"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(p)
                      }}
                    >
                      <Trash size={14} />
                    </button>
                  </span>
                  {index < filtered.length - 1 && <div className="pat-row-sep" style={{ gridColumn: '1 / -1' }} />}
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {loading ? (
              <div className="patients-empty">Loading patients…</div>
            ) : filtered.length === 0 ? (
              <div className="patients-empty">No patients match this view.</div>
            ) : (
              <div className="pat-cards">
                {filtered.map((p) => (
                  <div key={p.id} className="pat-card" onClick={() => setSelected(p)}>
                    <div className="pat-card-top">
                      <span className="pat-card-avatar">{p.initials}</span>
                      <span className={`status-badge ${STATUS_CLASS[p.clinicalStatus]}`}>{p.clinicalStatus}</span>
                    </div>
                    <div className="pat-card-name">{p.name}</div>
                    <div className="pat-card-id">{p.id}</div>
                    <div className="pat-card-rows">
                      <div>
                        <span>Phone</span>
                        <strong>{p.phone || '—'}</strong>
                      </div>
                      <div>
                        <span>Last visit</span>
                        <strong>{p.lastVisit ? dateShort(p.lastVisit) : '—'}</strong>
                      </div>
                      <div>
                        <span>Outstanding</span>
                        <strong className={p.overdue ? 'pat-card-overdue' : undefined}>{currency(p.outstanding)}</strong>
                      </div>
                    </div>
                    <div className="pat-card-actions">
                      <button
                        type="button"
                        className="row-action"
                        title="View details"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(p)
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="row-action"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(p)
                        }}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        className="row-action"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(p)
                        }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="table-footer">
          <span className="showing">
            Showing {filtered.length} of {patients.length} patients
          </span>
          <div className="pagination">
            <button type="button" className="page-num active">1</button>
          </div>
        </div>
      </section>

      <PatientCreateModal
        open={createOpen}
        onClose={closeCreate}
        editing={editing}
        onSaved={() => void load()}
      />

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Patient'}
        subtitle={selected ? `${selected.gender}, ${selected.age} · ${insuranceName(selected.insuranceId) || 'No insurance'}` : undefined}
        size="lg"
      >
        {selected && (
          <div className="patient-detail">
            <div className="pd-stats">
              <div className="pd-stat">
                <span>Status</span>
                <strong className={`status-badge ${STATUS_CLASS[selected.clinicalStatus]}`}>{selected.clinicalStatus}</strong>
              </div>
              <div className="pd-stat">
                <span>Last visit</span>
                <strong>{selected.lastVisit ? dateShort(selected.lastVisit) : '—'}</strong>
              </div>
              <div className="pd-stat">
                <span>Outstanding</span>
                <strong className={selected.overdue ? 'pd-overdue' : undefined}>
                  {currency(selected.outstanding)}
                </strong>
              </div>
            </div>
            <div className="pd-rows">
              <div><span>Patient ID</span><strong>{selected.id}</strong></div>
              <div><span>Phone</span><strong>{selected.phone || '—'}</strong></div>
              <div><span>Email</span><strong>{selected.email || '—'}</strong></div>
              <div><span>Doctor</span><strong>{selected.doctorName || '—'}</strong></div>
              <div><span>Insurance</span><strong>{insuranceName(selected.insuranceId) || '—'}</strong></div>
              <div><span>Member since</span><strong>{selected.createdAt ? dateShort(selected.createdAt) : '—'}</strong></div>
            </div>
            {selected.notes && (
              <div className="pd-notes">
                <span>Notes</span>
                <p>{selected.notes}</p>
              </div>
            )}

            <div className="pd-history">
              <div className="pd-history-block">
                <div className="pd-history-title">
                  <CalendarBlank size={13} weight="bold" />
                  Visit history
                </div>
                {historyLoading ? (
                  <p className="ph-empty">Loading visits…</p>
                ) : history && history.appointments.length ? (
                  <ul className="ph-list">
                    {history.appointments.map((a) => (
                      <li key={a.id} className="ph-item">
                        <span className="ph-date">{dateShort(a.date)}</span>
                        <span className="ph-time">{toTime(a.startTime)}</span>
                        <span className="ph-main">{a.title}</span>
                        <span className="ph-meta">
                          {a.provider || '—'} · {a.room || '—'}
                        </span>
                        <span className={`ph-status ${APPT_STATUS_CLASS[a.status] ?? 'ph-scheduled'}`}>{a.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ph-empty">{history ? 'No visits on record.' : 'Could not load visit history.'}</p>
                )}
              </div>

              <div className="pd-history-block">
                <div className="pd-history-title">
                  <Receipt size={13} weight="bold" />
                  Bills
                </div>
                {historyLoading ? (
                  <p className="ph-empty">Loading bills…</p>
                ) : history && history.invoices.length ? (
                  <ul className="ph-list">
                    {history.invoices.map((inv) => (
                      <li key={inv.id} className="ph-item">
                        <span className="ph-date">{dateShort(inv.createdDate)}</span>
                        <span className="ph-main">{inv.number}</span>
                        <span className="ph-meta">{inv.items.length} line items</span>
                        <span className="ph-amount">{currency(inv.totals.balance)}</span>
                        <span className={`ph-status ${INVOICE_STATUS_CLASS[inv.totals.status] ?? 'ph-unpaid'}`}>
                          {inv.totals.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ph-empty">{history ? 'No bills on record.' : 'Could not load billing history.'}</p>
                )}
              </div>
            </div>

            <div className="patient-form-actions">
              <button type="button" className="pf-btn pf-danger" onClick={() => void handleDelete(selected)}>
                <Trash size={13} weight="bold" /> Delete
              </button>
              <button type="button" className="pf-btn pf-cancel" onClick={() => setSelected(null)}>
                <CaretLeft size={13} weight="bold" /> Close
              </button>
              <button
                type="button"
                className="pf-btn pf-save"
                onClick={() => {
                  setSelected(null)
                  openEdit(selected)
                }}
              >
                Edit patient
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Patients