import { getDb } from '../db/database';
import { Sale, SaleItem } from '../db/schema';
import { CustomersService } from './customers.service';

export const roundMoney = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

export interface CreateSaleInput {
  customerId?: number | null;
  customerName?: string | null;
  customerMobile?: string | null;
  discountPercent?: number;
  discountAmount?: number;
  paymentMethod: string;
  tenderedAmount?: number;
  changeDue?: number;
  notes?: string | null;
  items: Array<{
    productId?: number;
    variantId?: number;
    sku: string;
    name: string;
    size?: string;
    color?: string;
    unitPrice: number;
    quantity: number;
    discount?: number;
  }>;
}

export class SalesService {
  static getNextInvoiceNo(): string {
    const db = getDb();
    const row = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(invoice_no, 5) AS INTEGER)), 1000) as max_num FROM sales WHERE invoice_no LIKE 'INV-%'").get() as any;
    const maxNum = Math.max(1000, Number(row?.max_num) || 1000);
    return `INV-${maxNum + 1}`;
  }

  static create(input: CreateSaleInput): Sale {
    const db = getDb();
    const now = new Date().toISOString();

    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot complete a sale with an empty cart.');
    }

    return db.transaction(() => {
      // 1. Calculate and validate items
      let subtotal = 0;
      let totalCogs = 0;
      const verifiedItems: Array<{
        productId: number | null;
        variantId: number | null;
        sku: string;
        name: string;
        size: string;
        color: string;
        unitCost: number;
        unitPrice: number;
        quantity: number;
        discount: number;
        lineTotal: number;
      }> = [];

      for (const item of input.items) {
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        const price = Math.max(0, Number(item.unitPrice) || 0);
        const itemDiscount = Math.min(price * qty, Math.max(0, Number(item.discount) || 0));
        const lineTotal = price * qty - itemDiscount;
        subtotal += lineTotal;

        // Fetch product & variant for inventory deduction and COGS
        let productId: number | null = item.productId || null;
        let variantId: number | null = item.variantId || null;
        let unitCost = 0;

        if (variantId) {
          const vRow = db.prepare(`
            SELECT v.*, p.cost_price, p.id as p_id, p.name as p_name, p.sku as p_sku
            FROM product_variants v
            JOIN products p ON p.id = v.product_id
            WHERE v.id = ?
          `).get(variantId) as any;

          if (vRow) {
            productId = vRow.p_id;
            unitCost = vRow.cost_price || 0;

            // Deduct stock
            const newStock = vRow.current_stock - qty;
            db.prepare('UPDATE product_variants SET current_stock = ?, updated_at = ? WHERE id = ?').run(
              newStock,
              now,
              variantId
            );

            // Audit log
            db.prepare(`
              INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
              VALUES (?, ?, ?, 'SALE', ?, ?, ?)
            `).run(variantId, -qty, newStock, 'Pending-Sale', `Sale of ${qty} unit(s)`, now);
          }
        } else if (item.sku) {
          // Find product by SKU
          const pRow = db.prepare('SELECT * FROM products WHERE sku COLLATE NOCASE = ?').get(item.sku.trim()) as any;
          if (pRow) {
            productId = pRow.id;
            unitCost = pRow.cost_price || 0;
            const vRow = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC LIMIT 1').get(pRow.id) as any;
            if (vRow) {
              variantId = vRow.id;
              const newStock = vRow.current_stock - qty;
              db.prepare('UPDATE product_variants SET current_stock = ?, updated_at = ? WHERE id = ?').run(
                newStock,
                now,
                vRow.id
              );
              db.prepare(`
                INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
                VALUES (?, ?, ?, 'SALE', ?, ?, ?)
              `).run(vRow.id, -qty, newStock, 'Pending-Sale', `Sale of ${qty} unit(s)`, now);
            }
          }
        }

        totalCogs += unitCost * qty;

        verifiedItems.push({
          productId,
          variantId,
          sku: item.sku.trim(),
          name: item.name.trim(),
          size: item.size?.trim() || '',
          color: item.color?.trim() || '',
          unitCost,
          unitPrice: price,
          quantity: qty,
          discount: itemDiscount,
          lineTotal
        });
      }

      // Bill-level discount calculation
      const discountPercent = Math.max(0, Math.min(100, Number(input.discountPercent) || 0));
      let discountAmount = Math.max(0, Number(input.discountAmount) || 0);
      if (discountPercent > 0) {
        discountAmount = roundMoney((subtotal * discountPercent) / 100);
      }
      const grandTotal = Math.max(0, roundMoney(subtotal - discountAmount));

      const tenderedAmount = Math.max(0, Number(input.tenderedAmount) || 0);
      if (input.paymentMethod === 'Cash' && tenderedAmount > 0 && tenderedAmount < grandTotal) {
        throw new Error(`Tendered cash (₹${tenderedAmount.toFixed(2)}) is less than Grand Total (₹${grandTotal.toFixed(2)}).`);
      }

      let changeDue = 0;
      if (input.paymentMethod === 'Cash' && tenderedAmount > grandTotal) {
        changeDue = roundMoney(tenderedAmount - grandTotal);
      }

      // Customer auto-lookup or auto-save
      let customerId = input.customerId || null;
      let customerName = input.customerName?.trim() || null;
      const customerMobile = input.customerMobile?.trim() || null;

      if (customerMobile) {
        const cust = CustomersService.findOrCreate(customerMobile, customerName || 'Valued Customer');
        customerId = cust.id;
        customerName = cust.name;
      }

      // Generate invoice number
      const invoiceNo = SalesService.getNextInvoiceNo();

      // Insert Sale
      const insertSale = db.prepare(`
        INSERT INTO sales (
          invoice_no, customer_id, customer_name, customer_mobile,
          subtotal, discount_percent, discount_amount, grand_total,
          payment_method, tendered_amount, change_due, total_cogs, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const saleResult = insertSale.run(
        invoiceNo,
        customerId,
        customerName,
        customerMobile,
        subtotal,
        discountPercent,
        discountAmount,
        grandTotal,
        input.paymentMethod || 'Cash',
        tenderedAmount,
        changeDue,
        totalCogs,
        input.notes || null,
        now
      );

      const saleId = Number(saleResult.lastInsertRowid);

      // Insert Sale Items
      const insertItem = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, variant_id, sku, name, size, color,
          unit_cost, unit_price, quantity, discount, line_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of verifiedItems) {
        insertItem.run(
          saleId,
          item.productId,
          item.variantId,
          item.sku,
          item.name,
          item.size,
          item.color,
          item.unitCost,
          item.unitPrice,
          item.quantity,
          item.discount,
          item.lineTotal,
          now
        );
      }

      // Update reference_id on stock transactions that had 'Pending-Sale'
      db.prepare(`
        UPDATE stock_transactions
        SET reference_id = ?
        WHERE reference_id = 'Pending-Sale' AND created_at = ?
      `).run(invoiceNo, now);

      // Update active register shift if open
      SalesService.updateOpenShiftWithSale(grandTotal, input.paymentMethod || 'Cash');

      return SalesService.getById(saleId)!;
    })();
  }

  private static updateOpenShiftWithSale(amount: number, method: string): void {
    const db = getDb();
    const openShift = db.prepare("SELECT * FROM register_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
    if (!openShift) return;

    let cashInc = 0;
    let upiInc = 0;
    let cardInc = 0;

    if (method === 'Cash') {
      cashInc = amount;
    } else if (method === 'UPI') {
      upiInc = amount;
    } else {
      cardInc = amount;
    }

    db.prepare(`
      UPDATE register_shifts
      SET
        total_cash_sales = total_cash_sales + ?,
        total_upi_sales = total_upi_sales + ?,
        total_card_sales = total_card_sales + ?,
        gross_sales = gross_sales + ?,
        net_sales = net_sales + ?,
        expected_cash = opening_float + (total_cash_sales + ?) - total_returns_refunded
      WHERE id = ?
    `).run(cashInc, upiInc, cardInc, amount, amount, cashInc, openShift.id);
  }

  static getById(id: number): Sale | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as any;
    if (!row) return null;

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC').all(id) as any[];

    return {
      id: row.id,
      invoiceNo: row.invoice_no,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerMobile: row.customer_mobile,
      subtotal: row.subtotal,
      discountPercent: row.discount_percent,
      discountAmount: row.discount_amount,
      grandTotal: row.grand_total,
      paymentMethod: row.payment_method,
      tenderedAmount: row.tendered_amount,
      changeDue: row.change_due,
      totalCogs: row.total_cogs,
      notes: row.notes,
      createdAt: row.created_at,
      items: items.map((i) => ({
        id: i.id,
        saleId: i.sale_id,
        productId: i.product_id,
        variantId: i.variant_id,
        sku: i.sku,
        name: i.name,
        size: i.size,
        color: i.color,
        unitCost: i.unit_cost,
        unitPrice: i.unit_price,
        quantity: i.quantity,
        discount: i.discount,
        lineTotal: i.line_total,
        createdAt: i.created_at
      }))
    };
  }

  static getByInvoiceNo(invoiceNo: string): Sale | null {
    const db = getDb();
    const row = db.prepare('SELECT id FROM sales WHERE invoice_no COLLATE NOCASE = ?').get(invoiceNo.trim()) as any;
    if (!row) return null;
    return SalesService.getById(row.id);
  }

  static getAll(filters?: { fromDate?: string; toDate?: string; search?: string }): Sale[] {
    const db = getDb();
    let query = 'SELECT * FROM sales';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.fromDate) {
      conditions.push('date(created_at) >= date(?)');
      params.push(filters.fromDate);
    }

    if (filters?.toDate) {
      conditions.push('date(created_at) <= date(?)');
      params.push(filters.toDate);
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push('(invoice_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)');
      params.push(term, term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const itemStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC');

    return rows.map((r) => ({
      id: r.id,
      invoiceNo: r.invoice_no,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerMobile: r.customer_mobile,
      subtotal: r.subtotal,
      discountPercent: r.discount_percent,
      discountAmount: r.discount_amount,
      grandTotal: r.grand_total,
      paymentMethod: r.payment_method,
      tenderedAmount: r.tendered_amount,
      changeDue: r.change_due,
      totalCogs: r.total_cogs,
      notes: r.notes,
      createdAt: r.created_at,
      items: (itemStmt.all(r.id) as any[]).map((i) => ({
        id: i.id,
        saleId: i.sale_id,
        productId: i.product_id,
        variantId: i.variant_id,
        sku: i.sku,
        name: i.name,
        size: i.size,
        color: i.color,
        unitCost: i.unit_cost,
        unitPrice: i.unit_price,
        quantity: i.quantity,
        discount: i.discount,
        lineTotal: i.line_total,
        createdAt: i.created_at
      }))
    }));
  }
}
