import { useEffect, useState } from 'react'
import type {
  CareProvider,
  ClaimStatus,
  InventoryItem,
  Invoice,
  InvoiceTotals,
  InsurancePlan,
  PatientSummary,
  StorageLocation,
  SupplierOrder,
  TreatmentCategory,
  TreatmentRecord,
  PlanGroup,
  BillingOverview,
  BillingPaymentRecord,
  ExpenseRecord,
} from '../types'

// ---------------------------------------------------------------------------
// Backend transport. The base URL is pushed by Electron's main process via
// window.dcms.onBackendUrl; in dev (plain Vite) we fall back to the default
// port. The shared backend module keeps a copy of the last-known URL so other
// app files can build paths without React context.
// ---------------------------------------------------------------------------

let baseUrl = (window as { __DCMS_API__?: string }).__DCMS_API__ ?? 'http://127.0.0.1:8419'
const hasElectronBackendBridge = Boolean(
  (window as { dcms?: { onBackendUrl?: unknown } }).dcms?.onBackendUrl,
)
let backendReady = !hasElectronBackendBridge

const readyListeners = new Set<() => void>()

/** Subscribe to the backend base URL pushed by the main process. */
export function initBackend(): void {
  const win = window as { dcms?: { onBackendUrl?: (cb: (url: string) => void) => () => void } }
  win.dcms?.onBackendUrl?.((url: string) => {
    if (url) {
      baseUrl = url.replace(/\/+$/, '')
      backendReady = true
      readyListeners.forEach((fn) => fn())
    }
  })
}

initBackend()

/** Subscribe to be notified when a backend URL first becomes known. */
export function onBackendReady(fn: () => void): () => void {
  readyListeners.add(fn)
  if (backendReady) fn()
  return () => readyListeners.delete(fn)
}

export const getBaseUrl = (): string => baseUrl

