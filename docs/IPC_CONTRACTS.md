# KIDO 2628 IPC API Contracts & Preload Reference

The application enforces a strict, type-safe Inter-Process Communication (IPC) bridge between the Electron Renderer (React) and the Main process (Node.js).

Every IPC channel is exposed via `window.api.<namespace>.<method>` in `src/preload/index.ts` with TypeScript declarations in `src/preload/index.d.ts`.

---

## 1. IPC Response Standard

All asynchronous IPC calls return a standardized Promise resolving to:
```ts
interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 2. API Channel Registry

### 2.1 Products (`window.api.products`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getAll` | `products:getAll` | `{ search?: string; category?: string }` | `Product[]` | Filter catalog by search term or category |
| `getBySku` | `products:getBySku` | `sku: string` | `Product \| null` | Lookup master article and variants by SKU |
| `getById` | `products:getById` | `id: number` | `Product \| null` | Fetch product by ID |
| `create` | `products:create` | `CreateProductInput` (Zod validated) | `Product` | Create product and generate variant matrix |
| `update` | `products:update` | `UpdateProductInput` (Zod validated) | `Product` | Update product details and sync variants |
| `delete` | `products:delete` | `id: number` | `{ success: boolean; message: string }` | Delete product (safeguards stock & history) |
| `getCategories`| `products:getCategories` | `void` | `string[]` | List distinct category tags |

### 2.2 Inventory (`window.api.inventory`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fastStockIn` | `inventory:fastStockIn` | `FastStockInInput` (Zod validated) | `{ success: boolean; newStock: number; message: string }` | Quick barcode intake with supplier notes |
| `getLowStock` | `inventory:getLowStock` | `threshold?: number` | `any[]` | Query variants where stock <= threshold |
| `getTransactions`| `inventory:getTransactions`| `{ variantId?: number; sku?: string }` | `StockTransaction[]` | Audit trail ledger of stock movements |

### 2.3 Sales (`window.api.sales`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getNextInvoiceNo`| `sales:getNextInvoiceNo`| `void` | `string` | Get next sequential invoice (e.g. `INV-1002`) |
| `create` | `sales:create` | `CreateSaleInput` (Zod validated) | `Sale` | Atomically commit bill, deduct stock, update till |
| `getAll` | `sales:getAll` | `{ fromDate?: string; toDate?: string; search?: string }` | `Sale[]` | Query historical sales with filters |
| `getByInvoiceNo`| `sales:getByInvoiceNo`| `invoiceNo: string` | `Sale \| null` | Fetch invoice with line items |

### 2.4 Purchases (`window.api.purchases`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `create` | `purchases:create` | `CreatePurchaseInput` (Zod validated) | `Purchase` | Record inward order & recalculate weighted cost |
| `getAll` | `purchases:getAll` | `{ fromDate?: string; toDate?: string; supplier?: string }` | `Purchase[]` | List inward purchases |
| `delete` | `purchases:delete` | `id: number` | `{ success: boolean; message: string }` | Delete inward order (safeguards negative stock) |

### 2.5 Returns (`window.api.returns`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `lookupInvoice` | `returns:lookupInvoice` | `invoiceNo: string` | `{ sale: Sale; itemsEligible: any[]; remainingInvoiceRefund: number }` | Lookup bill, compute eligible quantities & prorated refund rates |
| `create` | `returns:create` | `CreateReturnInput` (Zod validated) | `Return` | Process return with restock/damage toggle |
| `getAll` | `returns:getAll` | `{ fromDate?: string; toDate?: string }` | `Return[]` | List customer returns history |
| `void` | `returns:void` | `id: number` | `{ success: boolean; message: string }` | Void clerical error & reverse inventory addition |

### 2.6 Customers (`window.api.customers`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getAll` | `customers:getAll` | `search?: string` | `Customer[]` | List CRM customers with spending aggregates |
| `findByMobile` | `customers:findByMobile` | `mobile: string` | `Customer \| null` | Fast phone number lookup |
| `create` | `customers:create` | `{ name: string; mobile: string }` | `Customer` | Add CRM customer profile |
| `update` | `customers:update` | `{ id: number; data: { name: string; mobile: string } }` | `Customer` | Update customer name or phone |
| `delete` | `customers:delete` | `id: number` | `{ success: boolean; message: string }` | Delete profile (retains historical sales) |

### 2.7 Analytics & Shifts (`window.api.analytics`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getMetrics` | `analytics:getMetrics` | `{ fromDate?: string; toDate?: string }` | `DashboardMetrics` | Performance KPIs (Net Sales, Profit, Shifts) |
| `getActiveShift`| `analytics:getActiveShift`| `void` | `RegisterShift \| null` | Fetch currently active open shift |
| `openShift` | `analytics:openShift` | `{ openingFloat: number; notes?: string }` | `RegisterShift` | Open cash drawer with initial float |
| `closeShift` | `analytics:closeShift` | `{ countedCash: number; notes?: string }` | `RegisterShift` | Reconcile physical cash against expected till |
| `getShiftHistory`| `analytics:getShiftHistory`| `void` | `RegisterShift[]` | History of shift reconciliations |

### 2.8 Settings & Printers (`window.api.settings`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `get` | `settings:get` | `void` | `ShopSettings` | Retrieve store profile & hardware config |
| `update` | `settings:update` | `UpdateSettingsInput` (Zod validated) | `ShopSettings` | Update store details, printers, backup paths |
| `getPrinters` | `settings:getPrinters` | `void` | `Array<{ name: string; isDefault: boolean }>` | Enumerate OS hardware thermal printers |

### 2.9 Backups & Data Portability (`window.api.backup`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `exportJson` | `backup:exportJson` | `void` | `{ filePath: string }` | Native save dialog to export complete JSON |
| `importJson` | `backup:importJson` | `void` | `{ success: boolean; message: string }` | Native open dialog (supports v1.40 legacy & v2.0) |
| `exportSqlite` | `backup:exportSqlite` | `void` | `{ filePath: string }` | Save online SQLite binary snapshot |
| `importSqlite` | `backup:importSqlite` | `void` | `void` | Restore binary SQLite with WAL cleanup |

### 2.10 Excel & CSV Exports (`window.api.export`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `sales` | `export:sales` | `{ fromDate?: string; toDate?: string }` | `{ filePath: string }` | Export sanitized Sales Register `.xlsx` |
| `products` | `export:products` | `void` | `{ filePath: string }` | Export sanitized Inventory Master `.xlsx` |
| `purchases` | `export:purchases` | `{ fromDate?: string; toDate?: string }` | `{ filePath: string }` | Export sanitized Supplier Inwards `.xlsx` |
| `customers` | `export:customers` | `void` | `{ filePath: string }` | Export sanitized Customer CRM `.csv` |

### 2.11 Printing (`window.api.print`)
| Method | Channel Name | Input Payload | Return Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `receipt` | `print:receipt` | `{ sale: Sale; options?: { silent?: boolean; deviceName?: string } }` | `void` | Silent or dialog ESC/POS 72mm receipt print |
| `labels` | `print:labels` | `{ html: string; options?: { silent?: boolean; deviceName?: string } }` | `void` | Batch print 63mm × 34mm barcode sticky labels |
