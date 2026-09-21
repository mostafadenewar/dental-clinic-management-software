import { useEffect, useRef, useState } from 'react'
import {
  MagnifyingGlass,
  Bell,
  CaretDown,
  Plus,
  Check,
  Package,
  User,
  CalendarBlank,
  CurrencyCircleDollar,
  Info,
  GearSix,
  UserCircle,
  SignOut,
} from '@phosphor-icons/react'
import './header.css'
import './notifications.css'
import type { PageKey } from '../App'
import type { NotificationKind } from '../api/client'
import { useAuthStore } from '../auth/authStore'
import { useNotificationsStore } from '../notifications/notificationsStore'
import { initials as toInitials } from '../utils/format'

const PAGE_META: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) },
  patients: { title: 'Patients', subtitle: '· All records' },
  appointments: { title: 'Appointments', subtitle: '· Day schedule' },
  treatment: { title: 'Treatment Plans', subtitle: '· Active plans' },
  billing: { title: 'Billing', subtitle: '· Practice ledger' },
  inventory: { title: 'Inventory', subtitle: '· Stock levels' },
  profile: { title: 'My Profile', subtitle: '· Account settings' },
  settings: { title: 'Settings', subtitle: '· System & backups' },
}

const SEARCH_PLACEHOLDER: Partial<Record<PageKey, string>> = {
  dashboard: 'Search patients…',
  patients: 'Search by name, ID or phone…',
  treatment: 'Search treatment plans…',
  billing: 'Search invoices…',
  inventory: 'Search products…',
}

const NOTIF_ICON: Record<NotificationKind, React.ReactNode> = {
  appointment: <CalendarBlank size={13} weight="bold" />,
  stock: <Package size={13} weight="bold" />,
  billing: <CurrencyCircleDollar size={13} weight="bold" />,
  patient: <User size={13} weight="bold" />,
  system: <Info size={13} weight="bold" />,
  general: <Info size={13} weight="bold" />,
}

const NOTIF_TONE: Record<NotificationKind, string> = {
  appointment: 'ntone-appointment',
  stock: 'ntone-stock',
  billing: 'ntone-billing',
  patient: 'ntone-patient',
  system: 'ntone-system',
  general: 'ntone-system',
}

const timeAgo = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface HeaderProps {
  page: PageKey
  searchValue?: string
  onSearchChange?: (value: string) => void
  onNavigate: (page: PageKey) => void
  primaryAction?: { label: string; onClick: () => void }
}

const Header = ({ page, searchValue, onSearchChange, onNavigate, primaryAction }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = PAGE_META[page]
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setNotifOpen = useNotificationsStore((s) => s.setOpen)

  const isControlled = onSearchChange !== undefined
  const value = isControlled ? searchValue ?? '' : searchQuery

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isControlled) onSearchChange(e.target.value)
    else setSearchQuery(e.target.value)
  }

  return (
    <header className={`header${page === 'dashboard' ? ' header-dashboard' : ''}`}>
      <div className="header-left">
        <h1>{meta.title}</h1>
        <h3>{meta.subtitle}</h3>
      </div>

      <div className="header-actions">
        {page !== 'appointments' && SEARCH_PLACEHOLDER[page] && (
          <div className="header-search">
            <MagnifyingGlass size={13} color="#94a3b8" />
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDER[page]}
              value={value}
              onChange={handleSearchChange}
            />
          </div>
        )}

        <HeaderBell />

        {primaryAction && (
          <button type="button" className="header-primary-btn" onClick={primaryAction.onClick}>
            <Plus size={14} weight="bold" />
            {primaryAction.label}
          </button>
        )}

        <div className="header-divider" />

        <div className="header-profile-wrap">
          <button
            type="button"
            className={`header-profile${menuOpen ? ' profile-active' : ''}`}
            onClick={() => {
              setMenuOpen((v) => !v)
              setNotifOpen(false)
            }}
          >
            <span className="header-avatar">{toInitials(user?.name ?? '?')}</span>
            <span className="header-profile-text">
              <span className="header-name">{user?.name ?? '—'}</span>
              <span className="header-role">{user?.title || user?.role || 'staff'}</span>
            </span>
            <CaretDown size={11} color="#94a3b8" />
          </button>
          {menuOpen && (
            <>
              <div className="header-menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="profile-menu">
                <div className="profile-menu-head">
                  <span className="header-avatar">{toInitials(user?.name ?? '?')}</span>
                  <div>
                    <strong>{user?.name}</strong>
                    <span>{user?.username}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onNavigate('profile')
                  }}
                >
                  <UserCircle size={15} />
                  My Profile
                </button>
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onNavigate('settings')
                  }}
                >
                  <GearSix size={15} />
                  Settings &amp; Backup
                </button>
                <div className="profile-menu-sep" />
                <button type="button" className="profile-menu-item danger" onClick={() => void logout()}>
                  <SignOut size={15} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const HeaderBell = () => {
  const items = useNotificationsStore((s) => s.items)
  const unread = useNotificationsStore((s) => s.unread)
  const open = useNotificationsStore((s) => s.open)
  const loading = useNotificationsStore((s) => s.loading)
  const setOpen = useNotificationsStore((s) => s.setOpen)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <div className="header-bell-wrap" ref={ref}>
      <button
        type="button"
        className={`header-bell${open ? ' bell-active' : ''}`}
        title="Notifications"
        onClick={() => {
          setOpen(!open)
        }}
      >
        <Bell size={17} />
        {unread > 0 && <span className="header-bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="header-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-panel">
            <div className="notif-head">
              <span>Notifications</span>
              {unread > 0 && (
                <button type="button" className="notif-mark-all" onClick={() => void markAllRead()}>
                  <Check size={12} weight="bold" />
                  Mark all read
                </button>
              )}
            </div>
            <div className="notif-list">
              {loading && items.length === 0 && <div className="notif-empty">Loading…</div>}
              {!loading && items.length === 0 && <div className="notif-empty">No notifications yet.</div>}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item${n.read ? ' read' : ''}`}
                  onClick={() => {
                    if (!n.read) void markRead(n.id)
                  }}
                >
                  <span className={`notif-icon ${NOTIF_TONE[n.kind] ?? 'ntone-system'}`}>
                    {NOTIF_ICON[n.kind] ?? <Info size={13} weight="bold" />}
                  </span>
                  <span className="notif-body">
                    <span className="notif-msg">{n.message}</span>
                    <span className="notif-time">{timeAgo(n.at)}</span>
                  </span>
                  {!n.read && <span className="notif-dot" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Header