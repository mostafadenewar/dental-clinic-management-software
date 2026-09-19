import type {
  InventoryItem,
  StorageLocation,
  SupplierOrder,
  InventoryTransaction,
  InventoryCategory,
  InventoryStatus,
} from '../types'

// ---------------------------------------------------------------------------
// Static demo data for Inventory / Stock Management. Replace with a
// repository/service layer backed by SQLite later without touching the UI.
// ---------------------------------------------------------------------------

export const STORAGE_LOCATIONS: StorageLocation[] = [
  { id: 'LOC-01', name: 'Main Cabinet', capacity: 120, used: 82, description: 'Clinical consumables, syringes, burs' },
  { id: 'LOC-02', name: 'Cold Storage', capacity: 48, used: 20, description: 'Anesthetics, composites, materials (4°C)' },
  { id: 'LOC-03', name: 'Instrument Room', capacity: 60, used: 39, description: 'Sterile instruments and trays' },
]

export const LOCATION_BY_ID = new Map(STORAGE_LOCATIONS.map((l) => [l.id, l]))

const item = (data: InventoryItem): InventoryItem => data

export const INITIAL_INVENTORY: InventoryItem[] = [
  item({ id: 'SKU-1001', name: 'Composite Resin A2', brand: '3M Filtek', sku: '3M-5220', category: 'Consumables', packSize: 'Syringe · 4 g', unit: 'syringe', quantityOnHand: 9, minimumThreshold: 12, reorderQuantity: 12, locationId: 'LOC-02', costPerUnit: 42.5 }),
  item({ id: 'SKU-1002', name: 'Dental Floss', brand: 'GUM Butler', sku: 'GUM-441', category: 'Consumables', packSize: 'Box · 12 pcs', unit: 'box', quantityOnHand: 46, minimumThreshold: 15, reorderQuantity: 12, locationId: 'LOC-01', costPerUnit: 8.9 }),
  item({ id: 'SKU-1003', name: 'Impression Tray – Maxillary', brand: 'COE', sku: 'COE-218', category: 'Instruments', packSize: 'Pack · 10', unit: 'pack', quantityOnHand: 8, minimumThreshold: 10, reorderQuantity: 6, locationId: 'LOC-01', costPerUnit: 18.4 }),
  item({ id: 'SKU-1004', name: 'Anesthetic Cartridges 2% Lido', brand: 'Septodont', sku: 'SEP-885', category: 'Consumables', packSize: 'Box · 50', unit: 'box', quantityOnHand: 21, minimumThreshold: 8, reorderQuantity: 10, locationId: 'LOC-02', costPerUnit: 24.9 }),
  item({ id: 'SKU-1005', name: 'Nitrile Exam Gloves (M)', brand: 'Medline', sku: 'MDL-2201', category: 'PPE & Hygiene', packSize: 'Box · 100', unit: 'box', quantityOnHand: 34, minimumThreshold: 10, reorderQuantity: 15, locationId: 'LOC-01', costPerUnit: 12.7 }),
  item({ id: 'SKU-1006', name: 'Surgical Masks – Level 3', brand: 'Halyard', sku: 'HYD-4810', category: 'PPE & Hygiene', packSize: 'Box · 50', unit: 'box', quantityOnHand: 6, minimumThreshold: 12, reorderQuantity: 10, locationId: 'LOC-01', costPerUnit: 9.6 }),
  item({ id: 'SKU-1007', name: 'Sterile Drape Sheets', brand: 'Dynarex', sku: 'DYN-7001', category: 'PPE & Hygiene', packSize: 'Box · 25', unit: 'box', quantityOnHand: 3, minimumThreshold: 8, reorderQuantity: 8, locationId: 'LOC-01', costPerUnit: 15.2 }),
  item({ id: 'SKU-1008', name: 'Polyvinyl Siloxane Impression', brand: 'Kerr', sku: 'KER-2203', category: 'Consumables', packSize: 'Cartridge · 380 ml', unit: 'cartridge', quantityOnHand: 14, minimumThreshold: 6, reorderQuantity: 6, locationId: 'LOC-02', costPerUnit: 33.1 }),
  item({ id: 'SKU-1009', name: 'Hygienist Hand Prophy Angle', brand: 'NSK', sku: 'NSK-75', category: 'Instruments', packSize: 'Each', unit: 'each', quantityOnHand: 6, minimumThreshold: 4, reorderQuantity: 4, locationId: 'LOC-03', costPerUnit: 58.0 }),
  item({ id: 'SKU-1010', name: 'Periodontal Probes', brand: 'Hu-Friedy', sku: 'HUF-1302', category: 'Instruments', packSize: 'Set · 6', unit: 'set', quantityOnHand: 2, minimumThreshold: 4, reorderQuantity: 3, locationId: 'LOC-03', costPerUnit: 76.5 }),
  item({ id: 'SKU-1011', name: 'Alginate Refill', brand: 'GC America', sku: 'GCA-1100', category: 'Laboratory', packSize: 'Can · 453 g', unit: 'can', quantityOnHand: 11, minimumThreshold: 5, reorderQuantity: 6, locationId: 'LOC-01', costPerUnit: 21.3 }),
  item({ id: 'SKU-1012', name: 'Casting Investment', brand: 'Whip Mix', sku: 'WMX-3000', category: 'Laboratory', packSize: 'Box · 12 lb', unit: 'box', quantityOnHand: 7, minimumThreshold: 3, reorderQuantity: 4, locationId: 'LOC-01', costPerUnit: 47.8 }),
  item({ id: 'SKU-1013', name: 'Dental Stone – Die', brand: 'Kerr', sku: 'KER-2900', category: 'Laboratory', packSize: 'Bag · 25 lb', unit: 'bag', quantityOnHand: 5, minimumThreshold: 3, reorderQuantity: 3, locationId: 'LOC-01', costPerUnit: 39.6 }),
  item({ id: 'SKU-1014', name: 'Matrix Bands (Sectional)', brand: 'Garrison', sku: 'GAR-1044', category: 'Consumables', packSize: 'Box · 30', unit: 'box', quantityOnHand: 19, minimumThreshold: 8, reorderQuantity: 6, locationId: 'LOC-01', costPerUnit: 14.2 }),
  item({ id: 'SKU-1015', name: 'Saliva Ejectors', brand: 'Henry Schein', sku: 'HS-3331', category: 'Consumables', packSize: 'Box · 100', unit: 'box', quantityOnHand: 52, minimumThreshold: 20, reorderQuantity: 10, locationId: 'LOC-01', costPerUnit: 6.4 }),
]

