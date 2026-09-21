import { useEffect, useState } from 'react'
import { CheckCircle, IdentificationBadge, Key, UserCircle, Envelope, DeviceMobile, Tag } from '@phosphor-icons/react'
import { api } from '../api/client'
import { useAuthStore } from '../auth/authStore'
import { useToast } from '../components/toastStore'
import { initials as toInitials } from '../utils/format'
import './profile.css'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  dentist: 'Dentist',
  front_desk: 'Front Desk',
  staff: 'Staff',
}

const Profile = () => {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const toast = useToast()

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setTitle(user.title)
    setEmail(user.email)
    setPhone(user.phone)
    setDirty(false)
  }, [user])

  if (!user) return null

  const markDirty = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setDirty(true)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ name: name.trim(), title: title.trim(), email: email.trim(), phone: phone.trim() })
      toast.push('Profile updated')
      setDirty(false)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to update profile', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 6) {
      toast.push('New password must be at least 6 characters', { tone: 'danger' })
      return
    }
    if (next !== confirm) {
      toast.push('New passwords do not match', { tone: 'danger' })
      return
    }
    setPwBusy(true)
    try {
      await api.auth.changePassword(current, next, confirm)
      toast.push('Password changed')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to change password', { tone: 'danger' })
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <span className="profile-avatar-lg">{toInitials(user.name)}</span>
        <div className="profile-hero-body">
          <h2>{user.name}</h2>
          <div className="profile-hero-sub">
            <span className="profile-role-pill">{ROLE_LABEL[user.role] ?? user.role}</span>
            <span>@{user.username}</span>
          </div>
        </div>
      </section>

      <div className="profile-cols">
        <section className="panel profile-panel">
          <div className="profile-panel-title">
            <UserCircle size={15} weight="bold" />
            Profile details
          </div>
          <form className="profile-form" onSubmit={handleSaveProfile}>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pf-name">Full name</label>
              <div className="profile-input-wrap">
                <UserCircle size={14} />
                <input id="pf-name" className="ui-input" value={name} onChange={(e) => markDirty(setName)(e.target.value)} required />
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pf-title">Title / position</label>
              <div className="profile-input-wrap">
                <Tag size={14} />
                <input id="pf-title" className="ui-input" value={title} onChange={(e) => markDirty(setTitle)(e.target.value)} />
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pf-email">Email</label>
              <div className="profile-input-wrap">
                <Envelope size={14} />
                <input id="pf-email" className="ui-input" type="email" value={email} onChange={(e) => markDirty(setEmail)(e.target.value)} />
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pf-phone">Phone</label>
              <div className="profile-input-wrap">
                <DeviceMobile size={14} />
                <input id="pf-phone" className="ui-input" value={phone} onChange={(e) => markDirty(setPhone)(e.target.value)} />
              </div>
            </div>
            <div className="profile-form-foot">
              <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={saving || !dirty}>
                <CheckCircle size={13} weight="bold" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel profile-panel">
          <div className="profile-panel-title">
            <Key size={15} weight="bold" />
            Change password
          </div>
          <form className="profile-form" onSubmit={handleChangePassword}>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pw-current">Current password</label>
              <input id="pw-current" className="ui-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pw-new">New password</label>
              <input id="pw-new" className="ui-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" className="ui-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <p className="ui-hint">Use at least 6 characters.</p>
            <div className="profile-form-foot">
              <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={pwBusy}>
                {pwBusy ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="panel profile-panel">
        <div className="profile-panel-title">
          <IdentificationBadge size={15} weight="bold" />
          Account information
        </div>
        <div className="profile-acct-grid">
          <div><span>User ID</span><strong>{user.id}</strong></div>
          <div><span>Username</span><strong>{user.username}</strong></div>
          <div><span>Role</span><strong>{ROLE_LABEL[user.role] ?? user.role}</strong></div>
          <div><span>Status</span><strong>{user.active ? 'Active' : 'Disabled'}</strong></div>
        </div>
      </section>
    </div>
  )
}

export default Profile