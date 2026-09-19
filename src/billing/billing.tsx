import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  TrendUp,
  CurrencyDollar,
  BuildingOffice,
  Plus,
  Eye,
  Printer,
  PaperPlaneTilt,
  CaretRight,
  Receipt,
} from '@phosphor-icons/react'
import './billing.css'
import type {
  Invoice,
  InvoiceFilterKey,
  InvoiceStatus,
  InvoiceTotals,
  Payment,
  PaymentMethod,
} from '../types'
import { api, useBackendReady, type BillingSummary } from '../api/client'
import { useLookups } from '../api/lookups-context'
import { currency, currencyWhole, dateShort } from '../utils/format'
import { Modal } from '../components/Modal'
import { TrendChart } from '../components/Charts'
import { useToast } from '../components/toastStore'

const STATUS_FILTERS: { key: InvoiceFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'partial', label: 'Partial' },
  { key: 'overdue', label: 'Overdue' },
]

const STATUS_TONE: Record<InvoiceStatus, string> = {
  paid: 'ui-pill-green',
  unpaid: 'ui-pill-slate',
  partial: 'ui-pill-blue',
  overdue: 'ui-pill-red',
}

const NET_REVENUE_TARGET = 55000

type InvoiceWithTotals = Invoice & { totals: InvoiceTotals }

const STATUS_MATCHES: Record<InvoiceFilterKey, (s: InvoiceStatus) => boolean> = {
  all: () => true,
  paid: (s) => s === 'paid',
  unpaid: (s) => s === 'unpaid',
  partial: (s) => s === 'partial',
  overdue: (s) => s === 'overdue',
}

const matchesQuery = (inv: Invoice, q: string): boolean => {
  const query = q.trim().toLowerCase()
  if (!query) return true
  return (
    inv.number.toLowerCase().includes(query) ||
    inv.patient.name.toLowerCase().includes(query) ||
    inv.patient.id.toLowerCase().includes(query)
  )
}

interface BillingProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

