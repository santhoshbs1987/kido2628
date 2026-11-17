export interface ShopSettings {
  id: number;
  shopName: string;
  subtitle: string;
  address: string;
  phone1: string;
  phone2: string;
  upiVpa: string;
  upiName: string;
  receiptPrinter: string;
  labelPrinter: string;
  autoBackupEnabled: boolean;
  backupPath: string;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  markupPercent: number;
  sellingPrice: number;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
  totalStock?: number;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  color: string;
  openingStock: number;
  currentStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  createdAt: string;
  updatedAt: string;
  totalBills?: number;
  totalSpent?: number;
}

export interface SaleItem {
  id?: number;
  saleId?: number;
  productId?: number | null;
  variantId?: number | null;
  sku: string;
  name: string;
  size: string;
  color: string;
  unitCost: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  createdAt?: string;
}

export interface Sale {
  id: number;
  invoiceNo: string;
  customerId?: number | null;
  customerName?: string | null;
  customerMobile?: string | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  tenderedAmount: number;
  changeDue: number;
  totalCogs: number;
  notes?: string | null;
  createdAt: string;
  items?: SaleItem[];
}

export interface PurchaseItem {
  id?: number;
  purchaseId?: number;
  productId: number;
  variantId: number;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  createdAt?: string;
}

export interface Purchase {
  id: number;
  purchaseNo: string;
  supplier: string;
  date: string;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  items?: PurchaseItem[];
}

export interface ReturnItem {
  id?: number;
  returnId?: number;
  saleItemId?: number | null;
  productId?: number | null;
  variantId?: number | null;
  sku: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  restock: boolean;
  createdAt?: string;
}

export interface Return {
  id: number;
  returnNo: string;
  shiftId?: number | null;
  saleId?: number | null;
  invoiceNo: string;
  customerName?: string | null;
  customerMobile?: string | null;
  totalRefund: number;
  reason?: string | null;
  isVoided: boolean;
  createdAt: string;
  items?: ReturnItem[];
}

export interface StockTransaction {
  id: number;
  variantId: number;
  changeQty: number;
  balanceQty: number;
  type: 'OPENING' | 'PURCHASE' | 'SALE' | 'RETURN_RESTOCK' | 'RETURN_DAMAGE' | 'ADJUSTMENT';
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface RegisterShift {
  id: number;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  expectedCash: number;
  countedCash?: number | null;
  cashDifference?: number | null;
  totalCashSales: number;
  totalUpiSales: number;
  totalCardSales: number;
  totalReturnsRefunded: number;
  grossSales: number;
  netSales: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string | null;
}
