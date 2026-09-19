import { X, Sparkle } from '@phosphor-icons/react'
import './appointments.css'

const HOURS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM']

const DAYS = [
  { name: 'MON', day: '26' },
  { name: 'TUE', day: '27', active: true },
  { name: 'WED', day: '28' },
  { name: 'THU', day: '29' },
  { name: 'FRI', day: '30' },
  { name: 'SAT', day: '31' },
  { name: 'SUN', day: '01' },
]

interface ApptBlock {
  day: number
  top: number
  height: number
  time: string
  name: string
  detail: string
  variant: 'green' | 'blue' | 'violet' | 'amber'
}

const BLOCKS: ApptBlock[] = [
  { day: 0, top: 60, height: 90, time: '09:00 - 10:30', name: 'Maria Lawson', detail: 'Checkup', variant: 'green' },
  { day: 0, top: 210, height: 60, time: '11:30 - 12:30', name: 'James Carter', detail: 'Root Canal', variant: 'blue' },
  { day: 1, top: 120, height: 120, time: '10:00 - 12:00', name: 'Priya Nair', detail: 'Whitening', variant: 'violet' },
  { day: 1, top: 330, height: 75, time: '01:30 - 02:45', name: 'Robert Hayes', detail: 'Consultation', variant: 'amber' },
  { day: 3, top: 270, height: 75, time: '12:30 - 01:45', name: 'Emily Brooks', detail: 'Follow-up', variant: 'blue' },
]

const NOW_OFFSET = 246

const Appointments = () => {
  return (
    <div className="appt-page">
      <div className="appt-cols">
        <section className="appt-calendar">
          <div className="appt-strip">
            <div className="appt-gutter-head" />
            {DAYS.map((d, index) => (
              <div key={index} className={`appt-day-head${d.active ? ' active' : ''}`}>
                <span className="appt-day-name">{d.name}</span>
                <span className="appt-day-num">{d.day}</span>
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

            {DAYS.map((_d, index) => (
              <div key={index} className="appt-day-col">
                {BLOCKS.filter((b) => b.day === index).map((b, bi) => (
                  <div
                    key={bi}
                    className={`appt-block block-${b.variant}`}
                    style={{ top: b.top, height: b.height }}
                  >
                    <div className="appt-block-time">{b.time}</div>
                    <div className="appt-block-name">{b.name}</div>
                    <div className="appt-block-detail">{b.detail}</div>
                  </div>
                ))}
              </div>
            ))}

            <div className="appt-now" style={{ top: NOW_OFFSET }}>
              <span className="appt-now-label">11:45</span>
              <span className="appt-now-dot" />
            </div>
          </div>
        </section>

        <aside className="appt-agenda">
          <div className="agenda-tabs">
            <span className="agenda-tab">Upcoming</span>
            <span className="agenda-tab">Today</span>
            <span className="agenda-left">4 LEFT</span>
          </div>

          <div className="agenda-card">
            <div className="agenda-time">12:00 PM</div>
            <div className="agenda-name">Priya Nair</div>
            <div className="agenda-detail">Teeth Whitening · Room 2</div>
            <div className="agenda-actions">
              <button type="button" className="agenda-confirm">Confirm</button>
              <button type="button" className="agenda-close"><X size={11} weight="bold" /></button>
            </div>
          </div>

          <div className="agenda-card">
            <div className="agenda-time amber">02:15 PM</div>
            <div className="agenda-name">Robert Hayes</div>
            <div className="agenda-detail">Implant Consult · Room 1</div>
            <div className="agenda-confirmed">Confirmed</div>
          </div>

          <div className="ai-card">
            <Sparkle size={54} weight="fill" className="ai-sparkle" />
            <div className="ai-title">Need help scheduling?</div>
            <p className="ai-body">
              AI-Assistant can optimize your week for maximum revenue.
            </p>
            <button type="button" className="ai-button">Optimize Schedule</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Appointments