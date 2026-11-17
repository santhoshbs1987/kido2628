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

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  markupPercent: number;
  sellingPrice: number;
  totalStock?: number;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  totalBills?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string; // unique cart line ID (e.g. sku-variantId)
  productId?: number;
  variantId?: number;
  sku: string;
  name: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  maxStock?: number;
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
