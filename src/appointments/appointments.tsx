import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Sparkle, CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import { api, useBackendReady, type AppointmentRecord } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { Modal } from '../components/Modal'
import { useToast } from '../components/toastStore'
import './appointments.css'

const START_HOUR = 8
const HOUR_PX = 60

const HOURS = Array.from({ length: 10 }, (_, i) => {
  const h = i === 0 ? 12 : i
  const suffix = i < 9 ? 'AM' : 'PM'
  return `${String(h).padStart(2, '0')}:00 ${suffix}`
})

const DAY_LETTERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const BLOCK_STATUS: Record<string, string> = {
  confirmed: 'block-green',
  scheduled: 'block-blue',
  in_progress: 'block-violet',
  completed: 'block-violet',
  cancelled: 'block-amber',
  no_show: 'block-amber',
}

const ROOMS = ['Room 1', 'Room 2', 'Room 3']

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

const mondayOf = (d: Date): Date => {
  const copy = new Date(new Date(d).getFullYear(), d.getMonth(), d.getDate())
  const dow = (copy.getDay() + 6) % 7
  return addDays(copy, -dow)
}

const toMinutes = (hm: string): number => {
  const [h, m] = hm.split(':').map((x) => Number(x) || 0)
  return h * 60 + m
}

const toDisplay = (hm: string): string => {
  const h = toMinutes(hm) / 60
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${String(mins).padStart(2, '0')} ${suffix}`
}

interface AppointmentForm {
  patientId: string
  providerId: string
  title: string
  date: string
  startTime: string
  endTime: string
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
  room: 'Room 1',
  notes: '',
  status: 'scheduled',
})

const fromAppt = (a: AppointmentRecord): AppointmentForm => ({
  patientId: a.patientId,
  providerId: a.providerId || 'DOC-01',
  title: a.title,
  date: a.date,
  startTime: a.startTime,
  endTime: a.endTime,
  room: a.room,
  notes: a.notes,
  status: a.status,
})

interface AppointmentsProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

const Appointments = ({ searchQuery, createOpen, onCreateOpenChange }: AppointmentsProps) => {
  const ready = useBackendReady()
  const { patients, providers } = useLookups()
  const toast = useToast()
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AppointmentRecord | null>(null)
  const [draftDate, setDraftDate] = useState(() => toIso(new Date()))
  const [form, setForm] = useState<AppointmentForm>(() => emptyForm(toIso(new Date())))
  const [saving, setSaving] = useState(false)

  const todayIso = useMemo(() => toIso(new Date()), [])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const load = useCallback(async () => {
    const start = toIso(weekStart)
    const end = toIso(addDays(weekStart, 6))
    setLoading(true)
    try {
      setAppointments(await api.appointments(start, end))
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  useEffect(() => {
    if (createOpen) {
      setForm(editing ? fromAppt(editing) : emptyForm(draftDate))
    }
  }, [createOpen, editing, draftDate])

  const openCreateOn = (date: string) => {
    setEditing(null)
    setDraftDate(date)
    onCreateOpenChange(true)
  }

  const openEdit = (appt: AppointmentRecord) => {
    setEditing(appt)
    setDraftDate(appt.date)
    onCreateOpenChange(true)
  }

  const close = () => {
    onCreateOpenChange(false)
    setEditing(null)
  }

  const handleSave = async () => {
    if (!form.patientId) {
      toast.push('Select a patient for the appointment', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.updateAppointment(editing.id, form)
        toast.push(`${form.title} updated`)
      } else {
        await api.createAppointment(form)
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

  const setStatus = async (appt: AppointmentRecord, status: string) => {
    try {
      await api.setAppointmentStatus(appt.id, status)
      toast.push(`${appt.patientName} marked ${status}`)
      await load()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', { tone: 'danger' })
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>()
    for (const w of weekDays) {
      const iso = toIso(w)
      map.set(iso, appointments.filter((a) => a.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime)))
    }
    return map
  }, [appointments, weekDays])

  const todayAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = appointments
      .filter((a) => a.date === todayIso)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    if (!q) return rows
    return rows.filter((a) => a.patientName.toLowerCase().includes(q))
  }, [appointments, todayIso, searchQuery])

  const remainingToday = todayAppointments.filter((a) => !['completed', 'cancelled', 'no_show'].includes(a.status)).length

  const formField = (key: keyof AppointmentForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  const weekContainsToday = todayIso >= toIso(weekStart) && todayIso <= toIso(addDays(weekStart, 6))
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowIso = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="appt-page">
      <div className="appt-cols">
        <section className="appt-calendar">
          <div className="appt-toolbar">
            <div className="appt-week-nav">
              <button type="button" className="week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <CaretLeft size={12} weight="bold" />
              </button>
              <button
                type="button"
                className="week-btn"
                onClick={() => setWeekStart(mondayOf(new Date()))}
                title="This week"
              >
                Today
              </button>
              <button type="button" className="week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <CaretRight size={12} weight="bold" />
              </button>
            </div>
            <div className="appt-week-label">
              <CalendarBlank size={12} weight="bold" />
              {`${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </div>
          </div>

          <div className="appt-strip">
            <div className="appt-gutter-head" />
            {weekDays.map((d, index) => (
              <div key={index} className={`appt-day-head${toIso(d) === todayIso ? ' active' : ''}`}>
                <span className="appt-day-name">{DAY_LETTERS[index]}</span>
                <span className="appt-day-num">{d.getDate()}</span>
              </div>
            ))}
          </div>

          <div className="appt-body">
            <div className="appt-gutter">
              {HOURS.map((h, index) => (
                <div key={index} className="appt-hour">
                  <span>{h}</span>
                </div>
              ))}
            </div>

            {weekDays.map((d, index) => {
              const iso = toIso(d)
              const dayAppts = byDay.get(iso) ?? []
              return (
                <div key={index} className="appt-day-col" onClick={() => openCreateOn(iso)}>
                  {dayAppts.map((a) => {
                    const startMin = toMinutes(a.startTime)
                    const endMin = Math.max(startMin + 30, toMinutes(a.endTime))
                    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_PX
                    const height = ((endMin - startMin) / 60) * HOUR_PX
                    return (
                      <div
                        key={a.id}
                        className={`appt-block ${BLOCK_STATUS[a.status] ?? 'block-blue'}`}
                        style={{ top: Math.max(0, top), height: Math.max(26, height) }}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(a)
                        }}
                        title={`${a.patientName} · ${toDisplay(a.startTime)} – ${toDisplay(a.endTime)}`}
                      >
                        <div className="appt-block-time">
                          {toDisplay(a.startTime)} – {toDisplay(a.endTime)}
                        </div>
                        <div className="appt-block-name">{a.patientName}</div>
                        <div className="appt-block-detail">
                          {a.title} · {a.room || 'No room'}
                        </div>
                      </div>
                    )
                  })}
                  {loading && <div className="appt-day-loading">…</div>}
                </div>
              )
            })}

            {weekContainsToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= (START_HOUR + 9) * 60 && (
              <div className="appt-now" style={{ top: ((nowMinutes - START_HOUR * 60) / 60) * HOUR_PX }}>
                <span className="appt-now-label">{nowIso}</span>
                <span className="appt-now-dot" />
              </div>
            )}
          </div>
        </section>

        <aside className="appt-agenda">
          <div className="agenda-tabs">
            <span className="agenda-tab">Today</span>
            <span className="agenda-left">{remainingToday} LEFT</span>
          </div>

          {todayAppointments.length === 0 ? (
            <p className="agenda-empty">{loading ? 'Loading…' : 'No appointments today.'}</p>
          ) : (
            todayAppointments.map((a) => (
              <div key={a.id} className="agenda-card">
                <div className="agenda-time">{toDisplay(a.startTime)}</div>
                <div className="agenda-name">{a.patientName}</div>
                <div className="agenda-detail">
                  {a.title} · {a.room || 'No room'}
                </div>
                {a.status === 'scheduled' && (
                  <div className="agenda-actions">
                    <button type="button" className="agenda-confirm" onClick={() => void setStatus(a, 'confirmed')}>
                      Confirm
                    </button>
                    <button type="button" className="agenda-close" onClick={() => void setStatus(a, 'cancelled')}>
                      <X size={11} weight="bold" />
                    </button>
                  </div>
                )}
                {a.status === 'confirmed' && (
                  <div className="agenda-actions">
                    <button type="button" className="agenda-confirm" onClick={() => void setStatus(a, 'completed')}>
                      Complete
                    </button>
                    <button type="button" className="agenda-close" onClick={() => void setStatus(a, 'cancelled')}>
                      <X size={11} weight="bold" />
                    </button>
                  </div>
                )}
                {['completed', 'cancelled', 'no_show'].includes(a.status) && (
                  <div className="agenda-status">
                    {a.status === 'completed' ? 'Completed' : a.status === 'cancelled' ? 'Cancelled' : 'No Show'}
                  </div>
                )}
              </div>
            ))
          )}

          <div className="ai-card">
            <Sparkle size={54} weight="fill" className="ai-sparkle" />
            <div className="ai-title">Need help scheduling?</div>
            <p className="ai-body">AI-Assistant can optimize your week for maximum revenue.</p>
            <button type="button" className="ai-button" onClick={() => toast.push('Schedule optimizer coming soon', { tone: 'info' })}>
              Optimize Schedule
            </button>
          </div>
        </aside>
      </div>

      <Modal
        open={createOpen}
        onClose={close}
        title={editing ? `Edit Appointment` : 'New Appointment'}
        subtitle={editing ? `${editing.patientName} · ${editing.id}` : 'Schedule a visit for a patient'}
        size="md"
      >
        <div className="appt-form">
          <label className="af-field af-full">
            <span>Patient</span>
            <select {...formField('patientId')}>
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="af-field">
            <span>Title</span>
            <input {...formField('title')} />
          </label>
          <label className="af-field">
            <span>Date</span>
            <input type="date" {...formField('date')} />
          </label>
          <label className="af-field">
            <span>Start time</span>
            <input type="time" {...formField('startTime')} />
          </label>
          <label className="af-field">
            <span>End time</span>
            <input type="time" {...formField('endTime')} />
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
              {ROOMS.map((r) => (
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
    </div>
  )
}

export default Appointments