import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Funnel,
  Export,
  SquaresFour,
  SlidersHorizontal,
  Eye,
  PencilSimple,
  Trash,
  CaretLeft,
} from '@phosphor-icons/react'
import { api, useBackendReady, type PatientRecord } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { Modal } from '../components/Modal'
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

interface PatientForm {
  name: string
  dob: string
  gender: 'Female' | 'Male' | 'Other'
  phone: string
  email: string
  address: string
  insuranceId: string
  notes: string
}

const EMPTY_FORM: PatientForm = {
  name: '',
  dob: '',
  gender: 'Female',
  phone: '',
  email: '',
  address: '',
  insuranceId: '',
  notes: '',
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
  const [view, setView] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<PatientRecord | null>(null)
  const [editing, setEditing] = useState<PatientRecord | null>(null)
  const [form, setForm] = useState<PatientForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
    setForm({
      name: p.name,
      dob: p.dob ?? '',
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      address: p.address,
      insuranceId: p.insuranceId,
      notes: p.notes,
    })
    onCreateOpenChange(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.push('Patient name is required', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.updatePatient(editing.id, form)
        toast.push(`${form.name} updated`)
      } else {
        await api.createPatient(form)
        toast.push(`${form.name} added as a new patient`)
      }
      onCreateOpenChange(false)
      setSelected(null)
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to save patient', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
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

  const formField = (key: keyof PatientForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

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
          <button type="button" className="tool-btn" title="Filters">
            <Funnel size={14} />
          </button>
          <button type="button" className="tool-btn" title="Export" onClick={() => toast.push('Export coming soon', { tone: 'info' })}>
            <Export size={14} />
          </button>
          <button
            type="button"
            className={`tool-btn${view === 'grid' ? ' tool-fill' : ''}`}
            title="Grid view"
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          >
            <SquaresFour size={14} />
          </button>
          <button type="button" className="tool-btn" title="Columns">
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </section>

      <section className="table-card">
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
            <div key={p.id} className={`pat-row pat-grid${view === 'grid' ? ' pat-row-grid' : ''}`}>
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
                <button type="button" className="row-action" title="View details" onClick={() => setSelected(p)}>
                  <Eye size={14} />
                </button>
                <button type="button" className="row-action" title="Edit" onClick={() => openEdit(p)}>
                  <PencilSimple size={14} />
                </button>
                <button type="button" className="row-action" title="Delete" onClick={() => void handleDelete(p)}>
                  <Trash size={14} />
                </button>
              </span>
              {index < filtered.length - 1 && <div className="pat-row-sep" style={{ gridColumn: '1 / -1' }} />}
            </div>
          ))
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

      <Modal
        open={createOpen}
        onClose={() => onCreateOpenChange(false)}
        title={editing ? `Edit ${editing.name}` : 'New Patient'}
        subtitle="Patient demographics and contact details"
        size="md"
      >
        <div className="patient-form">
          <label className="pf-field pf-full">
            <span>Full name</span>
            <input {...formField('name')} placeholder="First & last name" />
          </label>
          <label className="pf-field">
            <span>Date of birth</span>
            <input type="date" {...formField('dob')} />
          </label>
          <label className="pf-field">
            <span>Gender</span>
            <select {...formField('gender')}>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="pf-field">
            <span>Phone</span>
            <input {...formField('phone')} placeholder="+1 (555) 000-0000" />
          </label>
          <label className="pf-field">
            <span>Email</span>
            <input type="email" {...formField('email')} placeholder="name@clinic.com" />
          </label>
          <label className="pf-field">
            <span>Insurance</span>
            <select {...formField('insuranceId')}>
              <option value="">No insurance on file</option>
              {insurance.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.provider}
                </option>
              ))}
            </select>
          </label>
          <label className="pf-field pf-full">
            <span>Address</span>
            <input {...formField('address')} placeholder="Street, city, state, ZIP" />
          </label>
          <label className="pf-field pf-full">
            <span>Notes</span>
            <textarea {...formField('notes')} rows={2} placeholder="Allergies, preferences, care notes…" />
          </label>
        </div>
        <div className="patient-form-actions">
          <button type="button" className="pf-btn pf-cancel" onClick={() => onCreateOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className="pf-btn pf-save" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add patient'}
          </button>
        </div>
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Patient'}
        subtitle={selected ? `${selected.gender}, ${selected.age} · ${insuranceName(selected.insuranceId) || 'No insurance'}` : undefined}
        size="md"
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