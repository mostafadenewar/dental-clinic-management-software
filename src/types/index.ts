// ---------------------------------------------------------------------------
// Core domain types for the dental practice desktop application.
//
// These types are intentionally renderer-safe and free of any SQLite / IPC
// concern. When persistence is wired up later, repository implementations can
// map these shapes onto database rows and be accessed through Electron IPC /
// preload without touching any of the UI components below.
// ---------------------------------------------------------------------------

export type ToothNumbering = 'universal'

export type PlanStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type ProcedureStatus =
  | 'planned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'pending'
  | 'cancelled'

export type TreatmentCategory =
  | 'Diagnostic'
  | 'Preventive'
  | 'Restorative'
  | 'Endodontics'
  | 'Oral Surgery'
  | 'Periodontics'
  | 'Prosthodontics'
  | 'Orthodontics'
  | 'Cosmetic'

export interface ToothSelection {
  numbering: ToothNumbering
  /** Tooth numbers in the referenced numbering system (e.g. Universal 1-32). */
  teeth: number[]
}

export interface PatientSummary {
  id: string
  name: string
  initials: string
  age: number
  gender: 'Female' | 'Male' | 'Other'
  phone: string
  dob?: string
}

export interface CareProvider {
  id: string
  name: string
  role: string
  title: string
}

export type EligibilityStatus = 'verified' | 'pending' | 'not_verified'
export type PreAuthStatus = 'not_required' | 'requested' | 'approved' | 'denied'

export interface InsuranceBenefit {
  id: string
  provider: string
  policyNumber: string
  groupNumber: string
  coveragePercent: number
  annualMaximum: number
  usedThisYear: number
  eligibilityStatus: EligibilityStatus
  preAuthStatus: PreAuthStatus
  lastVerified: string | null
}

export interface CareTask {
  id: string
  label: string
  done: boolean
}

export interface TreatmentProcedure {
  id: string
  planId: string
  phaseId: string
  procedureName: string
  code: string
  category: TreatmentCategory
  toothSelection: ToothSelection
  providerId: string
  status: ProcedureStatus
  plannedDate: string | null
  scheduledDate: string | null
  completedDate: string | null
  fee: number
  insuranceEstimate: number
  patientResponsibility: number
  notes: string
}

export interface TreatmentPhase {
  id: string
  planId: string
  name: string
  order: number
  description: string
  procedures: TreatmentProcedure[]
}

export interface TreatmentPlan {
  id: string
  title: string
  description: string
  status: PlanStatus
  patient: PatientSummary
  doctorId: string
  coordinatorId: string
  insuranceId: string
  createdAt: string
  updatedAt: string
  phases: TreatmentPhase[]
  careTasks?: CareTask[]
}

export interface PlanFinancials {
  estimatedValue: number
  insuranceContribution: number
  patientShare: number
  completedCount: number
  totalCount: number
  coveragePercent: number
  progressPercent: number
}

export type InvoiceStatus = 'paid' | 'unpaid' | 'partial' | 'overdue'
export type PaymentMethod = 'cash' | 'card' | 'check' | 'insurance' | 'other'
export type ClaimStatus = 'pending' | 'processing' | 'submitted' | 'approved' | 'denied'

export interface InvoiceLineItem {
  id: string
  description: string
  code: string
  quantity: number
  unitPrice: number
  amount: number
  tooth: string
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  method: PaymentMethod
  date: string
  reference: string
}

export interface InsuranceClaim {
  id: string
  invoiceId: string
  payer: string
  amount: number
  status: ClaimStatus
  filedDate: string
}

export interface Invoice {
  id: string
  number: string
  patient: PatientSummary
  createdDate: string
  dueDate: string
  lineItems: InvoiceLineItem[]
  payments: Payment[]
  claim: InsuranceClaim | null
  notes: string
}

export interface InvoiceTotals {
  total: number
  paid: number
  balance: number
  status: InvoiceStatus
}

export type InventoryCategory = 'Consumables' | 'Instruments' | 'PPE & Hygiene' | 'Laboratory'
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock'
export type StockMovementType = 'inbound' | 'outbound' | 'adjustment'

export interface StorageLocation {
  id: string
  name: string
  capacity: number
  used: number
  description: string
}

export interface InventoryItem {
  id: string
  name: string
  brand: string
  sku: string
  category: InventoryCategory
  packSize: string
  unit: string
  quantityOnHand: number
  minimumThreshold: number
  reorderQuantity: number
  locationId: string
  costPerUnit: number
}

export interface InventoryTransaction {
  id: string
  itemId: string
  type: StockMovementType
  quantity: number
  date: string
  reason: string
  performedBy: string
}

export type SupplierOrderStatus = 'pending' | 'approved' | 'shipped' | 'received' | 'delayed'

export interface SupplierOrderLine {
  itemId: string
  itemName: string
  quantity: number
  unitCost: number
}

export interface SupplierOrder {
  id: string
  supplier: string
  lines: SupplierOrderLine[]
  totalCost: number
  placedDate: string
  estimatedArrival: string
  status: SupplierOrderStatus
}

export interface InventoryTotals {
  quantityOnHand: number
  totalValue: number
  status: InventoryStatus
  progressPercent: number
}

/** Small, typed computing/domain helpers. Kept outside presentation components. */
export type PlanFilterKey = 'all' | 'active' | 'pending' | 'draft' | 'approved' | 'scheduled'
export type InvoiceFilterKey = 'all' | 'paid' | 'unpaid' | 'partial' | 'overdue'
export type CategoryFilterKey = 'all' | InventoryCategory