const txn = (data: InventoryTransaction): InventoryTransaction => data

export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  txn({ id: 'TX-9001', itemId: 'SKU-1001', type: 'outbound', quantity: 3, date: '2026-05-25', reason: 'Restorative procedures', performedBy: 'Dr. Smith' }),
  txn({ id: 'TX-9002', itemId: 'SKU-1004', type: 'inbound', quantity: 10, date: '2026-05-24', reason: 'Purchase order PO-1182', performedBy: 'Maya Gomez' }),
  txn({ id: 'TX-9003', itemId: 'SKU-1006', type: 'outbound', quantity: 4, date: '2026-05-22', reason: 'Operatories restock', performedBy: 'Nina Reed' }),
  txn({ id: 'TX-9004', itemId: 'SKU-1003', type: 'outbound', quantity: 2, date: '2026-05-20', reason: 'Implant case #19', performedBy: 'Dr. Chen' }),
  txn({ id: 'TX-9005', itemId: 'SKU-1010', type: 'inbound', quantity: 2, date: '2026-05-18', reason: 'Physical inventory return', performedBy: 'Luke Adams' }),
]

export const INITIAL_ORDERS: SupplierOrder[] = [
  {
    id: 'PO-1182',
    supplier: 'Henry Schein Dental',
    lines: [
      { itemId: 'SKU-1004', itemName: 'Anesthetic Cartridges 2% Lido', quantity: 10, unitCost: 24.9 },
      { itemId: 'SKU-1006', itemName: 'Surgical Masks – Level 3', quantity: 10, unitCost: 9.6 },
    ],
    totalCost: 345,
    placedDate: '2026-05-21',
    estimatedArrival: '2026-05-28',
    status: 'shipped',
  },
  {
    id: 'PO-1185',
    supplier: 'Patterson Dental',
    lines: [
      { itemId: 'SKU-1001', itemName: 'Composite Resin A2', quantity: 12, unitCost: 42.5 },
      { itemId: 'SKU-1008', itemName: 'Polyvinyl Siloxane Impression', quantity: 6, unitCost: 33.1 },
    ],
    totalCost: 708.6,
    placedDate: '2026-05-24',
    estimatedArrival: '2026-06-02',
    status: 'pending',
  },
  {
    id: 'PO-1188',
    supplier: 'Burkhart Dental',
    lines: [
      { itemId: 'SKU-1011', itemName: 'Alginate Refill', quantity: 6, unitCost: 21.3 },
    ],
    totalCost: 127.8,
    placedDate: '2026-05-25',
    estimatedArrival: '2026-06-04',
    status: 'pending',
  },
]

export const USAGE_TREND = [
  { week: 'W9', usage: 14 },
  { week: 'W10', usage: 18 },
  { week: 'W11', usage: 16 },
  { week: 'W12', usage: 22 },
  { week: 'W13', usage: 19 },
  { week: 'W14', usage: 26 },
  { week: 'W15', usage: 23 },
  { week: 'W16', usage: 29 },
]

export const CATEGORIES: (InventoryCategory | 'all')[] = [
  'all',
  'Consumables',
  'Instruments',
  'PPE & Hygiene',
  'Laboratory',
]

export const inventoryStatus = (qtyOnHand: number, minThreshold: number): InventoryStatus => {
  if (qtyOnHand <= 0) return 'out_of_stock'
  if (qtyOnHand < minThreshold) return 'low_stock'
  return 'in_stock'
}

export const ITEM_STATUS_LABEL: Record<InventoryStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
}