import { useState } from 'react'
import './App.css'
import SideBar from './left_sidebar/sideBar.tsx'
import Header from './header/header.tsx'
import Dashboard from './main_dashboard/main_dashboard.tsx'
import Patients from './patients/patients.tsx'
import Appointments from './appointments/appointments.tsx'
import TreatmentPlans from './treatment_plans/treatment_plans.tsx'
import Billing from './billing/billing.tsx'
import Inventory from './inventory/inventory.tsx'

export type PageKey =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'treatment'
  | 'billing'
  | 'inventory'

function App() {
  const [page, setPage] = useState<PageKey>('dashboard')

  return (
    <div className="app-layout">
      <SideBar current={page} onNavigate={setPage} />
      <div className="app-main">
        <Header page={page} />
        <main className="app-content">
          {page === 'dashboard' && <Dashboard />}
          {page === 'patients' && <Patients />}
          {page === 'appointments' && <Appointments />}
          {page === 'treatment' && <TreatmentPlans />}
          {page === 'billing' && <Billing />}
          {page === 'inventory' && <Inventory />}
        </main>
      </div>
    </div>
  )
}

export default App