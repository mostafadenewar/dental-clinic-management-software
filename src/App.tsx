import { useDeferredValue, useEffect, useState } from 'react'
import './App.css'
import SideBar from './left_sidebar/sideBar.tsx'
import Header from './header/header.tsx'
import Dashboard from './main_dashboard/main_dashboard.tsx'
import Patients from './patients/patients.tsx'
import Appointments from './appointments/appointments.tsx'
import TreatmentPlans from './treatment_plans/treatment_plans.tsx'
import Billing from './billing/billing.tsx'
import Inventory from './inventory/inventory.tsx'
import Profile from './profile/profile.tsx'
import Settings from './settings/settings.tsx'
import Login from './auth/Login'
import { ToastProvider } from './components/Toast'
import { useAuthStore } from './auth/authStore'
import { useBackendReady } from './api/client'
import { useNotificationsStore } from './notifications/notificationsStore'

export type PageKey =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'treatment'
  | 'billing'
  | 'inventory'
  | 'profile'
  | 'settings'

function App() {
  const ready = useBackendReady()
  const authStatus = useAuthStore((s) => s.status)
  const hydrate = useAuthStore((s) => s.hydrate)
  const logout = useAuthStore((s) => s.logout)
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread)

  const [page, setPage] = useState<PageKey>('dashboard')
  const contentPage = useDeferredValue(page)
  const [search, setSearch] = useState('')
  const [treatmentCreateOpen, setTreatmentCreateOpen] = useState(false)
  const [billingCreateOpen, setBillingCreateOpen] = useState(false)
  const [inventoryCreateOpen, setInventoryCreateOpen] = useState(false)
  const [patientCreateOpen, setPatientCreateOpen] = useState(false)
  const [appointmentCreateOpen, setAppointmentCreateOpen] = useState(false)

  useEffect(() => {
    if (ready && authStatus === 'loading') void hydrate()
  }, [ready, authStatus, hydrate])

  useEffect(() => {
    if (!ready || authStatus !== 'authenticated') return
    void refreshUnread()
    const timer = window.setInterval(() => void refreshUnread(), 60_000)
    return () => window.clearInterval(timer)
  }, [ready, authStatus, refreshUnread])

  const handleNavigate = (next: PageKey) => {
    setPage(next)
    setSearch('')
  }

  const primaryAction = (() => {
    if (page === 'billing') {
      return { label: 'Add Expense', onClick: () => setBillingCreateOpen(true) }
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

  if (!ready || authStatus === 'loading') {
    return (
      <div className="app-splash">
        <span className="app-splash-dot" />
        <span>Loading DCMS…</span>
      </div>
    )
  }

  if (authStatus !== 'authenticated') {
    return <Login />
  }

  return (
    <div className="app-layout">
      <SideBar current={page} onNavigate={handleNavigate} onLogout={() => void logout()} />
      <ToastProvider>
        <div className="app-main">
          <Header
            page={page}
            searchValue={search}
            onSearchChange={setSearch}
            onNavigate={handleNavigate}
            primaryAction={primaryAction}
          />
          <main className="app-content">
            {contentPage === 'dashboard' && (
              <Dashboard
                searchQuery={search}
                onNavigate={(target) =>
                  handleNavigate(target === 'appointments' || target === 'patients' || target === 'billing' ? target : 'dashboard')
                }
                onOpenNewAppointment={() => {
                  handleNavigate('appointments')
                  setAppointmentCreateOpen(true)
                }}
                onOpenNewPatient={() => {
                  handleNavigate('patients')
                  setPatientCreateOpen(true)
                }}
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
            {contentPage === 'profile' && <Profile />}
            {contentPage === 'settings' && <Settings />}
          </main>
        </div>
      </ToastProvider>
    </div>
  )
}

export default App