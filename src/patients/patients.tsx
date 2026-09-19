import {
  Funnel,
  Export,
  SquaresFour,
  SlidersHorizontal,
  Eye,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'
import './patients.css'

type PatientStatus = 'HEALTHY' | 'IN TREATMENT' | 'FOLLOW-UP' | 'INACTIVE'

interface Patient {
  name: string
  phone: string
  id: string
  genderAge: string
  lastVisit: string
  doctor: string
  status: PatientStatus
  outstanding: string
  overdue: boolean
}

const PATIENT_STATUS: Record<PatientStatus, string> = {
  HEALTHY: 'badge-healthy',
  'IN TREATMENT': 'badge-treatment',
  'FOLLOW-UP': 'badge-followup',
  INACTIVE: 'badge-inactive',
}

const PATIENTS: Patient[] = [
  { name: 'Maria Lawson', phone: '+1 (555) 012-3456', id: 'PT-2024-0891', genderAge: 'Female, 28', lastVisit: 'May 26, 2026', doctor: 'Dr. Smith', status: 'HEALTHY', outstanding: '$0.00', overdue: false },
  { name: 'James Carter', phone: '+1 (555) 789-0123', id: 'PT-2024-0412', genderAge: 'Male, 45', lastVisit: 'May 20, 2026', doctor: 'Dr. Lee', status: 'IN TREATMENT', outstanding: '$850.00', overdue: true },
  { name: 'Priya Nair', phone: '+1 (555) 234-5678', id: 'PT-2024-1102', genderAge: 'Female, 32', lastVisit: 'Apr 12, 2026', doctor: 'Dr. Smith', status: 'FOLLOW-UP', outstanding: '$120.00', overdue: false },
  { name: 'Robert Hayes', phone: '+1 (555) 345-6789', id: 'PT-2023-0941', genderAge: 'Male, 58', lastVisit: 'May 15, 2026', doctor: 'Dr. Smith', status: 'INACTIVE', outstanding: '$0.00', overdue: false },
  { name: 'Emily Brooks', phone: '+1 (555) 678-9012', id: 'PT-2024-0219', genderAge: 'Female, 22', lastVisit: 'Feb 28, 2026', doctor: 'Dr. Lee', status: 'HEALTHY', outstanding: '$0.00', overdue: false },
]

const Patients = () => {
  return (
    <div className="patients-page">
      <section className="tabs-card">
        <div className="tabs">
          <button type="button" className="tab active">All Patients</button>
          <button type="button" className="tab">Recent</button>
          <button type="button" className="tab">Active Treatment</button>
          <button type="button" className="tab">Overdue</button>
        </div>
        <div className="tabs-tools">
          <button type="button" className="tool-btn"><Funnel size={14} /></button>
          <button type="button" className="tool-btn"><Export size={14} /></button>
          <button type="button" className="tool-btn tool-fill"><SquaresFour size={14} /></button>
          <button type="button" className="tool-btn"><SlidersHorizontal size={14} /></button>
        </div>
      </section>

      <section className="table-card">
        <div className="pat-header pat-grid">
          <span className="cell c1">PATIENT NAME</span>
          <span className="cell c2">ID</span>
          <span className="cell c3">GENDER / AGE</span>
          <span className="cell c4">LAST VISIT</span>
          <span className="cell c5">STATUS</span>
          <span className="cell c6">OUTSTANDING</span>
          <span className="cell c7">ACTIONS</span>
        </div>

        {PATIENTS.map((p, index) => (
          <div key={index} className="pat-row pat-grid">
            <div className="cell c1">
              <div className="pat-name">{p.name}</div>
              <div className="pat-phone">{p.phone}</div>
            </div>
            <span className="cell c2 pat-mono">{p.id}</span>
            <span className="cell c3">{p.genderAge}</span>
            <div className="cell c4">
              <div className="pat-visit">{p.lastVisit}</div>
              <div className="pat-doctor">{p.doctor}</div>
            </div>
            <span className="cell c5">
              <span className={`status-badge ${PATIENT_STATUS[p.status]}`}>{p.status}</span>
            </span>
            <span className={`cell c6${p.overdue ? ' overdue' : ''}`}>{p.outstanding}</span>
            <span className="cell c7">
              <button type="button" className="row-action"><Eye size={14} /></button>
            </span>
          </div>
        ))}

        <div className="table-footer">
          <span className="showing">Showing 1-5 of 1,284 patients</span>
          <div className="pagination">
            <button type="button" className="page-arrow"><CaretLeft size={12} weight="bold" /></button>
            <button type="button" className="page-num active">1</button>
            <button type="button" className="page-num">2</button>
            <button type="button" className="page-num">3</button>
            <span className="page-ellipsis">...</span>
            <button type="button" className="page-num">257</button>
            <button type="button" className="page-arrow"><CaretRight size={12} weight="bold" /></button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Patients