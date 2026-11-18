import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1, 'SKU / Barcode is required'),
  name: z.string().min(1, 'Product name is required'),
  category: z.string().default('General'),
  costPrice: z.number().min(0).default(0),
  markupPercent: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  variants: z.array(
    z.object({
      size: z.string().default(''),
      color: z.string().default(''),
      openingStock: z.number().int().min(0).default(0)
    })
  ).default([])
});

export const UpdateProductSchema = z.object({
  id: z.number().int().positive(),
  sku: z.string().min(1, 'SKU / Barcode is required'),
  name: z.string().min(1, 'Product name is required'),
  category: z.string().default('General'),
  costPrice: z.number().min(0).default(0),
  markupPercent: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  variants: z.array(
    z.object({
      id: z.number().int().positive().optional(),
      size: z.string().default(''),
      color: z.string().default(''),
      openingStock: z.number().int().min(0).default(0),
      currentStock: z.number().int().optional()
    })
  ).default([])
});

export const FastStockInSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().optional(),
  color: z.string().optional(),
  quantity: z.number().int().min(1),
  cost: z.number().min(0).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional()
});

export const CreateSaleSchema = z.object({
  customerId: z.number().int().positive().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(['Cash', 'UPI', 'Card', 'Split', 'Other']).default('Cash'),
  tenderedAmount: z.number().min(0).default(0),
  changeDue: z.number().min(0).default(0),
  notes: z.string().nullable().optional(),
  items: z.array(
    z.object({
      productId: z.number().int().positive().optional(),
      variantId: z.number().int().positive().optional(),
      sku: z.string().min(1),
      name: z.string().min(1),
      size: z.string().optional(),
      color: z.string().optional(),
      unitPrice: z.number().min(0),
      quantity: z.number().int().min(1),
      discount: z.number().min(0).default(0)
    })
  ).min(1, 'Sale must include at least one cart item')
});

export const CreatePurchaseSchema = z.object({
  supplier: z.string().min(1, 'Supplier name is required'),
  date: z.string().min(1, 'Purchase date is required'),
  notes: z.string().nullable().optional(),
  items: z.array(
    z.object({
      productId: z.number().int().positive().optional(),
      variantId: z.number().int().positive().optional(),
      sku: z.string().min(1),
      size: z.string().optional(),
      color: z.string().optional(),
      quantity: z.number().int().min(1),
      unitCost: z.number().min(0)
    })
  ).min(1, 'Purchase must have at least one line item')
});

export const CreateReturnSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  reason: z.string().nullable().optional(),
  items: z.array(
    z.object({
      saleItemId: z.number().int().positive(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      refundAmount: z.number().min(0),
      restock: z.boolean().default(true)
    })
  ).min(1, 'Please select at least one item to return')
});

export const CustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  mobile: z.string().min(5, 'Valid phone number is required')
});

export const UpdateSettingsSchema = z.object({
  shopName: z.string().optional(),
  subtitle: z.string().optional(),
  address: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  upiVpa: z.string().optional(),
  upiName: z.string().optional(),
  receiptPrinter: z.string().optional(),
  labelPrinter: z.string().optional(),
  printFormat: z.enum(['THERMAL_72MM', 'A4_INVOICE', 'A5_BILL']).optional(),
  labelFormat: z.enum(['ROLL_63X34', 'A4_SHEET_24']).optional(),
  autoBackupEnabled: z.boolean().optional(),
  backupPath: z.string().optional(),
  lowStockThreshold: z.number().int().min(0).optional()
});
