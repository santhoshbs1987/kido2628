import { getDb } from '../db/database';
import { Purchase, PurchaseItem } from '../db/schema';
import { ProductsService } from './products.service';

export interface CreatePurchaseInput {
  supplier: string;
  date: string;
  notes?: string | null;
  items: Array<{
    productId?: number;
    variantId?: number;
    sku: string;
    size?: string;
    color?: string;
    quantity: number;
    unitCost: number;
  }>;
}

export class PurchasesService {
  static getNextPurchaseNo(): string {
    const db = getDb();
    const rows = db.prepare('SELECT purchase_no FROM purchases ORDER BY id DESC LIMIT 50').all() as { purchase_no: string }[];
    let maxNum = 1000;
    for (const r of rows) {
      const match = r.purchase_no.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `PO-${maxNum + 1}`;
  }

  static create(input: CreatePurchaseInput): Purchase {
    const db = getDb();
    const now = new Date().toISOString();

    if (!input.items || input.items.length === 0) {
      throw new Error('Purchase must contain at least one item.');
    }

    return db.transaction(() => {
      const purchaseNo = PurchasesService.getNextPurchaseNo();
      let totalAmount = 0;

      const preparedItems: Array<{
        productId: number;
        variantId: number;
        sku: string;
        size: string;
        color: string;
        quantity: number;
        unitCost: number;
        lineTotal: number;
      }> = [];

      for (const item of input.items) {
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        const cost = Math.max(0, Number(item.unitCost) || 0);
        const lineTotal = qty * cost;
        totalAmount += lineTotal;

        // Resolve product and variant
        let product = item.productId ? ProductsService.getById(item.productId) : null;
        if (!product && item.sku) {
          product = ProductsService.getBySku(item.sku.trim());
        }
        if (!product) {
          throw new Error(`Product with SKU "${item.sku}" does not exist. Please add it first.`);
        }

        const variants = product.variants || [];
        let variant = item.variantId ? variants.find((v) => v.id === item.variantId) : null;
        if (!variant) {
          const norm = (s?: string) => (s || '').trim().toLowerCase();
          variant = variants.find(
            (v) => norm(v.size) === norm(item.size) && norm(v.color) === norm(item.color)
          );
        }
        if (!variant && variants.length === 1) {
          variant = variants[0];
        }
        if (!variant) {
          throw new Error(
            `Variant (${item.size || 'One size'} / ${item.color || 'Default'}) not found for "${product.name}".`
          );
        }

        // Increment variant stock
        const newStock = variant.currentStock + qty;
        db.prepare('UPDATE product_variants SET current_stock = ?, updated_at = ? WHERE id = ?').run(
          newStock,
          now,
          variant.id
        );

        // Update product cost price with weighted average
        if (cost > 0 && product.costPrice > 0 && variant.currentStock > 0) {
          const weightedCost = Math.round(
            ((product.costPrice * variant.currentStock + cost * qty) / (variant.currentStock + qty)) * 100
          ) / 100;
          db.prepare('UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?').run(
            weightedCost,
            now,
            product.id
          );
        } else if (cost > 0 && product.costPrice === 0) {
          db.prepare('UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?').run(
            cost,
            now,
            product.id
          );
        }

        // Record stock transaction
        db.prepare(`
          INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
          VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?)
        `).run(variant.id, qty, newStock, purchaseNo, `Supplier: ${input.supplier.trim()}`, now);

        preparedItems.push({
          productId: product.id,
          variantId: variant.id,
          sku: product.sku,
          size: variant.size,
          color: variant.color,
          quantity: qty,
          unitCost: cost,
          lineTotal
        });
      }

      // Insert Purchase Order
      const pResult = db.prepare(`
        INSERT INTO purchases (purchase_no, supplier, date, total_amount, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        purchaseNo,
        input.supplier.trim(),
        input.date || now.slice(0, 10),
        totalAmount,
        input.notes || null,
        now
      );

      const purchaseId = Number(pResult.lastInsertRowid);

      // Insert Items
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, variant_id, sku, size, color, quantity, unit_cost, line_total, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pi of preparedItems) {
        insertItemStmt.run(
          purchaseId,
          pi.productId,
          pi.variantId,
          pi.sku,
          pi.size,
          pi.color,
          pi.quantity,
          pi.unitCost,
          pi.lineTotal,
          now
        );
      }

      return PurchasesService.getById(purchaseId)!;
    })();
  }

  static getById(id: number): Purchase | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as any;
    if (!row) return null;

    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC').all(id) as any[];

    return {
      id: row.id,
      purchaseNo: row.purchase_no,
      supplier: row.supplier,
      date: row.date,
      totalAmount: row.total_amount,
      notes: row.notes,
      createdAt: row.created_at,
      items: items.map((i) => ({
        id: i.id,
        purchaseId: i.purchase_id,
        productId: i.product_id,
        variantId: i.variant_id,
        sku: i.sku,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitCost: i.unit_cost,
        lineTotal: i.line_total,
        createdAt: i.created_at
      }))
    };
  }

  static getAll(filters?: { fromDate?: string; toDate?: string; supplier?: string }): Purchase[] {
    const db = getDb();
    let query = 'SELECT * FROM purchases';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.fromDate) {
      conditions.push('date >= ?');
      params.push(filters.fromDate);
    }

    if (filters?.toDate) {
      conditions.push('date <= ?');
      params.push(filters.toDate);
    }

    if (filters?.supplier && filters.supplier.trim()) {
      conditions.push('supplier LIKE ?');
      params.push(`%${filters.supplier.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const itemStmt = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC');

    return rows.map((r) => ({
      id: r.id,
      purchaseNo: r.purchase_no,
      supplier: r.supplier,
      date: r.date,
      totalAmount: r.total_amount,
      notes: r.notes,
      createdAt: r.created_at,
      items: (itemStmt.all(r.id) as any[]).map((i) => ({
        id: i.id,
        purchaseId: i.purchase_id,
        productId: i.product_id,
        variantId: i.variant_id,
        sku: i.sku,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitCost: i.unit_cost,
        lineTotal: i.line_total,
        createdAt: i.created_at
      }))
    }));
  }

  static delete(id: number): { success: boolean; message: string } {
    const db = getDb();
    const purchase = PurchasesService.getById(id);
    if (!purchase) {
      throw new Error(`Purchase #${id} not found.`);
    }

    return db.transaction(() => {
      const now = new Date().toISOString();

      // Check each item stock before deducting
      for (const item of purchase.items || []) {
        const vRow = db.prepare('SELECT current_stock FROM product_variants WHERE id = ?').get(item.variantId) as any;
        if (vRow) {
          if (vRow.current_stock < item.quantity) {
            throw new Error(
              `Cannot delete purchase #${purchase.purchaseNo} because doing so would cause inventory of variant (${item.size}/${item.color}) to fall below zero (Current: ${vRow.current_stock}, Would deduct: ${item.quantity}).`
            );
          }
        }
      }

      // Revert stock
      for (const item of purchase.items || []) {
        const vRow = db.prepare('SELECT current_stock FROM product_variants WHERE id = ?').get(item.variantId) as any;
        if (vRow) {
          const newStock = vRow.current_stock - item.quantity;
          db.prepare('UPDATE product_variants SET current_stock = ?, updated_at = ? WHERE id = ?').run(
            newStock,
            now,
            item.variantId
          );

          db.prepare(`
            INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
            VALUES (?, ?, ?, 'ADJUSTMENT', ?, 'Purchase entry deleted', ?)
          `).run(item.variantId, -item.quantity, newStock, purchase.purchaseNo, now);
        }
      }

      db.prepare('DELETE FROM purchases WHERE id = ?').run(id);

      return {
        success: true,
        message: `Purchase #${purchase.purchaseNo} and associated stock intake successfully removed.`
      };
    })();
  }
}
