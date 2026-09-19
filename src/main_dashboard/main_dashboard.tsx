import { useCallback, useEffect, useState } from 'react'
import {
  CalendarPlus,
  UserPlus,
  Receipt,
  TrendUp,
  Check,
  Flask,
  Package,
  Calendar,
  Users,
  CurrencyCircleDollar,
} from '@phosphor-icons/react'
import { api, useBackendReady, type DashboardData } from '../api/client'
import { currencyWhole } from '../utils/format'
import './main_dashboard.css'

type StatusTone = 'green' | 'slate' | 'amber' | 'red'

const STATUS: Record<StatusTone, string> = {
  green: 'pill-green',
  slate: 'pill-slate',
  amber: 'pill-amber',
  red: 'pill-red',
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  check: <Check size={13} weight="bold" />,
  flask: <Flask size={13} weight="bold" />,
  package: <Package size={13} weight="bold" />,
  user: <Users size={13} weight="bold" />,
  calendar: <Calendar size={13} weight="bold" />,
  dollar: <CurrencyCircleDollar size={13} weight="bold" />,
}

interface MainDashboardProps {
  onNavigate: (page: 'appointments' | 'patients' | 'billing') => void
  searchQuery?: string
  onOpenNewAppointment?: () => void
  onOpenNewPatient?: () => void
}

const MainDashboard = ({ onNavigate, searchQuery = '', onOpenNewAppointment, onOpenNewPatient }: MainDashboardProps) => {
  const ready = useBackendReady()
  const [data, setData] = useState<DashboardData | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard())
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  const stats = data?.stats

  const newPatientsDelta = (stats?.newPatientsWeek ?? 0) - (stats?.newPatientsPrevWeek ?? 0)
  const showNewDelta = stats ? newPatientsDelta >= 0 : false

  const q = searchQuery.trim().toLowerCase()
  const visibleSchedule = (data?.schedule ?? []).filter((row) => !q || row.patient.toLowerCase().includes(q))

  return (
    <div className="dashboard-page">
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-big">
            <div className="stat-icon-readout">
              <strong>{stats?.todayAppointments ?? '–'}</strong>
              <span>today</span>
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-title">Today's Appointments</div>
            <div className="stat-value">
              <strong>{stats?.todayScheduled ?? '–'}</strong> Scheduled
            </div>
            <div className="stat-sub">
              <TrendUp size={11} weight="bold" />
              <span>across all operatories</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-teal">
            <Users size={17} weight="fill" />
          </div>
          <div className="stat-body">
            <div className="stat-title">New Patients</div>
            <div className="stat-value">
              <strong>{stats?.newPatientsWeek ?? '–'}</strong> This Week
            </div>
            <div className="stat-sub">
              <TrendUp size={11} weight="bold" />
              <span>
                {stats === null ? '' : showNewDelta ? `+${newPatientsDelta}` : `${newPatientsDelta}`} vs last week
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <CurrencyCircleDollar size={17} weight="fill" />
          </div>
          <div className="stat-body">
            <div className="stat-title">Monthly Revenue</div>
            <div className="stat-value">
              <strong>{stats ? currencyWhole(stats.monthlyRevenue) : '–'}</strong>
            </div>
            <div className="stat-sub">
              <TrendUp size={11} weight="bold" />
              <span>{stats ? `+${stats.revenuePct}% MoM` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-cols">
        <section className="panel schedule-panel">
          <div className="panel-head">
            <div className="panel-head-text">
              <h2>Today's Schedule</h2>
              <p>{stats?.todayAppointments ?? 0} appointments today</p>
            </div>
            <button type="button" className="panel-link" onClick={() => onNavigate('appointments')}>
              <Calendar size={11} weight="bold" />
              Full Calendar
            </button>
          </div>

          {visibleSchedule.length ? (
            <ul className="schedule-list">
              {visibleSchedule.map((row) => (
                <li key={row.id} className="schedule-row">
                  <div className="schedule-time">{row.time}</div>
                  <div className="schedule-patient">
                    <div className="schedule-name">{row.patient}</div>
                    <div className="schedule-detail">{row.detail}</div>
                  </div>
                  <span className={`status-pill ${STATUS[row.tone as StatusTone] ?? 'pill-slate'}`}>
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="schedule-empty">
              {data ? (q ? 'No appointments match your search.' : 'No appointments scheduled for today.') : 'Loading…'}
            </p>
          )}
        </section>

        <aside className="dashboard-right">
          <section className="panel quick-actions-panel">
            <h2 className="panel-title">Quick Actions</h2>
            <div className="quick-actions">
              <div className="quick-action">
                <button type="button" className="quick-action-btn" onClick={onOpenNewAppointment}>
                  <CalendarPlus size={15} weight="bold" color="#2563eb" />
                </button>
                <span>New Appointment</span>
              </div>
              <div className="quick-action">
                <button type="button" className="quick-action-btn" onClick={onOpenNewPatient}>
                  <UserPlus size={15} weight="bold" color="#2563eb" />
                </button>
                <span>Add Patient</span>
              </div>
              <div className="quick-action">
                <button type="button" className="quick-action-btn" onClick={() => onNavigate('billing')}>
                  <Receipt size={15} weight="bold" color="#2563eb" />
                </button>
                <span>Invoice</span>
              </div>
            </div>
          </section>

          <section className="panel activity-panel">
            <h2 className="panel-title">Recent Activity</h2>
            {data?.activity.length ? (
              <ul className="activity-list">
                {data.activity.map((item, index) => (
                  <li key={index} className="activity-item">
                    <span className={`activity-icon ${item.tone}`}>
                      {ACTIVITY_ICONS[item.icon] ?? <Check size={13} weight="bold" />}
                    </span>
                    <div className="activity-body">
                      <div className="activity-text">{item.text}</div>
                      <div className="activity-time">{item.timeAgo}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="activity-empty">{data ? 'No recent activity.' : 'Loading…'}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

export default MainDashboard