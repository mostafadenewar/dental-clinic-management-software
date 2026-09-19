import type { Invoice, InsuranceClaim, InvoiceLineItem, Payment } from '../types'
import { PATIENTS } from './treatmentData'

// ---------------------------------------------------------------------------
// Static demo data for Billing & Invoicing. Replace with a repository/service
// layer backed by SQLite later without touching the UI.
// ---------------------------------------------------------------------------

const lineItem = (
  data: Partial<InvoiceLineItem> & Pick<InvoiceLineItem, 'id' | 'description' | 'amount'>,
): InvoiceLineItem => ({
  code: '',
  quantity: 1,
  unitPrice: data.amount,
  tooth: '',
  ...data,
})

const payment = (data: Payment): Payment => data

const claim = (data: InsuranceClaim): InsuranceClaim => data

const invoice = (
  data: Omit<Invoice, 'lineItems' | 'payments' | 'claim' | 'notes'> & {
    lineItems: InvoiceLineItem[]
    payments?: Payment[]
    claim?: InsuranceClaim | null
    notes?: string
  },
): Invoice => ({
  payments: [],
  claim: null,
  notes: '',
  ...data,
})

export const INITIAL_INVOICES: Invoice[] = [
  invoice({
    id: 'INV-2026-0148',
    number: 'INV-2026-0148',
    patient: PATIENTS[1],
    createdDate: '2026-04-18',
    dueDate: '2026-05-18',
    lineItems: [
      lineItem({ id: 'LI-0148-1', description: 'Endodontic Retreatment – Molar (#19)', code: 'D3346', amount: 890, tooth: '19' }),
      lineItem({ id: 'LI-0148-2', description: 'Core Buildup (#19)', code: 'D2950', amount: 340, tooth: '19' }),
    ],
    payments: [payment({ id: 'PAY-0148-1', invoiceId: 'INV-2026-0148', amount: 250, method: 'card', date: '2026-04-19', reference: 'TXN-8821' })],
    claim: claim({ id: 'CLM-4412', invoiceId: 'INV-2026-0148', payer: 'Delta Dental', amount: 820, status: 'processing', filedDate: '2026-04-20' }),
    notes: 'Remaining balance due after claim adjudication.',
  }),
  invoice({
    id: 'INV-2026-0151',
    number: 'INV-2026-0151',
    patient: PATIENTS[0],
    createdDate: '2026-05-05',
    dueDate: '2026-06-04',
    lineItems: [
      lineItem({ id: 'LI-0151-1', description: 'Digital Impressions / Scans', code: 'D0370', amount: 250 }),
      lineItem({ id: 'LI-0151-2', description: 'Orthodontic Records', code: 'D0350', amount: 120 }),
    ],
    payments: [payment({ id: 'PAY-0151-1', invoiceId: 'INV-2026-0151', amount: 370, method: 'card', date: '2026-05-05', reference: 'TXN-8830' })],
    claim: claim({ id: 'CLM-4419', invoiceId: 'INV-2026-0151', payer: 'Cigna', amount: 150, status: 'submitted', filedDate: '2026-05-06' }),
  }),
  invoice({
    id: 'INV-2026-0155',
    number: 'INV-2026-0155',
    patient: PATIENTS[3],
    createdDate: '2026-05-09',
    dueDate: '2026-06-08',
    lineItems: [
      lineItem({ id: 'LI-0155-1', description: 'Surgical Implant Placement (#19)', code: 'D6010', amount: 1650, tooth: '19' }),
      lineItem({ id: 'LI-0155-2', description: 'CBCT – Cone Beam Scan', code: 'D0367', amount: 240 }),
      lineItem({ id: 'LI-0155-3', description: 'Non-IV Conscious Sedation', code: 'D9248', amount: 210 }),
    ],
    payments: [],
    claim: claim({ id: 'CLM-4426', invoiceId: 'INV-2026-0155', payer: 'Delta Dental', amount: 980, status: 'pending', filedDate: '2026-05-10' }),
  }),
  invoice({
    id: 'INV-2026-0158',
    number: 'INV-2026-0158',
    patient: PATIENTS[4],
    createdDate: '2026-05-12',
    dueDate: '2026-06-11',
    lineItems: [
      lineItem({ id: 'LI-0158-1', description: 'Adult Prophylaxis', code: 'D1110', amount: 110 }),
      lineItem({ id: 'LI-0158-2', description: 'Periodic Oral Evaluation', code: 'D0120', amount: 55 }),
      lineItem({ id: 'LI-0158-3', description: 'Topical Fluoride Varnish', code: 'D1208', amount: 45 }),
    ],
    payments: [payment({ id: 'PAY-0158-1', invoiceId: 'INV-2026-0158', amount: 210, method: 'insurance', date: '2026-05-14', reference: 'ERA-7712' })],
    claim: claim({ id: 'CLM-4430', invoiceId: 'INV-2026-0158', payer: 'MetLife', amount: 210, status: 'approved', filedDate: '2026-05-13' }),
  }),
  invoice({
    id: 'INV-2026-0161',
    number: 'INV-2026-0161',
    patient: PATIENTS[2],
    createdDate: '2026-05-15',
    dueDate: '2026-06-14',
    lineItems: [
      lineItem({ id: 'LI-0161-1', description: 'Resin Composite – Facial (#8)', code: 'D2394', amount: 590, tooth: '8' }),
    ],
    payments: [payment({ id: 'PAY-0161-1', invoiceId: 'INV-2026-0161', amount: 590, method: 'cash', date: '2026-05-15', reference: 'CASH-1188' })],
  }),
  invoice({
    id: 'INV-2026-0164',
    number: 'INV-2026-0164',
    patient: PATIENTS[5],
    createdDate: '2026-05-20',
    dueDate: '2026-06-19',
    lineItems: [
      lineItem({ id: 'LI-0164-1', description: 'Crown – Porcelain/Ceramic (#30)', code: 'D2740', amount: 1085, tooth: '30' }),
      lineItem({ id: 'LI-0164-2', description: 'Provisional Crown', code: 'D2951', amount: 90, tooth: '30' }),
    ],
    payments: [
      payment({ id: 'PAY-0164-1', invoiceId: 'INV-2026-0164', amount: 300, method: 'card', date: '2026-05-20', reference: 'TXN-8899' }),
    ],
    claim: claim({ id: 'CLM-4436', invoiceId: 'INV-2026-0164', payer: 'Delta Dental', amount: 700, status: 'processing', filedDate: '2026-05-21' }),
  }),
  invoice({
    id: 'INV-2026-0167',
    number: 'INV-2026-0167',
    patient: PATIENTS[1],
    createdDate: '2026-05-22',
    dueDate: '2026-06-21',
    lineItems: [
      lineItem({ id: 'LI-0167-1', description: 'Crown – Porcelain/Ceramic (#3)', code: 'D2740', amount: 1080, tooth: '3' }),
    ],
    payments: [payment({ id: 'PAY-0167-1', invoiceId: 'INV-2026-0167', amount: 380, method: 'card', date: '2026-05-22', reference: 'TXN-8905' })],
    claim: claim({ id: 'CLM-4439', invoiceId: 'INV-2026-0167', payer: 'Delta Dental', amount: 700, status: 'pending', filedDate: '2026-05-23' }),
  }),
]

export const REVENUE_TREND = [
  { month: 'Dec', revenue: 38200, collected: 35400 },
  { month: 'Jan', revenue: 41900, collected: 40200 },
  { month: 'Feb', revenue: 39400, collected: 37100 },
  { month: 'Mar', revenue: 44600, collected: 43800 },
  { month: 'Apr', revenue: 46200, collected: 44100 },
  { month: 'May', revenue: 48290, collected: 39600 },
]

export const AGING_BUCKETS = [
  { label: '0-30 days', amount: 2135, count: 3 },
  { label: '31-60 days', amount: 980, count: 1 },
  { label: '61-90 days', amount: 0, count: 0 },
  { label: '90+ days', amount: 0, count: 0 },
]

export const NET_REVENUE_TARGET = 55000
export const MONTH_AS_OF = 'May 2026'