export async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = (await res.json()) as { error?: string; detail?: string }
      message = data.error ?? data.detail ?? message
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export function useBackendReady(): boolean {
  const [ready, setReady] = useState(backendReady)
  useEffect(() => onBackendReady(() => setReady(true)), [])
  return ready
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export type ClinicalStatus = 'HEALTHY' | 'IN TREATMENT' | 'FOLLOW-UP' | 'INACTIVE'

export interface PatientRecord {
  id: string
  name: string
  initials: string
  age: number
  gender: 'Female' | 'Male' | 'Other'
  phone: string
  email: string
  dob: string | null
  address: string
  insuranceId: string
  insuranceProvider: string
  status: string
  clinicalStatus: ClinicalStatus
  lastVisit: string | null
  doctorName: string
  outstanding: number
  overdue: boolean
  createdAt: string
  notes: string
}

export interface AppointmentRecord {
  id: string
  patientId: string
  patientName: string
  patientInitials: string
  patientGenderAge: string
  providerId: string
  providerName: string
  title: string
  date: string
  startTime: string
  endTime: string
  room: string
  status: string
  notes: string
}

export interface PatientHistory {
  appointments: Array<{
    id: string
    date: string
    startTime: string
    endTime: string
    title: string
    room: string
    status: string
    notes: string
    provider: string
  }>
  invoices: Array<{
    id: string
    number: string
    createdDate: string
    dueDate: string
    notes: string
    items: Array<{ description: string; code: string; quantity: number; unitPrice: number; amount: number }>
    totals: { total: number; paid: number; balance: number; status: string }
  }>
}

export interface DashboardData {
  stats: {
    todayAppointments: number
    todayScheduled: number
    newPatientsWeek: number
    newPatientsPrevWeek: number
    monthlyRevenue: number
    prevMonthRevenue: number
    revenuePct: number
    outstanding: number
    activePlans: number
    lowStock: number
    totalPatients: number
  }
  schedule: Array<{ id: string; time: string; patient: string; detail: string; tone: string; status: string }>
  activity: Array<{ kind: string; tone: string; icon: string; text: string; timeAgo: string }>
  revenueTrend: Array<{ month: string; revenue: number; collected: number }>
}

export interface BillingSummary {
  netRevenue: number
  prevMonthRevenue: number
  outstandingAmount: number
  outstandingCount: number
  activeClaims: Array<{ id: string; payer: string; amount: number; status: string; filedDate: string }>
  aging: number[]
  revenueTrend: Array<{ month: string; revenue: number; collected: number }>
}

export interface InventorySummary {
  lowItems: InventoryItem[]
  totalValue: number
  openOrdersCount: number
  openOrdersTotal: number
  locations: StorageLocation[]
}

export interface ProcedureCatalogEntry {
  code: string
  name: string
  category: TreatmentCategory
  defaultFee: number
}

// Mapping helpers ------------------------------------------------------------

const toProvider = (r: { id: string; fullName: string; role: string; title: string }): CareProvider => ({
  id: r.id,
  name: r.fullName,
  role: r.role,
  title: r.title,
})

const toInsurancePlan = (r: {
  id: string
  provider: string
  policyNumber: string
  notes: string
}): InsurancePlan => ({
  id: r.id,
  provider: r.provider,
  policyNumber: r.policyNumber ?? '',
  notes: r.notes ?? '',
})

const toInvoice = (r: {
  id: string
  number: string
  patient: PatientSummary
  createdDate: string
  dueDate: string
  lineItems: Invoice['lineItems']
  payments: Invoice['payments']
  claim: {
    id: string
    payer: string
    amount: number
    status: string
    submittedAt?: string
    filedDate?: string
  } | null
  notes: string
  totals: InvoiceTotals
}): Invoice & { totals: InvoiceTotals } => ({
  id: r.id,
  number: r.number,
  patient: r.patient,
  createdDate: r.createdDate,
  dueDate: r.dueDate,
  lineItems: r.lineItems,
  payments: r.payments,
  claim: r.claim
    ? {
id: r.claim.id,
      invoiceId: r.id,
      payer: r.claim.payer,
      amount: r.claim.amount,
      status: r.claim.status as ClaimStatus,
      filedDate: r.claim.filedDate ?? r.claim.submittedAt ?? '',
    }
    : null,
  notes: r.notes,
  totals: r.totals,
})

interface PatientHistoryRaw {
  appointments: Array<{
    id: string
    date: string
    start_time: string
    end_time: string
    title: string
    room: string
    status: string
    notes: string
    provider: string
  }>
  invoices: Array<{
    id: string
    number: string
    createdDate: string
    dueDate: string
    notes: string
    items: Array<{ description: string; code: string; quantity: number; unit_price: number; amount: number }>
    totals: { total: number; paid: number; balance: number; status: string }
  }>
}

const toPatientHistory = (r: PatientHistoryRaw): PatientHistory => ({
  appointments: (r.appointments ?? []).map((a) => ({
    id: a.id,
    date: a.date,
    startTime: a.start_time ?? '',
    endTime: a.end_time ?? '',
    title: a.title ?? '',
    room: a.room ?? '',
    status: a.status ?? '',
    notes: a.notes ?? '',
    provider: a.provider ?? '',
  })),
  invoices: (r.invoices ?? []).map((inv) => ({
    id: inv.id,
    number: inv.number,
    createdDate: inv.createdDate,
    dueDate: inv.dueDate,
    notes: inv.notes,
    items: (inv.items ?? []).map((it) => ({
      description: it.description,
      code: it.code,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      amount: it.amount,
    })),
    totals: inv.totals,
  })),
})

// Endpoint bindings ----------------------------------------------------------

export const api = {
  dashboard: () => apiFetch<DashboardData>('GET', '/api/dashboard'),

  patients: () => apiFetch<PatientRecord[]>('GET', '/api/patients'),
  patient: (id: string) => apiFetch<PatientRecord>('GET', `/api/patients/${encodeURIComponent(id)}`),
  patientHistory: (id: string) =>
    apiFetch<PatientHistoryRaw>('GET', `/api/patients/${encodeURIComponent(id)}/history`).then(toPatientHistory),
  createPatient: (data: object) => apiFetch<PatientRecord>('POST', '/api/patients', data),
  updatePatient: (id: string, data: object) =>
    apiFetch<PatientRecord>('PATCH', `/api/patients/${encodeURIComponent(id)}`, data),
  deletePatient: (id: string) => apiFetch<{ ok: true }>('DELETE', `/api/patients/${encodeURIComponent(id)}`),

  appointments: (start?: string, end?: string) => {
    const q = new URLSearchParams()
    if (start) q.set('start', start)
    if (end) q.set('end', end)
    const qs = q.toString()
    return apiFetch<AppointmentRecord[]>('GET', `/api/appointments${qs ? `?${qs}` : ''}`)
  },
  createAppointment: (data: object) =>
    apiFetch<AppointmentRecord>('POST', '/api/appointments', data),
  updateAppointment: (id: string, data: object) =>
    apiFetch<AppointmentRecord>('PATCH', `/api/appointments/${encodeURIComponent(id)}`, data),
  setAppointmentStatus: (id: string, status: string) =>
    apiFetch<AppointmentRecord>('PATCH', `/api/appointments/${encodeURIComponent(id)}/status`, { status }),
  deleteAppointment: (id: string) => apiFetch<{ ok: true }>('DELETE', `/api/appointments/${encodeURIComponent(id)}`),

  treatments: (patientId?: string) => {
    const q = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
    return apiFetch<TreatmentRecord[]>('GET', `/api/treatments${q}`)
  },
  createTreatment: (data: object) => apiFetch<TreatmentRecord>('POST', '/api/treatments', data),
  updateTreatment: (id: string, data: object) =>
    apiFetch<TreatmentRecord>('PATCH', `/api/treatments/${encodeURIComponent(id)}`, data),
  deleteTreatment: (id: string) => apiFetch<{ ok: true }>('DELETE', `/api/treatments/${encodeURIComponent(id)}`),
  recordTreatmentPayment: (id: string, data: object) =>
    apiFetch<TreatmentRecord>('POST', `/api/treatments/${encodeURIComponent(id)}/payments`, data),

  planGroups: () => apiFetch<PlanGroup[]>('GET', '/api/plan-groups'),
  createPlanGroup: (data: object) => apiFetch<PlanGroup>('POST', '/api/plan-groups', data),
  deletePlanGroup: (id: string) => apiFetch<{ ok: true }>('DELETE', `/api/plan-groups/${encodeURIComponent(id)}`),

  billingOverview: () => apiFetch<BillingOverview>('GET', '/api/billing/overview'),
  billingPayments: (patientId?: string) => {
    const q = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
    return apiFetch<BillingPaymentRecord[]>('GET', `/api/billing/payments${q}`)
  },
  expenses: (month?: string) => {
    const q = month ? `?month=${encodeURIComponent(month)}` : ''
    return apiFetch<ExpenseRecord[]>('GET', `/api/expenses${q}`)
  },
  createExpense: (data: object) => apiFetch<ExpenseRecord>('POST', '/api/expenses', data),
  deleteExpense: (id: string) => apiFetch<{ ok: true }>('DELETE', `/api/expenses/${encodeURIComponent(id)}`),

  invoices: () => apiFetch<Array<Invoice & { totals: InvoiceTotals }>>('GET', '/api/invoices'),
  createInvoice: (data: object) =>
    apiFetch<Invoice & { totals: InvoiceTotals }>('POST', '/api/invoices', data),
  recordPayment: (invoiceId: string, data: object) =>
    apiFetch<Invoice & { totals: InvoiceTotals }>('POST', `/api/invoices/${encodeURIComponent(invoiceId)}/payments`, data),
  billingSummary: () => apiFetch<BillingSummary>('GET', '/api/billing/summary'),

  inventory: (search?: string, category?: string) => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (category) q.set('category', category)
    return apiFetch<InventoryItem[]>('GET', `/api/inventory?${q.toString()}`)
  },
  createItem: (data: object) => apiFetch<InventoryItem>('POST', '/api/inventory/items', data),
  updateItem: (id: string, data: object) =>
    apiFetch<InventoryItem>('PATCH', `/api/inventory/items/${encodeURIComponent(id)}`, data),
  deleteItem: (id: string) => apiFetch<{ ok: true }>('DELETE', `/api/inventory/items/${encodeURIComponent(id)}`),
  adjustQuantity: (id: string, delta: number, reason: string, performedBy?: string) =>
    apiFetch<InventoryItem>(
      'POST',
      `/api/inventory/items/${encodeURIComponent(id)}/adjust`,
      { delta, reason, performedBy: performedBy ?? 'Admin' },
    ),
  itemTransactions: (id: string) =>
    apiFetch<Array<{ id: string; itemId: string; type: string; quantity: number; date: string; reason: string; performedBy: string }>>(
      'GET',
      `/api/inventory/items/${encodeURIComponent(id)}/transactions`,
    ),
  orders: () => apiFetch<SupplierOrder[]>('GET', '/api/inventory/orders'),
  createOrder: (data: object) =>
    apiFetch<SupplierOrder>('POST', '/api/inventory/orders', data),
  inventorySummary: () => apiFetch<InventorySummary>('GET', '/api/inventory/summary'),
  locations: () => apiFetch<StorageLocation[]>('GET', '/api/inventory/locations'),

  catalog: () => apiFetch<ProcedureCatalogEntry[]>('GET', '/api/catalog'),
  providers: () =>
    apiFetch<Array<{ id: string; fullName: string; role: string; title: string }>>('GET', '/api/providers').then(
      (rows) => rows.map(toProvider),
    ),
  coordinators: () =>
    apiFetch<Array<{ id: string; fullName: string; role: string; title: string }>>('GET', '/api/coordinators').then(
      (rows) => rows.map(toProvider),
    ),
  insurance: () =>
    apiFetch<Array<{
      id: string
      provider: string
      policyNumber: string
      notes: string
    }>>('GET', '/api/insurance').then((rows) => rows.map(toInsurancePlan)),

  mapInvoice: toInvoice,
}