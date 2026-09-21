import {
  SquaresFour,
  Users,
  CalendarBlank,
  FileText,
  CurrencyDollar,
  Tray,
  GearSix,
  SignOut,
  Tooth,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import './sideBar.css'
import type { PageKey } from '../App'

interface NavItem {
  key: PageKey
  icon: ReactNode
}

const NAV: NavItem[] = [
  { key: 'dashboard', icon: <SquaresFour size={15} /> },
  { key: 'patients', icon: <Users size={15} /> },
  { key: 'appointments', icon: <CalendarBlank size={15} /> },
  { key: 'treatment', icon: <FileText size={15} /> },
  { key: 'billing', icon: <CurrencyDollar size={15} /> },
  { key: 'inventory', icon: <Tray size={15} /> },
]

interface SystemItem {
  key: 'settings' | 'logout'
  icon: ReactNode
  label: string
}

const SYSTEM: SystemItem[] = [
  { key: 'settings', icon: <GearSix size={15} />, label: 'Settings' },
  { key: 'logout', icon: <SignOut size={15} />, label: 'Sign out' },
]

interface SideBarProps {
  current: PageKey
  onNavigate: (page: PageKey) => void
  onLogout?: () => void
}

const SideBar = ({ current, onNavigate, onLogout }: SideBarProps) => {
  return (
    <nav className="sidebar">
      <button
        type="button"
        className="sidebar-logo"
        title="Dashboard"
        onClick={() => onNavigate('dashboard')}
      >
        <Tooth size={18} weight="fill" color="#ffffff" />
      </button>

      <div className="sidebar-nav">
        {NAV.map((item) => {
          const active = current === item.key
          return (
            <button
              key={item.key}
              type="button"
              title={item.key}
              className={`sidebar-item${active ? ' active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="sidebar-item-bar" />
              <span className={`sidebar-item-icon${active ? ' filled' : ''}`}>
                {item.icon}
              </span>
            </button>
          )
        })}
      </div>

      <div className="sidebar-system">
        {SYSTEM.map((item) => {
          const active = item.key === 'settings' && current === 'settings'
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              className={`sidebar-item${active ? ' active' : ''}`}
              onClick={() => {
                if (item.key === 'settings') onNavigate('settings')
                else onLogout?.()
              }}
            >
              <span className="sidebar-item-bar" />
              <span className="sidebar-item-icon">{item.icon}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default SideBar