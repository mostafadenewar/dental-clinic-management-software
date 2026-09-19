import { useEffect, useState } from 'react'
import { api, type PatientRecord } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { Modal } from './Modal'
import { useToast } from './toastStore'

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

const fromPatient = (p: PatientRecord): PatientForm => ({
  name: p.name,
  dob: p.dob ?? '',
  gender: p.gender,
  phone: p.phone,
  email: p.email,
  address: p.address,
  insuranceId: p.insuranceId,
  notes: p.notes,
})

interface PatientCreateModalProps {
  open: boolean
  onClose: () => void
  editing?: PatientRecord | null
  onSaved?: () => void
  onCreated?: (patient: PatientRecord) => void
}

export function PatientCreateModal({ open, onClose, editing, onSaved, onCreated }: PatientCreateModalProps) {
  const { insurance, refresh } = useLookups()
  const toast = useToast()
  const [form, setForm] = useState<PatientForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editing ? fromPatient(editing) : EMPTY_FORM)
  }, [open, editing])

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.push('Patient name is required', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      let created: PatientRecord | null = null
      if (editing) {
        await api.updatePatient(editing.id, form)
        toast.push(`${form.name} updated`)
      } else {
        created = await api.createPatient(form)
        toast.push(`${form.name} added as a new patient`)
      }
      await refresh()
      onClose()
      if (created && onCreated) onCreated(created)
      onSaved?.()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to save patient', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const formField = (key: keyof PatientForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
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
        <button type="button" className="pf-btn pf-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="pf-btn pf-save" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add patient'}
        </button>
      </div>
    </Modal>
  )
}