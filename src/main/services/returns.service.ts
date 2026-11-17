import { getDb } from '../db/database';
import { Return, ReturnItem, Sale } from '../db/schema';
import { SalesService } from './sales.service';

export interface CreateReturnInput {
  invoiceNo: string;
  reason?: string | null;
  items: Array<{
    saleItemId: number;
    quantity: number;
    unitPrice: number;
    refundAmount: number;
    restock: boolean;
  }>;
}

export class ReturnsService {
  static getNextReturnNo(): string {
    const db = getDb();
    const row = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(return_no, 5) AS INTEGER)), 1000) as max_num FROM returns WHERE return_no LIKE 'RET-%'").get() as any;
    const maxNum = Math.max(1000, Number(row?.max_num) || 1000);
    return `RET-${maxNum + 1}`;
  }

  static lookupInvoice(invoiceNo: string): { sale: Sale; itemsEligible: any[]; remainingInvoiceRefund: number } {
    const db = getDb();
    const sale = SalesService.getByInvoiceNo(invoiceNo);
    if (!sale) {
      throw new Error(`Invoice "${invoiceNo}" not found.`);
    }

    // Get previous non-voided returns for this invoice to calculate remaining eligible return quantities
    const previousReturns = db.prepare(`
      SELECT ri.sale_item_id, SUM(ri.quantity) as returned_qty
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE r.invoice_no COLLATE NOCASE = ? AND r.is_voided = 0
      GROUP BY ri.sale_item_id
    `).all(invoiceNo.trim()) as Array<{ sale_item_id: number; returned_qty: number }>;

    const returnedMap = new Map<number, number>();
    for (const pr of previousReturns) {
      returnedMap.set(pr.sale_item_id, pr.returned_qty);
    }

    // Calculate remaining refundable amount on this invoice
    const previousRefundRow = db.prepare(`
      SELECT COALESCE(SUM(total_refund), 0) as total_refunded
      FROM returns
      WHERE invoice_no COLLATE NOCASE = ? AND is_voided = 0
    `).get(invoiceNo.trim()) as any;
    const totalPreviousRefund = Number(previousRefundRow?.total_refunded) || 0;
    const remainingInvoiceRefund = Math.max(0, Math.round((sale.grandTotal - totalPreviousRefund) * 100) / 100);

    // Prorate bill-level discount across items so returns never refund more than customer actually paid
    const billDiscountRatio = sale.subtotal > 0 ? (sale.grandTotal / sale.subtotal) : 1;

    const itemsEligible = (sale.items || []).map((item) => {
      const alreadyReturned = returnedMap.get(item.id!) || 0;
      const remainingQty = Math.max(0, item.quantity - alreadyReturned);
      const effectiveUnitPrice = Math.round(((item.lineTotal / item.quantity) * billDiscountRatio) * 100) / 100;
      return {
        saleItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        size: item.size,
        color: item.color,
        soldQty: item.quantity,
        alreadyReturnedQty: alreadyReturned,
        eligibleQty: remainingQty,
        unitPrice: item.unitPrice,
        effectiveUnitPrice,
        discount: item.discount
      };
    });

    return { sale, itemsEligible, remainingInvoiceRefund };
  }

  static create(input: CreateReturnInput): Return {
    const db = getDb();
    const now = new Date().toISOString();

    const lookup = ReturnsService.lookupInvoice(input.invoiceNo);
    const sale = lookup.sale;

    if (!input.items || input.items.length === 0) {
      throw new Error('Please select at least one item to return.');
    }

    return db.transaction(() => {
      const returnNo = ReturnsService.getNextReturnNo();
      let totalRefund = 0;

      const preparedItems: Array<{
        saleItemId: number;
        productId: number | null;
        variantId: number | null;
        sku: string;
        name: string;
        size: string;
        color: string;
        quantity: number;
        unitPrice: number;
        refundAmount: number;
        restock: boolean;
      }> = [];

      for (const reqItem of input.items) {
        const eligible = lookup.itemsEligible.find((e) => e.saleItemId === reqItem.saleItemId);
        if (!eligible) {
          throw new Error(`Item #${reqItem.saleItemId} does not belong to invoice "${input.invoiceNo}".`);
        }

        const qtyToReturn = Math.max(1, Math.round(Number(reqItem.quantity) || 1));
        if (qtyToReturn > eligible.eligibleQty) {
          throw new Error(
            `Requested return quantity (${qtyToReturn}) exceeds available eligible quantity (${eligible.eligibleQty}) for item "${eligible.name}".`
          );
        }

        const refund = Math.max(0, Math.round((Number(reqItem.refundAmount) || (eligible.effectiveUnitPrice * qtyToReturn)) * 100) / 100);
        totalRefund = Math.round((totalRefund + refund) * 100) / 100;

        // If restock is true, increment variant stock and record audit
        if (reqItem.restock && eligible.variantId) {
          const vRow = db.prepare('SELECT current_stock FROM product_variants WHERE id = ?').get(eligible.variantId) as any;
          if (vRow) {
            const newStock = vRow.current_stock + qtyToReturn;
            db.prepare('UPDATE product_variants SET current_stock = ?, updated_at = ? WHERE id = ?').run(
              newStock,
              now,
              eligible.variantId
            );

            db.prepare(`
              INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
              VALUES (?, ?, ?, 'RETURN_RESTOCK', ?, ?, ?)
            `).run(
              eligible.variantId,
              qtyToReturn,
              newStock,
              returnNo,
              `Restocked from Return on ${sale.invoiceNo}`,
              now
            );
          }
        } else if (!reqItem.restock && eligible.variantId) {
          // Record damage/defective write-off in audit trail
          const vRow = db.prepare('SELECT current_stock FROM product_variants WHERE id = ?').get(eligible.variantId) as any;
          const currentBal = vRow ? vRow.current_stock : 0;
          db.prepare(`
            INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
            VALUES (?, ?, ?, 'RETURN_DAMAGE', ?, ?, ?)
          `).run(
            eligible.variantId,
            0,
            currentBal,
            returnNo,
            `Damaged item returned without restock on ${sale.invoiceNo}`,
            now
          );
        }

        preparedItems.push({
          saleItemId: eligible.saleItemId,
          productId: eligible.productId,
          variantId: eligible.variantId,
          sku: eligible.sku,
          name: eligible.name,
          size: eligible.size,
          color: eligible.color,
          quantity: qtyToReturn,
          unitPrice: eligible.unitPrice,
          refundAmount: refund,
          restock: !!reqItem.restock
        });
      }

      if (totalRefund > lookup.remainingInvoiceRefund) {
        throw new Error(
          `Requested total refund (₹${totalRefund.toFixed(2)}) exceeds maximum remaining eligible amount on invoice "${sale.invoiceNo}" (₹${lookup.remainingInvoiceRefund.toFixed(2)}).`
        );
      }

      // Check if an active register shift is currently open
      const openShift = db.prepare("SELECT * FROM register_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
      const shiftId = openShift ? openShift.id : null;

      // Insert Return record
      const rResult = db.prepare(`
        INSERT INTO returns (
          return_no, shift_id, sale_id, invoice_no, customer_name, customer_mobile,
          total_refund, reason, is_voided, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        returnNo,
        shiftId,
        sale.id,
        sale.invoiceNo,
        sale.customerName,
        sale.customerMobile,
        totalRefund,
        input.reason || null,
        now
      );

      const returnId = Number(rResult.lastInsertRowid);

      // Insert Return Items
      const insertItemStmt = db.prepare(`
        INSERT INTO return_items (
          return_id, sale_item_id, product_id, variant_id, sku, name, size, color,
          quantity, unit_price, refund_amount, restock, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ri of preparedItems) {
        insertItemStmt.run(
          returnId,
          ri.saleItemId,
          ri.productId,
          ri.variantId,
          ri.sku,
          ri.name,
          ri.size,
          ri.color,
          ri.quantity,
          ri.unitPrice,
          ri.refundAmount,
          ri.restock ? 1 : 0,
          now
        );
      }

      // Update active register shift with returns refunded
      if (openShift) {
        db.prepare(`
          UPDATE register_shifts
          SET
            total_returns_refunded = total_returns_refunded + ?,
            net_sales = net_sales - ?,
            expected_cash = CASE
              WHEN expected_cash >= ? THEN expected_cash - ?
              ELSE 0
            END
          WHERE id = ?
        `).run(totalRefund, totalRefund, totalRefund, totalRefund, openShift.id);
      }

      return ReturnsService.getById(returnId)!;
    })();
  }

  static getById(id: number): Return | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM returns WHERE id = ?').get(id) as any;
    if (!row) return null;

    const items = db.prepare('SELECT * FROM return_items WHERE return_id = ? ORDER BY id ASC').all(id) as any[];

    return {
      id: row.id,
      returnNo: row.return_no,
      shiftId: row.shift_id ?? null,
      saleId: row.sale_id,
      invoiceNo: row.invoice_no,
      customerName: row.customer_name,
      customerMobile: row.customer_mobile,
      totalRefund: row.total_refund,
      reason: row.reason,
      isVoided: Boolean(row.is_voided),
      createdAt: row.created_at,
      items: items.map((i) => ({
        id: i.id,
        returnId: i.return_id,
        saleItemId: i.sale_item_id,
        productId: i.product_id,
        variantId: i.variant_id,
        sku: i.sku,
        name: i.name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        refundAmount: i.refund_amount,
        restock: Boolean(i.restock),
        createdAt: i.created_at
      }))
    };
  }

  static getAll(filters?: { fromDate?: string; toDate?: string }): Return[] {
    const db = getDb();
    let query = 'SELECT * FROM returns';
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

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const itemStmt = db.prepare('SELECT * FROM return_items WHERE return_id = ? ORDER BY id ASC');

    return rows.map((r) => ({
      id: r.id,
      returnNo: r.return_no,
      shiftId: r.shift_id ?? null,
      saleId: r.sale_id,
      invoiceNo: r.invoice_no,
      customerName: r.customer_name,
      customerMobile: r.customer_mobile,
      totalRefund: r.total_refund,
      reason: r.reason,
      isVoided: Boolean(r.is_voided),
      createdAt: r.created_at,
      items: (itemStmt.all(r.id) as any[]).map((i) => ({
        id: i.id,
        returnId: i.return_id,
        saleItemId: i.sale_item_id,
        productId: i.product_id,
        variantId: i.variant_id,
        sku: i.sku,
        name: i.name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        refundAmount: i.refund_amount,
        restock: Boolean(i.restock),
        createdAt: i.created_at
      }))
    }));
  }

  static voidReturn(id: number): { success: boolean; message: string } {
    const db = getDb();
    const ret = ReturnsService.getById(id);
    if (!ret) {
      throw new Error(`Return #${id} not found.`);
    }

    if (ret.isVoided) {
      throw new Error(`Return #${ret.returnNo} is already voided.`);
    }

    return db.transaction(() => {
      const now = new Date().toISOString();

      // If items were restocked, reverse the stock addition
      for (const item of ret.items || []) {
        if (item.restock && item.variantId) {
          const vRow = db.prepare('SELECT current_stock FROM product_variants WHERE id = ?').get(item.variantId) as any;
          if (vRow) {
            const newStock = Math.max(0, vRow.current_stock - item.quantity);
            db.prepare('UPDATE product_variants SET current_stock = ?, updated_at = ? WHERE id = ?').run(
              newStock,
              now,
              item.variantId
            );

            db.prepare(`
              INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
              VALUES (?, ?, ?, 'ADJUSTMENT', ?, 'Voided return stock adjustment', ?)
            `).run(item.variantId, -item.quantity, newStock, ret.returnNo, now);
          }
        }
      }

      // Mark return voided
      db.prepare('UPDATE returns SET is_voided = 1 WHERE id = ?').run(id);

      // Revert register shift refund deduction ONLY if the return was logged during the currently active open shift
      if (ret.shiftId) {
        const openShift = db.prepare("SELECT * FROM register_shifts WHERE status = 'OPEN' AND id = ?").get(ret.shiftId) as any;
        if (openShift) {
          db.prepare(`
            UPDATE register_shifts
            SET
              total_returns_refunded = MAX(0, total_returns_refunded - ?),
              net_sales = net_sales + ?,
              expected_cash = expected_cash + ?
            WHERE id = ?
          `).run(ret.totalRefund, ret.totalRefund, ret.totalRefund, openShift.id);
        }
      }

      return {
        success: true,
        message: `Return #${ret.returnNo} successfully marked as void and inventory adjusted.`
      };
    })();
  }
}
