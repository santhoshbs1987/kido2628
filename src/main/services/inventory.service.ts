import { getDb } from '../db/database';
import { StockTransaction } from '../db/schema';
import { ProductsService } from './products.service';

export interface FastStockInInput {
  sku: string;
  size?: string;
  color?: string;
  quantity: number;
  cost?: number;
  supplier?: string;
  notes?: string;
}

export class InventoryService {
  static fastStockIn(input: FastStockInInput): { success: boolean; newStock: number; message: string } {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanSku = input.sku.trim();
    const qty = Math.max(1, Math.round(Number(input.quantity) || 1));

    const product = ProductsService.getBySku(cleanSku);
    if (!product) {
      throw new Error(`Product with SKU "${cleanSku}" not found. Please create it first.`);
    }

    const variants = product.variants || [];
    if (variants.length === 0) {
      throw new Error(`Product "${product.name}" has no variants configured.`);
    }

    // Match variant
    const norm = (s?: string) => (s || '').trim().toLowerCase();
    let targetVariant = variants.find(
      (v) => norm(v.size) === norm(input.size) && norm(v.color) === norm(input.color)
    );

    // If only one variant exists and no size/color given, fallback to it
    if (!targetVariant && variants.length === 1) {
      targetVariant = variants[0];
    }

    if (!targetVariant) {
      throw new Error(
        `Variant (Size: ${input.size || 'N/A'}, Color: ${input.color || 'N/A'}) not found for product "${product.name}".`
      );
    }

    return db.transaction(() => {
      const newStock = targetVariant!.currentStock + qty;

      // Update variant stock
      db.prepare(`
        UPDATE product_variants
        SET current_stock = ?, updated_at = ?
        WHERE id = ?
      `).run(newStock, now, targetVariant!.id);

      // If supplier or cost provided, record purchase record too
      const supplierName = (input.supplier || '').trim() || 'Fast Intake';
      const unitCost = input.cost !== undefined && input.cost > 0 ? input.cost : product.costPrice;

      // Create purchase inward row
      const pCount = (db.prepare('SELECT COUNT(*) as count FROM purchases').get() as any).count;
      const purchaseNo = `PO-${1000 + pCount + 1}`;
      const lineTotal = unitCost * qty;

      const pResult = db.prepare(`
        INSERT INTO purchases (purchase_no, supplier, date, total_amount, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(purchaseNo, supplierName, now.slice(0, 10), lineTotal, input.notes || 'Fast Barcode Stock In', now);

      const purchaseId = Number(pResult.lastInsertRowid);

      db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, variant_id, sku, size, color, quantity, unit_cost, line_total, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        purchaseId,
        product.id,
        targetVariant!.id,
        product.sku,
        targetVariant!.size,
        targetVariant!.color,
        qty,
        unitCost,
        lineTotal,
        now
      );

      // Record in stock audit log
      db.prepare(`
        INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
        VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?)
      `).run(
        targetVariant!.id,
        qty,
        newStock,
        purchaseNo,
        `Supplier: ${supplierName}${input.notes ? ' - ' + input.notes : ''}`,
        now
      );

      return {
        success: true,
        newStock,
        message: `Added ${qty} unit(s) to ${product.name} (${targetVariant!.size || 'One size'} / ${targetVariant!.color || 'Default'}). New stock: ${newStock}.`
      };
    })();
  }

  static getLowStock(thresholdOverride?: number): any[] {
    const db = getDb();
    let threshold = thresholdOverride;
    if (threshold === undefined) {
      const settings = db.prepare('SELECT low_stock_threshold FROM settings WHERE id = 1').get() as any;
      threshold = settings?.low_stock_threshold ?? 3;
    }

    const rows = db.prepare(`
      SELECT
        p.id AS product_id,
        p.sku,
        p.name,
        p.category,
        p.cost_price,
        p.selling_price,
        v.id AS variant_id,
        v.size,
        v.color,
        v.current_stock
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.current_stock <= ?
      ORDER BY v.current_stock ASC, p.name ASC
    `).all(threshold) as any[];

    return rows;
  }

  static getStockTransactions(variantId?: number, sku?: string): StockTransaction[] {
    const db = getDb();
    let query = `
      SELECT t.*, v.size, v.color, p.sku, p.name
      FROM stock_transactions t
      JOIN product_variants v ON v.id = t.variant_id
      JOIN products p ON p.id = v.product_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (variantId) {
      conditions.push('t.variant_id = ?');
      params.push(variantId);
    } else if (sku && sku.trim()) {
      conditions.push('p.sku COLLATE NOCASE = ?');
      params.push(sku.trim());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY t.id DESC LIMIT 100';

    return db.prepare(query).all(...params) as any[];
  }
}
