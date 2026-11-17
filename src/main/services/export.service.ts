import * as XLSX from 'xlsx';
import fs from 'fs';
import { SalesService } from './sales.service';
import { ProductsService } from './products.service';
import { PurchasesService } from './purchases.service';
import { CustomersService } from './customers.service';

// Sanitize string to prevent Excel Formula / CSV injection (CWE-1236)
function sanitizeCell(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@') || trimmed.startsWith('\t') || trimmed.startsWith('\r')) {
      return `'${val}`;
    }
  }
  return val;
}

function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = sanitizeCell(v);
  }
  return result;
}

export class ExportService {
  static exportSalesExcel(filePath: string, filters?: { fromDate?: string; toDate?: string }): { success: boolean; filePath: string } {
    const sales = SalesService.getAll(filters);

    const rows: any[] = [];
    for (const s of sales) {
      if (s.items && s.items.length > 0) {
        for (const item of s.items) {
          rows.push(sanitizeObject({
            'Invoice No': s.invoiceNo,
            'Date': s.createdAt.slice(0, 10),
            'Time': s.createdAt.slice(11, 19),
            'Customer Name': s.customerName || 'Walk-in',
            'Customer Mobile': s.customerMobile || '',
            'SKU': item.sku,
            'Item Name': item.name,
            'Size': item.size,
            'Color': item.color,
            'Quantity': item.quantity,
            'Unit Price (₹)': item.unitPrice,
            'Item Discount (₹)': item.discount,
            'Line Total (₹)': item.lineTotal,
            'Payment Method': s.paymentMethod,
            'Bill Subtotal (₹)': s.subtotal,
            'Bill Discount (₹)': s.discountAmount,
            'Grand Total (₹)': s.grandTotal
          }));
        }
      } else {
        rows.push(sanitizeObject({
          'Invoice No': s.invoiceNo,
          'Date': s.createdAt.slice(0, 10),
          'Time': s.createdAt.slice(11, 19),
          'Customer Name': s.customerName || 'Walk-in',
          'Customer Mobile': s.customerMobile || '',
          'SKU': '',
          'Item Name': '',
          'Size': '',
          'Color': '',
          'Quantity': 0,
          'Unit Price (₹)': 0,
          'Item Discount (₹)': 0,
          'Line Total (₹)': 0,
          'Payment Method': s.paymentMethod,
          'Bill Subtotal (₹)': s.subtotal,
          'Bill Discount (₹)': s.discountAmount,
          'Grand Total (₹)': s.grandTotal
        }));
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Register');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, buffer);

    return { success: true, filePath };
  }

  static exportProductsExcel(filePath: string): { success: boolean; filePath: string } {
    const products = ProductsService.getAll();

    const rows: any[] = [];
    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          rows.push(sanitizeObject({
            'SKU / Barcode': p.sku,
            'Product Name': p.name,
            'Category': p.category,
            'Size': v.size,
            'Colour': v.color,
            'Opening Stock': v.openingStock,
            'Current Stock': v.currentStock,
            'Cost Price (₹)': p.costPrice,
            'Markup (%)': p.markupPercent,
            'Selling Price / MRP (₹)': p.sellingPrice,
            'Stock Value (Cost ₹)': (v.currentStock * p.costPrice).toFixed(2),
            'Stock Value (Retail ₹)': (v.currentStock * p.sellingPrice).toFixed(2)
          }));
        }
      } else {
        rows.push(sanitizeObject({
          'SKU / Barcode': p.sku,
          'Product Name': p.name,
          'Category': p.category,
          'Size': '',
          'Colour': '',
          'Opening Stock': 0,
          'Current Stock': 0,
          'Cost Price (₹)': p.costPrice,
          'Markup (%)': p.markupPercent,
          'Selling Price / MRP (₹)': p.sellingPrice,
          'Stock Value (Cost ₹)': '0.00',
          'Stock Value (Retail ₹)': '0.00'
        }));
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Master');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, buffer);

    return { success: true, filePath };
  }

  static exportPurchasesExcel(filePath: string, filters?: { fromDate?: string; toDate?: string }): { success: boolean; filePath: string } {
    const purchases = PurchasesService.getAll(filters);

    const rows: any[] = [];
    for (const p of purchases) {
      for (const item of p.items || []) {
        rows.push(sanitizeObject({
          'Purchase No': p.purchaseNo,
          'Date': p.date,
          'Supplier': p.supplier,
          'SKU': item.sku,
          'Size': item.size,
          'Color': item.color,
          'Quantity': item.quantity,
          'Unit Cost (₹)': item.unitCost,
          'Total Amount (₹)': item.lineTotal,
          'Notes': p.notes || ''
        }));
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, buffer);

    return { success: true, filePath };
  }

  static exportCustomersCsv(filePath: string): { success: boolean; filePath: string } {
    const customers = CustomersService.getAll();

    const headers = ['ID', 'Customer Name', 'Mobile Number', 'Total Bills', 'Total Spent (₹)', 'Created At'];
    const csvRows = [headers.join(',')];

    for (const c of customers) {
      const sanitizedName = String(sanitizeCell(c.name)).replace(/"/g, '""');
      const sanitizedMobile = String(sanitizeCell(c.mobile)).replace(/"/g, '""');
      csvRows.push([
        c.id,
        `"${sanitizedName}"`,
        `"${sanitizedMobile}"`,
        c.totalBills || 0,
        (c.totalSpent || 0).toFixed(2),
        `"${c.createdAt.slice(0, 10)}"`
      ].join(','));
    }

    fs.writeFileSync(filePath, '\uFEFF' + csvRows.join('\r\n'), 'utf8'); // BOM for UTF-8 Excel support
    return { success: true, filePath };
  }
}