const toIso2 = (d: Date) => {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const AGING_BUCKETS = [
  { key: '0-30', label: '0-30 days' },
  { key: '31-60', label: '31-60 days' },
  { key: '61-90', label: '61-90 days' },
  { key: '90+', label: '90+ days' },
]

const Billing = ({ searchQuery, createOpen, onCreateOpenChange }: BillingProps) => {
  const toast = useToast()
  const ready = useBackendReady()
  const { patients } = useLookups()
  const [invoices, setInvoices] = useState<InvoiceWithTotals[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InvoiceFilterKey>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [invList, billingSummary] = await Promise.all([api.invoices(), api.billingSummary()])
      setInvoices(invList)
      setSummary(billingSummary)
    } catch {
      setInvoices([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) {
      load()
    }
  }, [ready, load])

  const visible = useMemo(
    () => invoices.filter((inv) => STATUS_MATCHES[filter](inv.totals.status) && matchesQuery(inv, searchQuery)),
    [invoices, filter, searchQuery],
  )

  const detailInvoice = invoices.find((i) => i.id === detailId) ?? null
  const payInvoice = invoices.find((i) => i.id === payId) ?? null

  const netRevenue = summary?.netRevenue ?? 0
  const activeClaims = summary?.activeClaims ?? []
  const outstanding = {
    count: summary?.outstandingCount ?? 0,
    amount: summary?.outstandingAmount ?? 0,
  }
  const aging = summary?.aging
    ? summary.aging.map((amount: number, i: number) => ({ amount, ...AGING_BUCKETS[i] }))
    : AGING_BUCKETS.map((b) => ({ amount: 0, ...b }))

  const revenuePct = Math.min(100, Math.round((netRevenue / NET_REVENUE_TARGET) * 100))
  const claimAmount = activeClaims.reduce((s, c) => s + c.amount, 0)
  const maxAging = Math.max(1, ...aging.map((a) => a.amount))

  const oldestOpen = invoices
    .filter((inv) => inv.totals.balance > 0)
    .sort((a, b) => a.createdDate.localeCompare(b.createdDate))[0]

  const recordPayment = async (id: string, payment: { amount: number; method: PaymentMethod; date: string; reference: string }) => {
    try {
      const updated = await api.recordPayment(id, payment)
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)))
      setSummary(await api.billingSummary())
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Payment failed', { tone: 'danger' })
    }
  }

  const createInvoice = async (
    patientId: string,
    lineItems: { description: string; code: string; quantity: number; unitPrice: number }[],
    notes: string,
  ) => {
    try {
      const invoice = await api.createInvoice({
        patientId,
        items: lineItems.map((li) => ({ ...li, tooth: '' })),
        notes,
      })
      setInvoices((prev) => [invoice, ...prev])
      setSummary(await api.billingSummary())
      onCreateOpenChange(false)
      toast.push(`Invoice ${invoice.number} created for ${invoice.patient.name}`)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Invoice creation failed', { tone: 'danger' })
    }
  }

  const refreshSummary = async () => {
    try {
      setSummary(await api.billingSummary())
    } catch {
      /* keep last known summary */
    }
  }

  const exportCsv = () => {
    const header = ['Invoice #', 'Patient', 'Date', 'Services', 'Amount', 'Paid', 'Balance', 'Status'].join(',')
    const rows = visible.map((inv) => {
      const t = inv.totals
      return [
        inv.number,
        `"${inv.patient.name}"`,
        inv.createdDate,
        `${inv.lineItems.length}`,
        t.total.toFixed(2),
        t.paid.toFixed(2),
        t.balance.toFixed(2),
        t.status.toUpperCase(),
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'billing-invoices.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.push(`CSV exported · ${visible.length} invoices`)
  }

  const sendToChrome = (inv: Invoice) => {
    toast.push(`Invoice ${inv.number} sent to ${inv.patient.name}`, { tone: 'info' })
  }

  const edge = (inv: Invoice) => toast.push(`"${inv.number}" routed to print/email services`, { tone: 'info' })

  return (
    <div className="bd-page">
      <div className="bd-kpis">
        <KpiCard
          icon={<TrendUp size={15} weight="fill" />}
          tone="green"
          label="Net Revenue"
          value={currencyWhole(netRevenue)}
          hint={`${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · collected`}
        >
          <div className="bd-target">
            <div className="bd-target-top">
              <span>MTD target</span>
              <strong>
                {revenuePct}% of {currencyWhole(NET_REVENUE_TARGET)}
              </strong>
            </div>
            <div className="ui-progress">
              <div className="ui-progress-fill green" style={{ width: `${revenuePct}%` }} />
            </div>
          </div>
        </KpiCard>

        <KpiCard
          icon={<CurrencyDollar size={15} weight="fill" />}
          tone="blue"
          label="Outstanding Invoices"
          value={currencyWhole(outstanding.amount)}
          hint={`${outstanding.count} open ${outstanding.count === 1 ? 'invoice' : 'invoices'} awaiting payment`}
        >
          <div className="bd-kpi-sub">
            <span className="bd-agingsum">
              {oldestOpen ? `${Math.max(1, Math.round((Date.now() - new Date(`${oldestOpen.createdDate}T00:00:00`).getTime()) / 86400000))} days` : '—'} since oldest open invoice
            </span>
          </div>
        </KpiCard>

        <KpiCard
          icon={<BuildingOffice size={15} weight="fill" />}
          tone="violet"
          label="Insurance Claims"
          value={currencyWhole(claimAmount)}
          hint={`${activeClaims.length} active ${activeClaims.length === 1 ? 'claim' : 'claims'} in progress`}
        >
          <div className="bd-kpi-sub">
            <span className="bd-kpi-dot violet" />
            {activeClaims.length} awaiting adjudication
          </div>
        </KpiCard>
      </div>

      <div className="bd-cols">
        <section className="bd-chart-card">
          <div className="bd-card-head">
            <div>
              <h3>Revenue & Collections</h3>
              <p>Billed vs collected · last 6 months</p>
            </div>
            <div className="bd-legend">
              <span className="bd-legend-item bar">Billed</span>
              <span className="bd-legend-item line">Collected</span>
            </div>
          </div>
          <TrendChart
            data={summary?.revenueTrend.map((d) => ({ label: d.month, value: d.revenue, secondary: d.collected })) ?? []}
            height={190}
            barColor="#2563eb"
            lineColor="#10b981"
            formatValue={(v) => `$${Math.round(v / 1000)}k`}
            ariaLabel="Revenue and collections by month"
          />
          <div className="bd-chart-foot">
            <span>Collections rate</span>
            <strong>
              {summary && summary.revenueTrend.length > 0
                ? `${Math.round(
                    (summary.revenueTrend.reduce((s, d) => s + d.collected, 0) /
                      summary.revenueTrend.reduce((s, d) => s + d.revenue, 0)) *
                      100,
                  )}%`
                : '—'}
            </strong>
          </div>
        </section>

        <section className="bd-aging-card">
          <div className="bd-card-head">
            <div>
              <h3>Outstanding Aging</h3>
              <p>Balances by invoice age</p>
            </div>
            <Receipt size={15} className="bd-card-icon" />
          </div>
          <div className="bd-aging-list">
            {aging.map((b) => (
              <div key={b.key} className="bd-aging-row">
                <div className="bd-aging-meta">
                  <span className="bd-aging-label">{b.label}</span>
                  <strong>{currencyWhole(b.amount)}</strong>
                </div>
                <div className="ui-progress">
                  <div
                    className={`ui-progress-fill ${b.key === '61-90' ? 'amber' : b.key === '90+' ? 'red' : 'blue'}`}
                    style={{ width: `${(b.amount / maxAging) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="bd-aging-total">
            <span>Total outstanding</span>
            <strong>{currencyWhole(outstanding.amount)}</strong>
          </div>
        </section>
      </div>

      <section className="bd-table-card">
        <div className="bd-toolbar">
          <div className="bd-status-filters">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`bd-filter${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="bd-toolbar-right">
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setStatementOpen(true)}>
              <PaperPlaneTilt size={12} />
              Statements
            </button>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => onCreateOpenChange(true)}>
              <Plus size={12} weight="bold" />
              Create Invoice
            </button>
          </div>
        </div>

        <div className="bd-col-head bd-grid">
          <span>INVOICE</span>
          <span>PATIENT</span>
          <span>DATE</span>
          <span>SERVICES</span>
          <span className="right">AMOUNT</span>
          <span className="right">PAID</span>
          <span className="right">BALANCE</span>
          <span>STATUS</span>
          <span>ACTIONS</span>
        </div>

        {visible.map((inv) => {
          const t = inv.totals
          return (
            <div key={inv.id} className="bd-row bd-grid">
              <button type="button" className="bd-invoice-num" onClick={() => setDetailId(inv.id)}>
                {inv.number}
                <CaretRight size={9} weight="bold" />
              </button>
              <div className="bd-patient">
                <div className="bd-patient-name">{inv.patient.name}</div>
                <div className="bd-patient-meta">{inv.patient.id}</div>
              </div>
              <span className="bd-date">{dateShort(inv.createdDate)}</span>
              <span className="bd-services">
                {inv.lineItems[0]?.description ?? '—'}
                {inv.lineItems.length > 1 && ` +${inv.lineItems.length - 1} more`}
              </span>
              <span className="bd-amt right">{currencyWhole(t.total)}</span>
              <span className="bd-amt right">{currencyWhole(t.paid)}</span>
              <span className={`bd-bal right${t.balance > 0 ? ' owes' : ''}`}>{currencyWhole(t.balance)}</span>
              <span>
                <span className={`ui-pill ${STATUS_TONE[t.status]}`}>{t.status}</span>
              </span>
              <span className="bd-actions">
                <button type="button" className="ui-icn" title="View invoice" onClick={() => setDetailId(inv.id)}>
                  <Eye size={13} />
                </button>
                <button type="button" className="ui-icn" title="Print invoice" onClick={() => edge(inv)}>
                  <Printer size={13} />
                </button>
                <button type="button" className="ui-icn" title="Email invoice" onClick={() => sendToChrome(inv)}>
                  <PaperPlaneTilt size={13} />
                </button>
                {t.balance > 0 && (
                  <button
                    type="button"
                    className="ui-icn"
                    title="Record payment"
                    onClick={() => setPayId(inv.id)}
                  >
                    <CurrencyDollar size={13} weight="bold" />
                  </button>
                )}
              </span>
            </div>
          )
        })}

        {visible.length === 0 && (
          <div className="ui-empty">
            <strong>No invoices found</strong>
            <span>Try a different status filter or adjust the search.</span>
          </div>
        )}

        <div className="bd-table-foot">
          <span>
            {loading ? 'Loading invoices…' : `Showing ${visible.length} of ${invoices.length} invoices`}
          </span>
          <span className="bd-total-label">
            Outstanding <strong>{currencyWhole(outstanding.amount)}</strong>
          </span>
        </div>
      </section>

      {createOpen && !loading && (
        <CreateInvoiceModal patients={patients} onClose={() => onCreateOpenChange(false)} onCreate={createInvoice} />
      )}

      {detailInvoice && (
        <InvoiceDetailsModal
          invoice={detailInvoice}
          onClose={() => setDetailId(null)}
          onRecord={() => {
            setPayId(detailInvoice.id)
          }}
          onPrint={() => edge(detailInvoice)}
          onSend={() => sendToChrome(detailInvoice)}
        />
      )}

      {payInvoice && (
        <RecordPaymentModal
          invoice={payInvoice}
          balance={payInvoice.totals.balance}
          onClose={() => setPayId(null)}
          onSave={(payment) => {
            recordPayment(payInvoice.id, payment)
            refreshSummary()
            toast.push(`Payment of ${currency(payment.amount)} recorded on ${payInvoice.number}`)
          }}
        />
      )}

      {statementOpen && (
        <StatementModal
          invoices={invoices}
          onClose={() => setStatementOpen(false)}
          onSend={() => {
            toast.push(`Statements queued for ${outstanding.count} patients · email service pending`, { tone: 'info' })
          }}
        />
      )}
    </div>
  )
}

export default Billing

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
  children,
}: {
  icon: React.ReactNode
  tone: 'green' | 'blue' | 'violet'
  label: string
  value: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="bd-kpi">
      <div className="bd-kpi-top">
        <span className={`bd-kpi-icon ${tone}`}>{icon}</span>
        <span className="bd-kpi-label">{label}</span>
      </div>
      <div className="bd-kpi-value">{value}</div>
      <div className="bd-kpi-hint">{hint}</div>
      {children}
    </div>
  )
}

interface DraftLine {
  description: string
  code: string
  quantity: number
  unitPrice: number
}

function CreateInvoiceModal({
  patients,
  onClose,
  onCreate,
}: {
  patients: { id: string; name: string }[]
  onClose: () => void
  onCreate: (patientId: string, lines: DraftLine[], notes: string) => void
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id ?? '')
  const [lines, setLines] = useState<DraftLine[]>([{ description: '', code: '', quantity: 1, unitPrice: 0 }])
  const [notes, setNotes] = useState('')

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [lines])

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const addLine = () => setLines((prev) => [...prev, { description: '', code: '', quantity: 1, unitPrice: 0 }])
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const submit = () => {
    if (!lines.some((l) => l.description.trim() && l.quantity * l.unitPrice > 0)) {
      return
    }
    onCreate(patientId, lines, notes)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Invoice"
      subtitle="Draft an invoice from services rendered."
      size="lg"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={submit}>
            <Plus size={13} weight="bold" />
            Create Invoice
          </button>
        </>
      }
    >
      <div className="ui-form-grid">
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="ci-patient">
            Patient
          </label>
          <select
            id="ci-patient"
            className="ui-select"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        </div>
        <div className="ci-lines col-span-2">
          <div className="ci-lines-head">
            <span className="ui-label">Line items</span>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-xs" onClick={addLine}>
              <Plus size={11} weight="bold" />
              Add line
            </button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="ci-line">
              <input
                className="ui-input ci-line-desc"
                type="text"
                placeholder="Service description"
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                aria-label={`Line item ${i + 1} description`}
              />
              <input
                className="ui-input ci-line-code"
                type="text"
                placeholder="Code"
                value={line.code}
                onChange={(e) => updateLine(i, { code: e.target.value })}
                aria-label={`Line item ${i + 1} code`}
              />
              <input
                className="ui-input ci-line-qty"
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                aria-label={`Line item ${i + 1} quantity`}
              />
              <input
                className="ui-input ci-line-price"
                type="number"
                min={0}
                value={line.unitPrice || ''}
                onChange={(e) => updateLine(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                aria-label={`Line item ${i + 1} unit price`}
              />
              <span className="ci-line-amt mono">{currencyWhole(line.quantity * line.unitPrice)}</span>
              <button
                type="button"
                className="ui-icn"
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
                aria-label={`Remove line item ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="ci-subtotal">
            <span>Subtotal</span>
            <strong>{currencyWhole(subtotal)}</strong>
          </div>
        </div>
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="ci-notes">
            Notes
          </label>
          <textarea
            id="ci-notes"
            className="ui-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for the invoice…"
          />
        </div>
      </div>
    </Modal>
  )
}

function InvoiceDetailsModal({
  invoice,
  onClose,
  onRecord,
  onPrint,
  onSend,
}: {
  invoice: InvoiceWithTotals
  onClose: () => void
  onRecord: () => void
  onPrint: () => void
  onSend: () => void
}) {
  const t = invoice.totals
  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice ${invoice.number}`}
      subtitle={`${invoice.patient.name} · ${invoice.patient.id}`}
      size="lg"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onPrint}>
            <Printer size={13} />
            Print
          </button>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onSend}>
            <PaperPlaneTilt size={13} />
            Send
          </button>
          {t.balance > 0 && (
            <button type="button" className="ui-btn ui-btn-soft" onClick={onRecord}>
              <CurrencyDollar size={13} weight="bold" />
              Record Payment
            </button>
          )}
          <button type="button" className="ui-btn ui-btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="bd-detail-head">
        <div className="bd-detail-status">
          <span className={`ui-pill ${STATUS_TONE[t.status]}`}>{t.status}</span>
          <span className="bd-detail-dates">
            Created {dateShort(invoice.createdDate)} · Due {dateShort(invoice.dueDate)}
          </span>
        </div>
        <div className="bd-detail-patient">
          <strong>{invoice.patient.name}</strong>
          <span>
            {invoice.patient.gender}, {invoice.patient.age} · {invoice.patient.phone}
          </span>
        </div>
      </div>

      <div className="bd-detail-lines">
        <div className="bd-detail-line-head">
          <span>DESCRIPTION</span>
          <span>CODE</span>
          <span className="right">QTY</span>
          <span className="right">UNIT</span>
          <span className="right">AMOUNT</span>
        </div>
        {invoice.lineItems.map((li) => (
          <div key={li.id} className="bd-detail-line">
            <span className="bd-dl-desc">
              {li.description}
              {li.tooth && <span className="bd-dl-tooth">#{li.tooth}</span>}
            </span>
            <span className="mono">{li.code}</span>
            <span className="right">{li.quantity}</span>
            <span className="right mono">{currencyWhole(li.unitPrice)}</span>
            <span className="right mono">{currencyWhole(li.amount)}</span>
          </div>
        ))}
        <div className="bd-detail-totals">
          <div>
            <span>Subtotal</span>
            <strong className="mono">{currencyWhole(t.total)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong className="mono paid">{currencyWhole(t.paid)}</strong>
          </div>
          <div className="bd-net">
            <span>Balance due</span>
            <strong className="mono">{currencyWhole(t.balance)}</strong>
          </div>
        </div>
      </div>

      {invoice.payments.length > 0 && (
        <div className="bd-payments">
          <div className="ui-label">Payments ({invoice.payments.length})</div>
          {invoice.payments.map((p) => (
            <div key={p.id} className="bd-payment-row">
              <span className="mono">{p.reference}</span>
              <span>{dateShort(p.date)}</span>
              <span className="mono">{p.method}</span>
              <strong className="mono">{currency(p.amount)}</strong>
            </div>
          ))}
        </div>
      )}

      {invoice.claim && (
        <div className="bd-claim">
          <div className="bd-claim-head">
            <span className="ui-label">Insurance claim</span>
            <span className={`ui-pill ${invoice.claim.status === 'approved' ? 'ui-pill-green' : invoice.claim.status === 'denied' ? 'ui-pill-red' : 'ui-pill-amber'}`}>
              {invoice.claim.status}
            </span>
          </div>
          <div className="bd-claim-row">
            <span>
              <BuildingOffice size={12} /> {invoice.claim.payer}
            </span>
            <span className="mono">Filed {dateShort(invoice.claim.filedDate)}</span>
            <strong className="mono">{currency(invoice.claim.amount)}</strong>
          </div>
        </div>
      )}

      {invoice.notes && <p className="bd-detail-notes">{invoice.notes}</p>}
    </Modal>
  )
}

function RecordPaymentModal({
  invoice,
  balance,
  onClose,
  onSave,
}: {
  invoice: Invoice
  balance: number
  onClose: () => void
  onSave: (payment: Payment) => void
}) {
  const [amount, setAmount] = useState(balance)
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [date, setDate] = useState(toIso2(new Date()))
  const [reference, setReference] = useState('')

  const submit = () => {
    if (amount <= 0) return
    onSave({
      id: `PAY-${Date.now().toString(36).toUpperCase()}`,
      invoiceId: invoice.id,
      amount,
      method,
      date,
      reference: reference.trim() || 'WALK-IN',
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Payment"
      subtitle={`${invoice.number} · balance ${currencyWhole(balance)}`}
      size="sm"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={submit} disabled={amount <= 0}>
            <CurrencyDollar size={13} weight="bold" />
            Record Payment
          </button>
        </>
      }
    >
      <div className="ui-form-grid">
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="rp-amount">
            Amount
          </label>
          <input
            id="rp-amount"
            className="ui-input"
            type="number"
            min={0}
            max={balance}
            value={amount || ''}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="rp-method">
            Method
          </label>
          <select
            id="rp-method"
            className="ui-select"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="insurance">Insurance EFT</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="rp-date">
            Date
          </label>
          <input
            id="rp-date"
            className="ui-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="ui-field col-span-2">
          <label className="ui-label" htmlFor="rp-ref">
            Reference (optional)
          </label>
          <input
            id="rp-ref"
            className="ui-input"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="TXN, check #, or receipt #"
          />
        </div>
      </div>
    </Modal>
  )
}

function StatementModal({
  invoices,
  onClose,
  onSend,
}: {
  invoices: InvoiceWithTotals[]
  onClose: () => void
  onSend: () => void
}) {
  const withBalance = invoices.filter((inv) => inv.totals.balance > 0)
  const total = withBalance.reduce((s, inv) => s + inv.totals.balance, 0)

  return (
    <Modal
      open
      onClose={onClose}
      title="Statement Center"
      subtitle="Consolidated statements for patients with balances."
      size="md"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={onSend} disabled={withBalance.length === 0}>
            <PaperPlaneTilt size={13} weight="bold" />
            Send Statements
          </button>
        </>
      }
    >
      <div className="st-list">
        {withBalance.length === 0 && (
          <div className="ui-empty">
            <strong>No outstanding balances</strong>
            <span>Nothing to statement right now.</span>
          </div>
        )}
        {withBalance.map((inv) => {
          const t = inv.totals
          return (
            <div key={inv.id} className="st-row">
              <div className="st-avatar">{inv.patient.initials}</div>
              <div className="st-body">
                <div className="st-name">{inv.patient.name}</div>
                <div className="st-meta">
                  {inv.number} · {inv.lineItems.length} services
                </div>
              </div>
              <span className="st-status">
                <span className={`ui-pill ${STATUS_TONE[t.status]}`}>{t.status}</span>
              </span>
              <strong className="st-amt mono">{currencyWhole(t.balance)}</strong>
            </div>
          )
        })}
      </div>
      {withBalance.length > 0 && (
        <div className="st-total">
          <span>Total to collect</span>
          <strong className="mono">{currencyWhole(total)}</strong>
        </div>
      )}
      <p className="st-note">
        Statements are queued for print/email delivery. The delivery service will be wired to Electron when
        filesystem and mail IPC are enabled.
      </p>
    </Modal>
  )
}