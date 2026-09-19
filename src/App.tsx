import { useDeferredValue, useState } from 'react'
import './App.css'
import SideBar from './left_sidebar/sideBar.tsx'
import Header from './header/header.tsx'
import Dashboard from './main_dashboard/main_dashboard.tsx'
import Patients from './patients/patients.tsx'
import Appointments from './appointments/appointments.tsx'
import TreatmentPlans from './treatment_plans/treatment_plans.tsx'
import Billing from './billing/billing.tsx'
import Inventory from './inventory/inventory.tsx'
import { ToastProvider } from './components/Toast'

export type PageKey =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'treatment'
  | 'billing'
  | 'inventory'

function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const contentPage = useDeferredValue(page)
  const [search, setSearch] = useState('')
  const [treatmentCreateOpen, setTreatmentCreateOpen] = useState(false)
  const [billingCreateOpen, setBillingCreateOpen] = useState(false)
  const [inventoryCreateOpen, setInventoryCreateOpen] = useState(false)
  const [patientCreateOpen, setPatientCreateOpen] = useState(false)
  const [appointmentCreateOpen, setAppointmentCreateOpen] = useState(false)

  const handleNavigate = (next: PageKey) => {
    setPage(next)
    setSearch('')
  }

  const primaryAction = (() => {
    if (page === 'treatment') {
      return { label: 'New Plan', onClick: () => setTreatmentCreateOpen(true) }
    }
    if (page === 'billing') {
      return { label: 'Create Invoice', onClick: () => setBillingCreateOpen(true) }
    }
    if (page === 'inventory') {
      return { label: 'Add Stock', onClick: () => setInventoryCreateOpen(true) }
    }
    if (page === 'patients') {
      return { label: 'New Patient', onClick: () => setPatientCreateOpen(true) }
    }
    if (page === 'appointments') {
      return { label: 'New Appointment', onClick: () => setAppointmentCreateOpen(true) }
    }
    return undefined
  })()

  return (
    <div className="app-layout">
      <SideBar current={page} onNavigate={handleNavigate} />
      <ToastProvider>
        <div className="app-main">
          <Header
            page={page}
            searchValue={search}
            onSearchChange={setSearch}
            primaryAction={primaryAction}
          />
          <main className="app-content">
            {contentPage === 'dashboard' && (
              <Dashboard
                onNavigate={(target) =>
                  handleNavigate(target === 'appointments' || target === 'patients' || target === 'billing' ? target : 'dashboard')
                }
              />
            )}
            {contentPage === 'patients' && (
              <Patients
                searchQuery={search}
                createOpen={patientCreateOpen}
                onCreateOpenChange={setPatientCreateOpen}
              />
            )}
            {contentPage === 'appointments' && (
              <Appointments
                searchQuery={search}
                createOpen={appointmentCreateOpen}
                onCreateOpenChange={setAppointmentCreateOpen}
              />
            )}
            {contentPage === 'treatment' && (
              <TreatmentPlans
                searchQuery={search}
                createOpen={treatmentCreateOpen}
                onCreateOpenChange={setTreatmentCreateOpen}
              />
            )}
            {contentPage === 'billing' && (
              <Billing
                searchQuery={search}
                createOpen={billingCreateOpen}
                onCreateOpenChange={setBillingCreateOpen}
              />
            )}
            {contentPage === 'inventory' && (
              <Inventory
                searchQuery={search}
                createOpen={inventoryCreateOpen}
                onCreateOpenChange={setInventoryCreateOpen}
              />
            )}
          </main>
        </div>
      </ToastProvider>
    </div>
  )
}

export default App