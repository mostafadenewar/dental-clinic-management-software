import { useEffect, useMemo, useState } from 'react'
import {
  Bank,
  CurrencyDollar,
  PiggyBank,
  Plus,
  Receipt,
  Trash,
  TrendUp,
} from '@phosphor-icons/react'
import './billing_ledger.css'
import type {
  BillingOverview,
  BillingPaymentRecord,
  ExpenseCategory,
  ExpenseRecord,
  PaymentMethod,
} from '../types'
import { api, useBackendReady } from '../api/client'
import { currency, dateShort } from '../utils/format'
import { Modal } from '../components/Modal'
import { useToast } from '../components/toastStore'

// ---------------------------------------------------------------------------
// Practice billing — per-patient payment records (with optional insurance
// deduction) plus the clinic's expense ledger. Legacy invoices remain
// available to the patients page and dashboard via the API.
// ---------------------------------------------------------------------------

interface BillingProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

type LedgerTab = 'payments' | 'expenses'

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Wages', 'Laboratory', 'Materials', 'Rent & Utilities', 'Equipment', 'Taxes', 'Marketing', 'Other',
]

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'check', label: 'Check' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_TONE: Record<ExpenseCategory, string> = {
  Wages: 'blue',
  Laboratory: 'violet',
  Materials: 'teal',
  'Rent & Utilities': 'amber',
  Equipment: 'slate',
  Taxes: 'red',
  Marketing: 'green',
  Other: 'slate',
}

const monthOptions = (): Array<{ value: string; label: string }> => {
  const now = new Date()
  const out: Array<{ value: string; label: string }> = []
  for (let i = 0; i < 4; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    out.push({ value, label })
  }
  return out
}

const MONTHS = monthOptions()
const CURRENT_MONTH = MONTHS[0].value

