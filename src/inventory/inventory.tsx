import { useMemo, useState } from 'react'
import {
  ArrowClockwise,
  Plus,
  Minus,
  Warning,
  Package,
  Truck,
  CurrencyDollar,
  Eye,
  SlidersHorizontal,
  MapPin,
  CaretRight,
} from '@phosphor-icons/react'
import './inventory.css'
import type {
  InventoryItem,
  InventoryTransaction,
  InventoryCategory,
  InventoryStatus,
  CategoryFilterKey,
  SupplierOrder,
} from '../types'
import { AS_OF_DATE } from '../data/treatmentData'
import {
  STORAGE_LOCATIONS,
  LOCATION_BY_ID,
  INITIAL_INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_ORDERS,
  USAGE_TREND,
  CATEGORIES,
  inventoryStatus,
  ITEM_STATUS_LABEL,
} from '../data/inventoryData'
import { currency, currencyWhole, dateShort } from '../utils/format'
import { Modal } from '../components/Modal'
import { MiniBars } from '../components/Charts'
import { useToast } from '../components/toastStore'

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`

const IT_STATUS_TONE: Record<InventoryStatus, string> = {
  in_stock: 'ui-pill-green',
  low_stock: 'ui-pill-amber',
  out_of_stock: 'ui-pill-red',
}

const ORDER_STATUS_TONE: Record<SupplierOrder['status'], string> = {
  pending: 'ui-pill-amber',
  approved: 'ui-pill-blue',
  shipped: 'ui-pill-violet',
  received: 'ui-pill-green',
  delayed: 'ui-pill-red',
}

const ORDER_STATUS_LABEL: Record<SupplierOrder['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  shipped: 'Shipped',
  received: 'Received',
  delayed: 'Delayed',
}

const matchesQuery = (item: InventoryItem, q: string): boolean => {
  const query = q.trim().toLowerCase()
  if (!query) return true
  return (
    item.name.toLowerCase().includes(query) ||
    item.brand.toLowerCase().includes(query) ||
    item.sku.toLowerCase().includes(query) ||
    item.id.toLowerCase().includes(query) ||
    item.category.toLowerCase().includes(query)
  )
}

const stockPercent = (item: InventoryItem): number =>
  Math.min(100, Math.round((item.quantityOnHand / Math.max(1, item.minimumThreshold * 2)) * 100))

const barColor = (status: InventoryStatus): string =>
  status === 'in_stock' ? '#059669' : status === 'low_stock' ? '#d97706' : '#ef4444'

const UNITS = ['box', 'syringe', 'cartridge', 'pack', 'set', 'each', 'can', 'bag']

interface InventoryProps {
  searchQuery: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

const Inventory = ({ searchQuery, createOpen, onCreateOpenChange }: InventoryProps) => {
  const toast = useToast()
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY)
  const [orders, setOrders] = useState<SupplierOrder[]>(INITIAL_ORDERS)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(INITIAL_TRANSACTIONS)
  const [category, setCategory] = useState<CategoryFilterKey>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)

  const detailItem = useMemo(
    () => items.find((i) => i.id === detailId) ?? null,
    [items, detailId],
  )

  const filtered = useMemo(
    () =>
      items.filter(
        (it) => (category === 'all' || it.category === category) && matchesQuery(it, searchQuery),
      ),
    [items, category, searchQuery],
  )

  const lowItems = useMemo(
    () => items.filter((it) => inventoryStatus(it.quantityOnHand, it.minimumThreshold) !== 'in_stock'),
    [items],
  )

  const openOrders = useMemo(() => orders.filter((o) => o.status !== 'received'), [orders])
  const openOrderTotal = useMemo(
    () => openOrders.reduce((sum, o) => sum + o.totalCost, 0),
    [openOrders],
  )

  const totalValue = useMemo(
    () => items.reduce((sum, it) => sum + it.quantityOnHand * it.costPerUnit, 0),
    [items],
  )

  const detailTransactions = useMemo(
    () => transactions.filter((t) => t.itemId === detailId),
    [transactions, detailId],
  )

  const pushTransaction = (txn: InventoryTransaction) => {
    setTransactions((prev) => [txn, ...prev])
  }

  const applyAdjustment = (
    item: InventoryItem,
    delta: number,
    reason: string,
    performedBy: string,
  ) => {
    if (delta === 0) {
      toast.push('Adjustment amount must not be zero', { tone: 'warning' })
      return
    }
    const next = Math.max(0, item.quantityOnHand + delta)
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantityOnHand: next } : i)),
    )
    pushTransaction({
      id: uid('TX'),
      itemId: item.id,
      type: delta > 0 ? 'inbound' : 'outbound',
      quantity: Math.abs(delta),
      date: AS_OF_DATE,
      reason,
      performedBy,
    })
    toast.push(
      `${item.name} adjusted to ${next} ${item.unit}(s)${delta < 0 ? ' (usage)' : ' (restock)'}`,
    )
  }

  const handleQuickAdjust = (item: InventoryItem, delta: number) => {
    applyAdjustment(
      item,
      delta,
      delta < 0 ? 'Clinic usage' : 'Manual restock',
      'Maya Gomez',
    )
  }

  const handleOrderNow = (item: InventoryItem) => {
    const orderId = uid('PO')
    const line = {
      itemId: item.id,
      itemName: item.name,
      quantity: item.reorderQuantity,
      unitCost: item.costPerUnit,
    }
    const order: SupplierOrder = {
      id: orderId,
      supplier: 'Henry Schein Dental',
      lines: [line],
      totalCost: line.quantity * line.unitCost,
      placedDate: AS_OF_DATE,
      estimatedArrival: '2026-06-02',
      status: 'pending',
    }
    setOrders((prev) => [order, ...prev])
    toast.push(
      `Order ${orderId} placed · ${line.quantity} ${item.unit}(s) of ${item.name} from ${order.supplier}`,
    )
  }

  const handleAutoRestock = () => {
    if (lowItems.length === 0) {
      toast.push('No items below reorder point')
      return
    }
    const orderId = uid('PO')
    const lines = lowItems.map((it) => ({
      itemId: it.id,
      itemName: it.name,
      quantity: it.reorderQuantity,
      unitCost: it.costPerUnit,
    }))
    const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)
    const order: SupplierOrder = {
      id: orderId,
      supplier: 'Multiple Suppliers',
      lines,
      totalCost: total,
      placedDate: AS_OF_DATE,
      estimatedArrival: '2026-06-02',
      status: 'pending',
    }
    setOrders((prev) => [order, ...prev])
    toast.push(`Restock order ${orderId} placed for ${lines.length} low-stock item(s)`)
  }

  const handleCreateItem = (input: NewItemInput) => {
    if (!input.name.trim()) {
      toast.push('Item name is required', { tone: 'warning' })
      return
    }
    const newItem: InventoryItem = {
      id: uid('SKU'),
      name: input.name.trim(),
      brand: input.brand.trim() || 'General',
      sku: input.sku.trim() || input.name.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 12),
      category: input.category,
      packSize: input.packSize.trim() || 'Each',
      unit: input.unit,
      quantityOnHand: Math.max(0, input.quantity),
      minimumThreshold: Math.max(0, input.minimumThreshold),
      reorderQuantity: Math.max(1, input.reorderQuantity),
      locationId: input.locationId,
      costPerUnit: Math.max(0, input.costPerUnit),
    }
    setItems((prev) => [newItem, ...prev])
    pushTransaction({
      id: uid('TX'),
      itemId: newItem.id,
      type: 'inbound',
      quantity: newItem.quantityOnHand,
      date: AS_OF_DATE,
      reason: 'Initial stock',
      performedBy: 'Maya Gomez',
    })
    onCreateOpenChange(false)
    toast.push(`${newItem.name} added to inventory`)
  }

  return (
    <div className="iv-page">
      {lowItems.length > 0 && (
        <div className="iv-alert">
          <div className="iv-alert-icon">
            <Warning size={17} weight="fill" />
          </div>
          <div className="iv-alert-body">
            <strong>{lowItems.length} item(s) below reorder point</strong>
            <span>{lowItems.map((it) => it.name).join(', ')}</span>
          </div>
          <div className="iv-alert-actions">
            <button type="button" className="ui-btn ui-btn-secondary" onClick={handleAutoRestock}>
              <ArrowClockwise size={13} weight="bold" />
              Auto-Restock All
            </button>
          </div>
        </div>
      )}

      <div className="iv-kpis">
        <div className="iv-kpi">
          <div className="iv-kpi-icon blue">
            <Package size={15} weight="bold" />
          </div>
          <div className="iv-kpi-text">
            <strong>{items.length}</strong>
            <span>SKUs tracked</span>
          </div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-icon amber">
            <Warning size={15} weight="bold" />
          </div>
          <div className="iv-kpi-text">
            <strong>{lowItems.length}</strong>
            <span>Below reorder point</span>
          </div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-icon violet">
            <Truck size={15} weight="bold" />
          </div>
          <div className="iv-kpi-text">
            <strong>{openOrders.length}</strong>
            <span>Open purchase orders</span>
          </div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-icon green">
            <CurrencyDollar size={15} weight="bold" />
          </div>
          <div className="iv-kpi-text">
            <strong>{currencyWhole(totalValue)}</strong>
            <span>Stock value on hand</span>
          </div>
        </div>
      </div>

      <div className="iv-locations">
        {STORAGE_LOCATIONS.map((loc) => {
          const percent = Math.round((loc.used / Math.max(1, loc.capacity)) * 100)
          return (
            <div className="iv-loc" key={loc.id}>
              <div className="iv-loc-head">
                <div className="iv-loc-title">
                  <div className="iv-loc-icon">
                    <MapPin size={14} weight="fill" />
                  </div>
                  <div>
                    <strong>{loc.name}</strong>
                    <span>{loc.description}</span>
                  </div>
                </div>
                <span className="iv-loc-id">{loc.id}</span>
              </div>
              <div className="iv-loc-meta">
                <span>
                  <strong>{loc.used}</strong> / {loc.capacity} slots used
                </span>
                <span className={percent >= 75 ? 'iv-loc-full' : ''}>{percent}%</span>
              </div>
              <div className="iv-loc-track">
                <div className="iv-loc-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="iv-workspace">
        <div className="iv-chart-card">
          <div className="iv-card-head">
            <div>
              <h3>Inventory Usage</h3>
              <p>Stock movements per week · W9 – W16</p>
            </div>
            <div className="iv-chart-summary">
              <strong>+107%</strong>
              <span>vs baseline</span>
            </div>
          </div>
          <MiniBars
            data={USAGE_TREND.map((d) => ({ label: d.week, value: d.usage }))}
            color="#7c3aed"
            height={150}
            formatValue={(v) => `${v}×`}
            ariaLabel="Weekly inventory usage"
          />
        </div>

        <div className="iv-stock-area">
          <div className="iv-toolbar">
            <div className="iv-cat-filters">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`iv-filter${category === c ? ' active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c === 'all' ? 'All Items' : c}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => onCreateOpenChange(true)}
            >
              <Plus size={13} weight="bold" />
              Add Stock
            </button>
          </div>

          <div className="iv-stock-note">
            {category === 'all'
              ? 'All items'
              : category}{' '}
            · {filtered.length} item{filtered.length === 1 ? '' : 's'} displayed
          </div>

          {filtered.length > 0 ? (
            <div className="iv-grid">
              {filtered.map((item) => {
                const status = inventoryStatus(item.quantityOnHand, item.minimumThreshold)
                return (
                  <div className="iv-card" key={item.id}>
                    <div className="iv-card-head">
                      <div className="iv-card-title">
                        <div className="iv-card-img">
                          <Package size={15} weight="fill" />
                        </div>
                        <div className="iv-card-name">
                          <strong>{item.name}</strong>
                          <span>
                            {item.brand} · {item.sku}
                          </span>
                        </div>
                      </div>
                      <span className={`ui-pill ${IT_STATUS_TONE[status]}`}>
                        {ITEM_STATUS_LABEL[status]}
                      </span>
                    </div>

                    <div className="iv-card-meta">
                      <span className="ui-pill ui-pill-slate">{item.category}</span>
                      <span>{item.packSize}</span>
                      <span>{LOCATION_BY_ID.get(item.locationId)?.name ?? item.locationId}</span>
                    </div>

                    <div className="iv-stock">
                      <div className="iv-stock-top">
                        <span>
                          <strong>{item.quantityOnHand}</strong> {item.unit}(s)
                        </span>
                        <span>min {item.minimumThreshold}</span>
                      </div>
                      <div className="iv-track">
                        <div
                          className="iv-fill"
                          style={{ width: `${stockPercent(item)}%`, backgroundColor: barColor(status) }}
                        />
                      </div>
                    </div>

                    <div className="iv-card-foot">
                      <div className="iv-card-price">
                        <strong>{currency(item.costPerUnit)}</strong>
                        <span>/ {item.unit} · est. {currency(item.quantityOnHand * item.costPerUnit)}</span>
                      </div>
                      <div className="iv-card-actions">
                        <button
                          type="button"
                          className="iv-icon-btn"
                          title="Use stock"
                          onClick={() => handleQuickAdjust(item, -1)}
                        >
                          <Minus size={12} weight="bold" />
                        </button>
                        <button
                          type="button"
                          className="iv-icon-btn"
                          title="Restock +1"
                          onClick={() => handleQuickAdjust(item, 1)}
                        >
                          <Plus size={12} weight="bold" />
                        </button>
                        <button
                          type="button"
                          className="iv-icon-btn"
                          title="Logged adjustment"
                          onClick={() => setAdjustItem(item)}
                        >
                          <SlidersHorizontal size={12} weight="bold" />
                        </button>
                        <button
                          type="button"
                          className="iv-icon-btn"
                          title="View usage"
                          onClick={() => setDetailId(item.id)}
                        >
                          <Eye size={12} weight="bold" />
                        </button>
                        <button
                          type="button"
                          className="iv-icon-btn"
                          title="Order now"
                          onClick={() => handleOrderNow(item)}
                        >
                          <Truck size={12} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="ui-empty">
              No items match “{searchQuery}” in {category === 'all' ? 'all categories' : category}.
            </div>
          )}
        </div>
      </div>

      <div className="iv-table-card">
        <div className="iv-toolbar">
          <div className="iv-table-title">
            <h3>Purchase Orders</h3>
            <span>
              {openOrders.length} open · {currencyWhole(openOrderTotal)} committed
            </span>
          </div>
          <button
            type="button"
            className="iv-link-btn"
            onClick={() => {
              if (openOrders.length === 0) {
                toast.push('No open purchase orders')
                return
              }
              toast.push(`Total committed on open orders: ${currency(openOrderTotal)}`)
            }}
          >
            View all <CaretRight size={11} weight="bold" />
          </button>
        </div>
        <div className="iv-tgrid iv-col-head">
          <span>Order</span>
          <span>Supplier</span>
          <span>Items</span>
          <span>Placed</span>
          <span>Est. Arrival</span>
          <span>Status</span>
          <span className="right">Total</span>
        </div>
        {orders.map((o) => (
          <div className="iv-tgrid iv-row" key={o.id}>
            <span className="iv-order-id">{o.id}</span>
            <span className="iv-supplier">{o.supplier}</span>
            <span className="iv-order-items">
              {o.lines.map((l) => `${l.quantity} × ${l.itemName}`).join(', ')}
            </span>
            <span className="iv-date">{dateShort(o.placedDate)}</span>
            <span className="iv-date">{dateShort(o.estimatedArrival)}</span>
            <span>
              <span className={`ui-pill ${ORDER_STATUS_TONE[o.status]}`}>
                {ORDER_STATUS_LABEL[o.status]}
              </span>
            </span>
            <span className="iv-amt right">{currency(o.totalCost)}</span>
          </div>
        ))}
      </div>

      <StockDetailModal
        item={detailItem}
        transactions={detailTransactions}
        onClose={() => setDetailId(null)}
        onOrder={(it) => handleOrderNow(it)}
      />

      <AdjustStockModal
        item={adjustItem}
        onClose={() => setAdjustItem(null)}
        onSave={(delta, reason, performedBy) => {
          if (adjustItem) applyAdjustment(adjustItem, delta, reason, performedBy)
        }}
      />

      <AddStockModal
        open={createOpen}
        onClose={() => onCreateOpenChange(false)}
        onSave={handleCreateItem}
      />
    </div>
  )
}

interface NewItemInput {
  name: string
  brand: string
  sku: string
  category: InventoryCategory
  packSize: string
  unit: string
  quantity: number
  minimumThreshold: number
  reorderQuantity: number
  locationId: string
  costPerUnit: number
}

const AddStockModal = ({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: NewItemInput) => void
}) => {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState<InventoryCategory>('Consumables')
  const [packSize, setPackSize] = useState('')
  const [unit, setUnit] = useState('box')
  const [quantity, setQuantity] = useState(0)
  const [minimumThreshold, setMinimumThreshold] = useState(10)
  const [reorderQuantity, setReorderQuantity] = useState(10)
  const [locationId, setLocationId] = useState(STORAGE_LOCATIONS[0].id)
  const [costPerUnit, setCostPerUnit] = useState(0)

  const save = () => {
    onSave({
      name,
      brand,
      sku,
      category,
      packSize,
      unit,
      quantity,
      minimumThreshold,
      reorderQuantity,
      locationId,
      costPerUnit,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Stock Item"
      subtitle="Register a new product in inventory"
      size="lg"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={save}>
            <Plus size={13} weight="bold" />
            Add Item
          </button>
        </>
      }
    >
      <div className="ui-form-grid">
        <label className="ui-field">
          <span>Item name*</span>
          <input
            className="ui-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Composite Resin A3"
          />
        </label>
        <label className="ui-field">
          <span>Brand</span>
          <input
            className="ui-input"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. 3M Filtek"
          />
        </label>
        <label className="ui-field">
          <span>SKU / Item code</span>
          <input
            className="ui-input"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Auto-generated if empty"
          />
        </label>
        <label className="ui-field">
          <span>Category</span>
          <select
            className="ui-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as InventoryCategory)}
          >
            {(['Consumables', 'Instruments', 'PPE & Hygiene', 'Laboratory'] as InventoryCategory[]).map(
              (c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="ui-field">
          <span>Pack size</span>
          <input
            className="ui-input"
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
            placeholder="e.g. Box · 50"
          />
        </label>
        <label className="ui-field">
          <span>Unit</span>
          <select className="ui-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span>Quantity on hand</span>
          <input
            className="ui-input"
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
        </label>
        <label className="ui-field">
          <span>Reorder point (min)</span>
          <input
            className="ui-input"
            type="number"
            min={0}
            value={minimumThreshold}
            onChange={(e) => setMinimumThreshold(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="ui-field">
          <span>Restock quantity</span>
          <input
            className="ui-input"
            type="number"
            min={1}
            value={reorderQuantity}
            onChange={(e) => setReorderQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="ui-field">
          <span>Storage location</span>
          <select
            className="ui-select"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {STORAGE_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} · {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span>Cost per unit ($)</span>
          <input
            className="ui-input"
            type="number"
            min={0}
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(Number(e.target.value) || 0)}
          />
        </label>
      </div>
    </Modal>
  )
}

const StockDetailModal = ({
  item,
  transactions,
  onClose,
  onOrder,
}: {
  item: InventoryItem | null
  transactions: InventoryTransaction[]
  onClose: () => void
  onOrder: (item: InventoryItem) => void
}) => {
  if (!item) return null
  const status = inventoryStatus(item.quantityOnHand, item.minimumThreshold)
  const percent = stockPercent(item)
  const location = LOCATION_BY_ID.get(item.locationId)

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.name} · ${item.sku}`}
      subtitle={`${item.brand} · ${item.category} · ${item.packSize}`}
      footer={
        <>
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            onClick={() => {
              onOrder(item)
            }}
          >
            <Truck size={13} weight="bold" />
            Order Now
          </button>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="iv-detail-stock">
        <div className="iv-detail-figures">
          <div className="iv-detail-fig">
            <strong>{item.quantityOnHand}</strong>
            <span>{item.unit}(s) on hand</span>
          </div>
          <div className="iv-detail-fig">
            <strong>{item.minimumThreshold}</strong>
            <span>reorder point</span>
          </div>
          <div className="iv-detail-fig">
            <strong>{item.reorderQuantity}</strong>
            <span>restock qty</span>
          </div>
          <div className="iv-detail-fig">
            <strong>{currencyWhole(item.quantityOnHand * item.costPerUnit)}</strong>
            <span>est. value</span>
          </div>
        </div>
        <div className="iv-stock">
          <div className="iv-stock-top">
            <span>
              Stock level · <strong>{ITEM_STATUS_LABEL[status]}</strong>
            </span>
            <span className={`ui-pill ${IT_STATUS_TONE[status]}`}>{ITEM_STATUS_LABEL[status]}</span>
          </div>
          <div className="iv-track">
            <div
              className="iv-fill"
              style={{ width: `${percent}%`, backgroundColor: barColor(status) }}
            />
          </div>
        </div>
        <div className="iv-detail-meta">
          <span>Location: {location ? `${location.name} (${location.id})` : item.locationId}</span>
          <span>Cost per unit: {currency(item.costPerUnit)}</span>
        </div>
      </div>

      <h4 className="iv-subhead">Recent Movement</h4>
      {transactions.length > 0 ? (
        <div className="iv-tx-list">
          {transactions.map((t) => (
            <div className="iv-tx" key={t.id}>
              <span className={`iv-tx-badge ${t.type}`}>
                {t.type === 'inbound' ? '+' : t.type === 'outbound' ? '−' : '±'}
              </span>
              <div className="iv-tx-body">
                <strong>
                  {t.type === 'inbound' ? 'Restocked' : t.type === 'outbound' ? 'Usage' : 'Adjusted'}{' '}
                  · {t.quantity} {item.unit}(s)
                </strong>
                <span>
                  {t.reason} · by {t.performedBy}
                </span>
              </div>
              <span className="iv-date">{dateShort(t.date)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-empty">No recorded movements for this item yet.</div>
      )}
    </Modal>
  )
}

const AdjustStockModal = ({
  item,
  onClose,
  onSave,
}: {
  item: InventoryItem | null
  onClose: () => void
  onSave: (delta: number, reason: string, performedBy: string) => void
}) => {
  const [delta, setDelta] = useState(0)
  const [reason, setReason] = useState('Clinic adjustment')
  const [performedBy, setPerformedBy] = useState('Maya Gomez')

  if (!item) return null
  const next = Math.max(0, item.quantityOnHand + delta)

  const save = () => {
    onSave(delta, reason.trim() || 'Stock adjustment', performedBy.trim() || 'Clinic Staff')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adjust Stock · ${item.name}`}
      subtitle={`${item.sku} · ${currency(item.costPerUnit)} / ${item.unit}`}
      footer={
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={save}>
            Save Adjustment
          </button>
        </>
      }
    >
      <div className="iv-adjust">
        <div className="iv-adjust-stepper">
          <button
            type="button"
            className="iv-icon-btn"
            onClick={() => setDelta((d) => d - 1)}
            aria-label="Decrease by one"
          >
            <Minus size={13} weight="bold" />
          </button>
          <div className="iv-adjust-count">
            <strong>{delta > 0 ? '+' : ''}{delta}</strong>
            <span>qty change</span>
          </div>
          <button
            type="button"
            className="iv-icon-btn"
            onClick={() => setDelta((d) => d + 1)}
            aria-label="Increase by one"
          >
            <Plus size={13} weight="bold" />
          </button>
        </div>
        <div className="iv-adjust-guide">
          <span>Current: {item.quantityOnHand}</span>
          <CaretRight size={12} weight="bold" />
          <strong>New: {next}</strong>
          <strong className="iv-adjust-next">on hand</strong>
        </div>
        <div className="ui-form-grid">
          <label className="ui-field">
            <span>Reason</span>
            <select className="ui-select" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Clinic adjustment</option>
              <option>Clinic usage</option>
              <option>Restock — purchase order</option>
              <option>Damaged / expired</option>
              <option>Physical inventory count</option>
            </select>
          </label>
          <label className="ui-field">
            <span>Performed by</span>
            <input
              className="ui-input"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}

export default Inventory