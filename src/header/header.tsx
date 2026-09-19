import { useState } from 'react'
import {
  MagnifyingGlass,
  Bell,
  CaretDown,
  CaretLeft,
  CaretRight,
  CalendarBlank,
  Plus,
} from '@phosphor-icons/react'
import './header.css'
import type { PageKey } from '../App'

const PAGE_META: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: '· Monday, May 26' },
  patients: { title: 'Patients', subtitle: '· 1,284 total records' },
  appointments: { title: 'Appointments', subtitle: 'May 26 – June 01, 2026' },
  treatment: { title: 'Treatment Plans', subtitle: '· 12 active plans' },
  billing: { title: 'Billing', subtitle: '· $12,480 outstanding' },
  inventory: { title: 'Inventory', subtitle: '· 4 low stock items' },
}

const SEARCH_PLACEHOLDER: Partial<Record<PageKey, string>> = {
  dashboard: 'Search patients…',
  patients: 'Search by name, ID or phone…',
  treatment: 'Search treatment plans…',
  billing: 'Search invoices…',
  inventory: 'Search products…',
}

interface HeaderProps {
  page: PageKey
}

const Header = ({ page }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const meta = PAGE_META[page]

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1>{meta.title}</h1>
        {page === 'appointments' ? (
          <div className="header-date">
            <CaretLeft size={12} weight="bold" />
            <CalendarBlank size={14} />
            <span>{meta.subtitle}</span>
            <CaretRight size={12} weight="bold" />
          </div>
        ) : (
          <h3>{meta.subtitle}</h3>
        )}
      </div>

      <div className="header-actions">
        {page !== 'appointments' && SEARCH_PLACEHOLDER[page] && (
          <div className="header-search">
            <MagnifyingGlass size={13} color="#94a3b8" />
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDER[page]}
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        )}

        {page === 'appointments' && (
          <>
            <div className="header-segment">
              <button type="button" className="segment-option">
                Day
              </button>
              <button type="button" className="segment-option active">
                Week
              </button>
              <button type="button" className="segment-option">
                Month
              </button>
            </div>
            <button type="button" className="header-primary-btn">
              <Plus size={14} weight="bold" />
              Schedule
            </button>
          </>
        )}

        {page === 'patients' && (
          <button type="button" className="header-primary-btn">
            <Plus size={14} weight="bold" />
            Add Patient
          </button>
        )}

        {page === 'dashboard' && (
          <button type="button" className="header-bell">
            <Bell size={17} />
            <span className="header-bell-dot" />
          </button>
        )}

        <div className="header-divider" />

        <div className="header-profile">
          <div className="header-avatar">
            <span>DS</span>
          </div>
          {page === 'dashboard' && (
            <div className="header-profile-text">
              <div className="header-name">Dr. Smith</div>
              <div className="header-role">Lead Dentist</div>
            </div>
          )}
          {page === 'dashboard' && <CaretDown size={11} color="#94a3b8" />}
        </div>
      </div>
    </header>
  )
}

export default Header