const Billing = ({ searchQuery, createOpen, onCreateOpenChange }: BillingProps) => {
  const toast = useToast()
  const ready = useBackendReady()
  const [tab, setTab] = useState<LedgerTab>('payments')
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [payments, setPayments] = useState<BillingPaymentRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [month, setMonth] = useState<string>('all')
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all')
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [ov, pays, exps] = await Promise.all([
        api.billingOverview(),
        api.billingPayments(),
        api.expenses(),
      ])
      setOverview(ov)
      setPayments(pays)
      setExpenses(exps)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to load billing', { tone: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!ready) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    if (createOpen) {
      setExpenseOpen(true)
      onCreateOpenChange(false)
    }
  }, [createOpen, onCreateOpenChange])

  const q = searchQuery.trim().toLowerCase()

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (month !== 'all' && !p.date.startsWith(month)) return false
      if (q) {
        const hay = `${p.patient.name} ${p.procedureName} ${p.insuranceAmount ? 'insurance' : ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [payments, month, q])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (month !== 'all' && !e.date.startsWith(month)) return false
      if (q && !`${e.description} ${e.paidTo}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [expenses, category, month, q])

  const paymentsTotals = useMemo(() => {
    const patient = filteredPayments.reduce((s, p) => s + p.amountPaid, 0)
    const insurance = filteredPayments.reduce((s, p) => s + p.insuranceAmount, 0)
    return { patient, insurance, total: patient + insurance }
  }, [filteredPayments])

  const expensesTotals = useMemo(() => {
    const byCategory = new Map<ExpenseCategory, number>()
    for (const e of filteredExpenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
    }
    return { total: filteredExpenses.reduce((s, e) => s + e.amount, 0), byCategory }
  }, [filteredExpenses])

  const kpiCards = [
    {
      key: 'collected',
      label: 'Collected · ' + CURRENT_MONTH.replace('-', ' '),
      value: overview ? currency(overview.patientCollected) : '—',
      hint: 'Patient payments',
      icon: <CurrencyDollar size={16} weight="bold" />,
      tone: 'green',
    },
    {
      key: 'insurance',
      label: 'Insurance portion',
      value: overview ? currency(overview.insurancePortion) : '—',
      hint: 'Paid by carriers',
      icon: <Bank size={16} weight="fill" />,
      tone: 'blue',
    },
    {
      key: 'revenue',
      label: 'Month revenue',
      value: overview ? currency(overview.revenue) : '—',
      hint: overview
        ? `vs ${currency(overview.prevMonthRevenue)} last month`
        : '',
      icon: <TrendUp size={16} weight="bold" />,
      tone: 'slate',
    },
    {
      key: 'expenses',
      label: 'Expenses · ' + CURRENT_MONTH.replace('-', ' '),
      value: overview ? currency(overview.expensesTotal) : '—',
      hint: overview
        ? `Wages ${currency(overview.wagesExpenses)} · Other ${currency(overview.otherExpenses)}`
        : '',
      icon: <Receipt size={16} weight="bold" />,
      tone: 'amber',
    },
    {
      key: 'net',
      label: 'Net profit',
      value: overview ? currency(overview.netProfit) : '—',
      hint: overview ? `${currency(overview.outstandingTreatments)} still due from patients` : '',
      icon: <PiggyBank size={16} weight="fill" />,
      tone: 'violet',
    },
  ]

  return (
    <div className="bl-page">
      <div className="bl-kpis">
        {kpiCards.map((c) => (
          <div key={c.key} className="bl-kpi">
            <span className={`bl-kpi-icon ${c.tone}`}>{c.icon}</span>
            <div className="bl-kpi-body">
              <span className="bl-kpi-label">{c.label}</span>
              <strong>{c.value}</strong>
              <small>{c.hint}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="bl-toolbar">
        <div className="bl-seg" role="group" aria-label="Billing view">
          <button type="button" className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>
            Payments
          </button>
          <button type="button" className={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>
            Expenses
          </button>
        </div>
        <div className="bl-toolbar-right">
          <label className="bl-month">
            <span>Month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">All months</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          {tab === 'expenses' && (
            <button type="button" className="bl-primary" onClick={() => setExpenseOpen(true)}>
              <Plus size={14} weight="bold" /> Add Expense
            </button>
          )}
        </div>
      </div>

      {tab === 'payments' ? (
        <section className="bl-card">
          <div className="bl-card-head">
            <div>
              <h3>Patient payments</h3>
              <p>
                Chairside payments recorded against procedures — insurance deductions shown per payment.
              </p>
            </div>
            <div className="bl-sum-chips">
              <span className="bl-chip-tall">Patient {currency(paymentsTotals.patient)}</span>
              <span className="bl-chip-tall bl-chip-blue">Insurance {currency(paymentsTotals.insurance)}</span>
              <strong className="bl-chip-total">{currency(paymentsTotals.total)}</strong>
            </div>
          </div>
          {loading ? (
            <div className="bl-empty">Loading payments…</div>
          ) : filteredPayments.length === 0 ? (
            <div className="bl-empty">No payments match the current filters.</div>
          ) : (
            <div className="bl-table-wrap">
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Patient</th>
                    <th>Procedure</th>
                    <th>Fee</th>
                    <th>Paid</th>
                    <th>Insurance</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="bl-muted">{dateShort(p.date)}</td>
                      <td>
                        <strong className="bl-patient">{p.patient.name}</strong>
                      </td>
                      <td>{p.procedureName}</td>
                      <td>{currency(p.procedureFee)}</td>
                      <td className="bl-num bl-green">{p.amountPaid > 0 ? currency(p.amountPaid) : '—'}</td>
                      <td className="bl-num bl-blue">{p.insuranceAmount > 0 ? currency(p.insuranceAmount) : '—'}</td>
                      <td>
                        <span className="bl-method">{METHODS.find((m) => m.value === p.method)?.label ?? p.method}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="bl-card">
          <div className="bl-card-head">
            <div>
              <h3>Expense ledger</h3>
              <p>Clinic overhead — wages, lab work, materials, rent, taxes and equipment.</p>
            </div>
            <div className="bl-sum-chips">
              <strong className="bl-chip-total">{currency(expensesTotals.total)}</strong>
            </div>
          </div>
          <div className="bl-cat-filters">
            <button type="button" className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>
              All
            </button>
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? 'on' : ''}
                onClick={() => setCategory((cur) => (cur === c ? 'all' : c))}
              >
                {c}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="bl-empty">Loading expenses…</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="bl-empty">No expenses match the current filters.</div>
          ) : (
            <div className="bl-table-wrap">
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Paid to</th>
                    <th className="bl-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id}>
                      <td className="bl-muted">{dateShort(e.date)}</td>
                      <td>
                        <span className={`bl-cat ${CATEGORY_TONE[e.category]}`}>{e.category}</span>
                      </td>
                      <td>{e.description}</td>
                      <td className="bl-muted">{e.paidTo || '—'}</td>
                      <td className="bl-num bl-red">{currency(e.amount)}</td>
                      <td className="bl-right">
                        <button
                          type="button"
                          className="bl-icon-btn"
                          title="Delete expense"
                          onClick={() => {
                            if (!window.confirm(`Delete "${e.description}"?`)) return
                            api
                              .deleteExpense(e.id)
                              .then(() => {
                                toast.push('Expense deleted')
                                return load()
                              })
                              .catch((err) =>
                                toast.push(err instanceof Error ? err.message : 'Failed to delete', { tone: 'danger' }),
                              )
                          }}
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {expenseOpen && (
        <ExpenseModal
          onClose={() => setExpenseOpen(false)}
          onSaved={async (payload) => {
            try {
              await api.createExpense(payload)
              toast.push('Expense recorded')
              setExpenseOpen(false)
              await load()
            } catch (err) {
              toast.push(err instanceof Error ? err.message : 'Failed to record expense', { tone: 'danger' })
            }
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add expense modal
// ---------------------------------------------------------------------------

interface ExpensePayload {
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  paidTo: string
  notes: string
}

function ExpenseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (payload: ExpensePayload) => Promise<void>
}) {
  const [category, setCategory] = useState<ExpenseCategory>('Materials')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidTo, setPaidTo] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const amountNum = Number(amount) || 0
  const invalid = !description.trim() || amountNum <= 0

  const handleSave = async () => {
    if (invalid) {
      toast.push('Description and a positive amount are required', { tone: 'warning' })
      return
    }
    setSaving(true)
    try {
      await onSaved({ category, description: description.trim(), amount: amountNum, date, paidTo, notes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add expense" subtitle="Record clinic overhead" size="sm">
      <div className="patient-form">
        <label className="pf-field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span>Amount ($)</span>
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <label className="pf-field pf-full">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Composite restock" />
        </label>
        <label className="pf-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="pf-field">
          <span>Paid to</span>
          <input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Supplier / vendor" />
        </label>
        <label className="pf-field pf-full">
          <span>Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </label>
      </div>
      <div className="patient-form-actions">
        <button type="button" className="pf-btn pf-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="pf-btn pf-save" onClick={() => void handleSave()} disabled={saving || invalid}>
          <Plus size={13} weight="bold" /> Record expense
        </button>
      </div>
    </Modal>
  )
}

export default Billing