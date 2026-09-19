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
import './main_dashboard.css'

type StatusTone = 'green' | 'slate' | 'amber' | 'red'

const STATUS: Record<StatusTone, { label: string; className: string }> = {
  green: { label: 'In Progress', className: 'pill-green' },
  slate: { label: 'Upcoming', className: 'pill-slate' },
  amber: { label: 'Confirmed', className: 'pill-amber' },
  red: { label: 'Cancelled', className: 'pill-red' },
}

interface ScheduleRow {
  time: string
  patient: string
  detail: string
  status: StatusTone
}

const SCHEDULE: ScheduleRow[] = [
  { time: '09:00', patient: 'Maria Lawson', detail: 'Routine Checkup · Room 1', status: 'green' },
  { time: '10:30', patient: 'James Carter', detail: 'Root Canal · Room 3', status: 'slate' },
  { time: '12:00', patient: 'Priya Nair', detail: 'Teeth Whitening · Room 2', status: 'slate' },
  { time: '14:15', patient: 'Robert Hayes', detail: 'Dental Implant Consult · Room 1', status: 'amber' },
  { time: '16:00', patient: 'Emily Brooks', detail: 'Follow-up · Room 2', status: 'red' },
]

interface ActivityItem {
  icon: React.ReactNode
  tone: string
  text: string
  time: string
}

const ACTIVITY: ActivityItem[] = [
  {
    icon: <Check size={13} weight="bold" />,
    tone: 'activity-green',
    text: 'John Doe completed treatment',
    time: '10 min ago',
  },
  {
    icon: <Flask size={13} weight="bold" />,
    tone: 'activity-blue',
    text: 'Lab report received for Maria L.',
    time: '45 min ago',
  },
  {
    icon: <Package size={13} weight="bold" />,
    tone: 'activity-amber',
    text: 'Low stock: Composite Resin',
    time: '1 hour ago',
  },
  {
    icon: <UserPlus size={13} weight="bold" />,
    tone: 'activity-teal',
    text: 'New patient Priya Nar registered',
    time: '2 hours ago',
  },
]

const MainDashboard = () => {
  return (
    <div className="dashboard-page">
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-big">
            <div className="stat-icon-readout">
              <strong>9</strong>
              <span>of 12</span>
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-title">Today's Appointments</div>
            <div className="stat-value">
              <strong>9</strong> Scheduled
            </div>
            <div className="stat-sub">
              <TrendUp size={11} weight="bold" />
              <span>3 more than yesterday</span>
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
              <strong>14</strong> This Week
            </div>
            <div className="stat-sub">
              <TrendUp size={11} weight="bold" />
              <span>+6 vs last week</span>
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
              <strong>$48,290</strong>
            </div>
            <div className="stat-sub">
              <TrendUp size={11} weight="bold" />
              <span>+8.4% MoM</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-cols">
        <section className="panel schedule-panel">
          <div className="panel-head">
            <div className="panel-head-text">
              <h2>Today's Schedule</h2>
              <p>May 26, 2026 · 9 appointments</p>
            </div>
            <button type="button" className="panel-link">
              <Calendar size={11} weight="bold" />
              Full Calendar
            </button>
          </div>

          <ul className="schedule-list">
            {SCHEDULE.map((row, index) => (
              <li key={index} className="schedule-row">
                <div className="schedule-time">{row.time}</div>
                <div className="schedule-patient">
                  <div className="schedule-name">{row.patient}</div>
                  <div className="schedule-detail">{row.detail}</div>
                </div>
                <span className={`status-pill ${STATUS[row.status].className}`}>
                  {STATUS[row.status].label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="dashboard-right">
          <section className="panel quick-actions-panel">
            <h2 className="panel-title">Quick Actions</h2>
            <div className="quick-actions">
              <div className="quick-action">
                <button type="button" className="quick-action-btn">
                  <CalendarPlus size={15} weight="bold" color="#2563eb" />
                </button>
                <span>New Appt</span>
              </div>
              <div className="quick-action">
                <button type="button" className="quick-action-btn">
                  <UserPlus size={15} weight="bold" color="#2563eb" />
                </button>
                <span>Add Patient</span>
              </div>
              <div className="quick-action">
                <button type="button" className="quick-action-btn">
                  <Receipt size={15} weight="bold" color="#2563eb" />
                </button>
                <span>Invoice</span>
              </div>
            </div>
          </section>

          <section className="panel activity-panel">
            <h2 className="panel-title">Recent Activity</h2>
            <ul className="activity-list">
              {ACTIVITY.map((item, index) => (
                <li key={index} className="activity-item">
                  <span className={`activity-icon ${item.tone}`}>{item.icon}</span>
                  <div className="activity-body">
                    <div className="activity-text">{item.text}</div>
                    <div className="activity-time">{item.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default MainDashboard