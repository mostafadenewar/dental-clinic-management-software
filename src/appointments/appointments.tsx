import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import { api, useBackendReady, type AppointmentRecord } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { Modal } from '../components/Modal'
import { PatientCreateModal } from '../components/PatientCreateModal'
import { useToast } from '../components/toastStore'
import './appointments.css'

const START_HOUR = 8
const END_HOUR = 17
const HOUR_PX = 60
const DAY_START = START_HOUR * 60
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

const BLOCK_STATUS: Record<string, string> = {
  confirmed: 'block-green',
  scheduled: 'block-blue',
  in_progress: 'block-violet',
  completed: 'block-slate',
  cancelled: 'block-amber',
  no_show: 'block-red',
}

const DEFAULT_ROOMS = ['Room 1', 'Room 2', 'Room 3']

const DEFAULT_TITLES = [
  'Consultation',
  'Routine Checkup',
  'Teeth Cleaning',
  'New Patient Exam',
  'Filling',
  'Extraction',
  'Root Canal',
  'Follow-up',
  'Teeth Whitening',
]

const DURATIONS = [15, 30, 45, 60, 90, 120]

const toIso = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const addDays = (d: Date, n: number): Date => {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

const toMinutes = (hm: string): number => {
  const [h, m] = hm.split(':').map((x) => Number(x) || 0)
  return h * 60 + m
}

const addMinutes = (hm: string, minutes: number): string => {
  const total = (toMinutes(hm) + minutes) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const toDisplay = (hm: string): string => {
  const h = toMinutes(hm) / 60
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${String(mins).padStart(2, '0')} ${suffix}`
}

const hourLabel = (h: number): string => {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve} ${suffix}`
}

interface AppointmentForm {
  patientId: string
  providerId: string
  title: string
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  room: string
  notes: string
  status: string
}

const emptyForm = (date: string): AppointmentForm => ({
  patientId: '',
  providerId: 'DOC-01',
  title: 'Consultation',
  date,
  startTime: '09:00',
  endTime: '09:30',
  durationMinutes: 30,
  room: 'Room 1',
  notes: '',
  status: 'scheduled',
})

const fromAppt = (a: AppointmentRecord): AppointmentForm => {
  const start = toMinutes(a.startTime)
  const end = Math.max(start + 15, toMinutes(a.endTime))
  return {
    patientId: a.patientId,
    providerId: a.providerId || 'DOC-01',
    title: a.title,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    durationMinutes: end - start,
    room: a.room,
    notes: a.notes,
    status: a.status,
  }
}

/** Assign side-by-side lanes to overlapping appointment blocks. */
const layoutSlots = (slots: Array<{ start: number; end: number }>) => {
  const sorted = [...slots].sort((a, b) => a.start - b.start || b.end - a.end)
  const laneEnds: number[] = []
  const lanesOf: number[] = []
  for (const s of sorted) {
    let lane = laneEnds.findIndex((end) => end <= s.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = s.end
    lanesOf.push(lane)
  }
  const lanes = Math.max(1, laneEnds.length)
  const gap = 0.4
  const width = (100 - gap * (lanes - 1)) / lanes
  return sorted.map((_s, i) => ({
    left: lanesOf[i] * (width + gap),
    width: Math.max(0.5, width),
  }))
}

interface AppointmentsProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

const Appointments = ({ searchQuery, createOpen, onCreateOpenChange }: AppointmentsProps) => {
  const ready = useBackendReady()
  const { patients, providers } = useLookups()
  const toast = useToast()
  const [selectedDate, setSelectedDate] = useState(() => toIso(new Date()))
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AppointmentRecord | null>(null)
  const [draftDate, setDraftDate] = useState(() => toIso(new Date()))
  const [form, setForm] = useState<AppointmentForm>(() => emptyForm(toIso(new Date())))
  const [saving, setSaving] = useState(false)
  const [titles, setTitles] = useState<string[]>(DEFAULT_TITLES)
  const [addingTitle, setAddingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const pendingRoomRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAppointments(await api.appointments(selectedDate, selectedDate))
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  useEffect(() => {
    if (createOpen) {
      const base = editing ? fromAppt(editing) : emptyForm(draftDate)
      const room = pendingRoomRef.current
      pendingRoomRef.current = null
      setForm(room ? { ...base, room } : base)
      setAddingTitle(false)
      setNewTitle('')
      setPatientModalOpen(false)
    }
  }, [createOpen, editing, draftDate])

  const selectedDay = useMemo(() => {
    const parts = selectedDate.split('-').map(Number)
    return new Date(parts[0], parts[1] - 1, parts[2])
  }, [selectedDate])

  const openCreateOn = (date: string, room?: string) => {
    setEditing(null)
    setDraftDate(date)
    pendingRoomRef.current = room ?? null
    onCreateOpenChange(true)
  }

  const openEdit = (appt: AppointmentRecord) => {
    setEditing(appt)
    setDraftDate(appt.date)
    setAddingTitle(false)
    setPatientModalOpen(false)
    onCreateOpenChange(true)
  }

  const close = () => {
    onCreateOpenChange(false)
    setEditing(null)
    setPatientModalOpen(false)
  }

  const roomList = useMemo(() => {
    const set = new Set(DEFAULT_ROOMS)
    for (const a of appointments) {
      if (a.room) set.add(a.room)
    }
    return Array.from(set)
  }, [appointments])

  const dayAppointments = useMemo(
    () =>
      [...appointments].sort((a, b) => {
        const byTime = a.startTime.localeCompare(b.startTime)
        return byTime || a.patientName.localeCompare(b.patientName)
      }),
    [appointments],
  )

  const agendaQuery = searchQuery.trim().toLowerCase()
  const agendaAppointments = useMemo(
    () => (agendaQuery ? dayAppointments.filter((a) => a.patientName.toLowerCase().includes(agendaQuery)) : dayAppointments),
    [dayAppointments, agendaQuery],
  )

  const remainingLeft = dayAppointments.filter((a) => !['completed', 'cancelled', 'no_show'].includes(a.status)).length

  const todayIso = toIso(new Date())
  const nowMinutes =
    selectedDate === todayIso ? new Date().getHours() * 60 + new Date().getMinutes() : null
  const nowTop =
    nowMinutes != null && nowMinutes >= DAY_START && nowMinutes <= END_HOUR * 60
      ? ((nowMinutes - DAY_START) / 60) * HOUR_PX
      : null

  const handleSave = async () => {
    if (!form.patientId) {
      toast.push('Select a patient for the appointment', { tone: 'warning' })
      return
    }
    const duration = Number(form.durationMinutes) || 30
    const payload = { ...form, endTime: addMinutes(form.startTime, duration) }
    setSaving(true)
    try {
      if (editing) {
        await api.updateAppointment(editing.id, payload)
        toast.push(`${form.title} updated`)
      } else {
        await api.createAppointment(payload)
        toast.push('Appointment scheduled')
      }
      close()
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to save appointment', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const addTitle = () => {
    const value = newTitle.trim()
    if (!value) return
    setTitles((all) => (all.includes(value) ? all : [...all, value]))
    setForm((f) => ({ ...f, title: value }))
    setNewTitle('')
    setAddingTitle(false)
  }

  const setStatus = async (appt: AppointmentRecord, status: string) => {
    try {
      await api.setAppointmentStatus(appt.id, status)
      toast.push(`${appt.patientName} marked ${status}`)
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', { tone: 'danger' })
    }
  }

  const formField = (key: keyof AppointmentForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="appt-page">
      <div className="appt-cols">
        <section className="appt-calendar">
          <div className="appt-toolbar">
            <div className="appt-week-nav">
              <button type="button" className="week-btn" onClick={() => setSelectedDate(toIso(addDays(selectedDay, -1)))} title="Previous day">
                <CaretLeft size={13} weight="bold" />
              </button>
              <button type="button" className="week-btn today-btn" onClick={() => setSelectedDate(toIso(new Date()))} title="Jump to today">
                Today
              </button>
              <button type="button" className="week-btn" onClick={() => setSelectedDate(toIso(addDays(selectedDay, 1)))} title="Next day">
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
            <label className="appt-date-chip">
              <CalendarBlank size={14} weight="bold" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value)
                }}
              />
            </label>
            <div className="appt-toolbar-summary">
              <span className="appt-sum-count">{dayAppointments.length}</span> appointment
              {dayAppointments.length === 1 ? '' : 's'}
              <i className="appt-sum-dot" />
              {roomList.length} room{roomList.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="appt-schedule-wrap">
            <div className="appt-room-gutter">
              <div className="appt-room-gutter-head">
                <span>Hours</span>
              </div>
              <div className="appt-room-gutter-body" style={{ height: HOURS.length * HOUR_PX }}>
                {HOURS.map((h) => (
                  <div key={h} className="appt-hour">
                    <span>{hourLabel(h)}</span>
                  </div>
                ))}
                {nowTop != null && (
                  <div className="appt-now-line" style={{ top: nowTop }}>
                    <span className="appt-now-dot" />
                    <span className="appt-now-time">{toDisplay(new Date().toTimeString().slice(0, 5))}</span>
                  </div>
                )}
              </div>
            </div>

            {roomList.map((room) => {
              const roomAppts = dayAppointments.filter((a) => (a.room || 'Room 1') === room)
              const positioned = layoutSlots(
                roomAppts.map((a) => ({
                  start: toMinutes(a.startTime),
                  end: Math.max(toMinutes(a.startTime) + 15, toMinutes(a.endTime)),
                })),
              )
              return (
                <div key={room} className="appt-room-col">
                  <div className="appt-room-head" title={room}>
                    <span className="appt-room-name">{room}</span>
                    <span className="appt-room-count">
                      {roomAppts.length} booked
                    </span>
                  </div>
                  <div className="appt-room-body" style={{ height: HOURS.length * HOUR_PX }} onClick={() => openCreateOn(selectedDate, room)}>
                    {roomAppts.map((a, index) => {
                      const pos = positioned[index]
                      const startMin = toMinutes(a.startTime)
                      const endMin = Math.max(startMin + 15, toMinutes(a.endTime))
                      const top = ((startMin - DAY_START) / 60) * HOUR_PX
                      const height = ((endMin - startMin) / 60) * HOUR_PX
                      return (
                        <div
                          key={a.id}
                          className={`appt-block ${BLOCK_STATUS[a.status] ?? 'block-blue'}`}
                          style={{ top: Math.max(0, top), height: Math.max(30, height - 2), left: `${pos.left}%`, width: `${pos.width}%` }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(a)
                          }}
                          title={`${a.patientName} · ${toDisplay(a.startTime)} – ${toDisplay(a.endTime)} · ${a.title}`}
                        >
                          <div className="appt-block-time">
                            {toDisplay(a.startTime)}
                            <span className="appt-block-room">{a.room}</span>
                          </div>
                          <div className="appt-block-name">{a.patientName}</div>
                          <div className="appt-block-detail">{a.title}</div>
                        </div>
                      )
                    })}
                    {nowTop != null && <div className="appt-now-line" style={{ top: nowTop }} />}
                    {loading && <div className="appt-day-loading">Loading…</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="appt-agenda">
          <div className="agenda-head">
            <div className="agenda-tabs">
              <span className="agenda-tab">
                {selectedDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="agenda-left">{remainingLeft} LEFT</span>
            </div>
            <span className="agenda-sub">{agendaAppointments.length} shown</span>
          </div>

          {agendaAppointments.length === 0 ? (
            <p className="agenda-empty">{loading ? 'Loading…' : 'No appointments this day.'}</p>
          ) : (
            agendaAppointments.map((a) => (
              <div key={a.id} className={`agenda-card ag-${a.status}`}>
                <div className="agenda-top">
                  <span className="agenda-time">{toDisplay(a.startTime)}</span>
                  <span className="agenda-status-chip">{a.status.replace('_', ' ')}</span>
                </div>
                <div className="agenda-name">{a.patientName}</div>
                <div className="agenda-detail">
                  {a.title}
                  {a.room ? ` · ${a.room}` : ''}
                </div>
                {a.status === 'scheduled' && (
                  <div className="agenda-actions">
                    <button type="button" className="agenda-confirm" onClick={() => void setStatus(a, 'confirmed')}>
                      Confirm
                    </button>
                    <button type="button" className="agenda-close" title="Cancel" onClick={() => void setStatus(a, 'cancelled')}>
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                )}
                {a.status === 'confirmed' && (
                  <div className="agenda-actions">
                    <button type="button" className="agenda-confirm" onClick={() => void setStatus(a, 'completed')}>
                      Complete
                    </button>
                    <button type="button" className="agenda-close" title="Cancel" onClick={() => void setStatus(a, 'cancelled')}>
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                )}
                {['completed', 'cancelled', 'no_show'].includes(a.status) && (
                  <div className="agenda-actions">
                    <button
                      type="button"
                      className="agenda-close"
                      title="Reopen"
                      onClick={() => void setStatus(a, 'scheduled')}
                    >
                      Reopen
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </aside>
      </div>

      <Modal
        open={createOpen}
        onClose={close}
        title={editing ? `Edit Appointment` : 'New Appointment'}
        subtitle={editing ? `${editing.patientName} · ${editing.id}` : 'Schedule a visit for a patient'}
        size="lg"
      >
        <div className="appt-form">
          <label className="af-field af-full">
            <span>Patient</span>
            <div className="af-patient-row">
              <select {...formField('patientId')}>
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="af-add-patient"
                onClick={() => setPatientModalOpen(true)}
              >
                <Plus size={12} weight="bold" />
                New Patient
              </button>
            </div>
          </label>

          <label className="af-field">
            <span>Title</span>
            <select
              value={form.title}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  setAddingTitle(true)
                } else {
                  setAddingTitle(false)
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              }}
            >
              {titles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__add__">＋ Add new title…</option>
            </select>
          </label>

          {addingTitle && (
            <div className="af-new-title">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New appointment title"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTitle()
                  }
                }}
              />
              <button type="button" className="pf-btn pf-save" onClick={addTitle} disabled={!newTitle.trim()}>
                Add
              </button>
            </div>
          )}

          <label className="af-field">
            <span>Date</span>
            <input type="date" {...formField('date')} />
          </label>
          <label className="af-field">
            <span>Start time</span>
            <input type="time" {...formField('startTime')} />
          </label>
          <label className="af-field">
            <span>Visit time</span>
            <select
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="af-field">
            <span>Doctor</span>
            <select {...formField('providerId')}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="af-field">
            <span>Room</span>
            <select {...formField('room')}>
              {roomList.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="af-field">
            <span>Status</span>
            <select {...formField('status')}>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </label>
          <label className="af-field af-full">
            <span>Notes</span>
            <textarea {...formField('notes')} rows={2} placeholder="Patient notes, prep instructions…" />
          </label>
        </div>

        <div className="appt-form-actions">
          <button type="button" className="pf-btn pf-cancel" onClick={close}>
            Cancel
          </button>
          <button type="button" className="pf-btn pf-save" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule'}
          </button>
        </div>
      </Modal>

      <PatientCreateModal
        open={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        onCreated={(p) => setForm((f) => ({ ...f, patientId: p.id }))}
      />
    </div>
  )
}

export default Appointments