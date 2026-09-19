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

const SYSTEM: NavItem[] = [
  { key: 'dashboard', icon: <GearSix size={15} /> },
  { key: 'dashboard', icon: <SignOut size={15} /> },
]

interface SideBarProps {
  current: PageKey
  onNavigate: (page: PageKey) => void
}

const SideBar = ({ current, onNavigate }: SideBarProps) => {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <Tooth size={18} weight="fill" color="#ffffff" />
      </div>

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
        {SYSTEM.map((item, index) => (
          <button key={index} type="button" className="sidebar-item" onClick={() => onNavigate('dashboard')}>
            <span className="sidebar-item-bar" />
            <span className="sidebar-item-icon">{item.icon}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default SideBar