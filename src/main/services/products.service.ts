import { getDb } from '../db/database';
import { Product, ProductVariant } from '../db/schema';

export interface CreateProductInput {
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  markupPercent: number;
  sellingPrice: number;
  variants: Array<{
    size: string;
    color: string;
    openingStock: number;
  }>;
}

export interface UpdateProductInput {
  id: number;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  markupPercent: number;
  sellingPrice: number;
  variants: Array<{
    id?: number;
    size: string;
    color: string;
    openingStock: number;
    currentStock?: number;
  }>;
}

export class ProductsService {
  static getAll(filters?: { search?: string; category?: string }): Product[] {
    const db = getDb();
    let query = `
      SELECT p.*,
        COALESCE(SUM(v.current_stock), 0) AS total_stock
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.category && filters.category !== 'All') {
      conditions.push('p.category = ?');
      params.push(filters.category);
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
      params.push(term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY p.id ORDER BY p.id DESC';

    const rows = db.prepare(query).all(...params) as any[];

    // Fetch variants for each product
    const variantStmt = db.prepare(`
      SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC
    `);

    return rows.map((r) => {
      const variants = variantStmt.all(r.id) as any[];
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        costPrice: r.cost_price,
        markupPercent: r.markup_percent,
        sellingPrice: r.selling_price,
        totalStock: r.total_stock,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        variants: variants.map((v) => ({
          id: v.id,
          productId: v.product_id,
          size: v.size,
          color: v.color,
          openingStock: v.opening_stock,
          currentStock: v.current_stock,
          createdAt: v.created_at,
          updatedAt: v.updated_at
        }))
      };
    });
  }

  static getBySku(sku: string): Product | null {
    const db = getDb();
    const cleanSku = sku.trim();
    const row = db.prepare('SELECT * FROM products WHERE sku COLLATE NOCASE = ?').get(cleanSku) as any;
    if (!row) return null;

    const variants = db
      .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC')
      .all(row.id) as any[];

    const totalStock = variants.reduce((sum, v) => sum + (v.current_stock || 0), 0);

    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      costPrice: row.cost_price,
      markupPercent: row.markup_percent,
      sellingPrice: row.selling_price,
      totalStock,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variants: variants.map((v) => ({
        id: v.id,
        productId: v.product_id,
        size: v.size,
        color: v.color,
        openingStock: v.opening_stock,
        currentStock: v.current_stock,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }))
    };
  }

  static getById(id: number): Product | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!row) return null;

    const variants = db
      .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC')
      .all(row.id) as any[];

    const totalStock = variants.reduce((sum, v) => sum + (v.current_stock || 0), 0);

    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      costPrice: row.cost_price,
      markupPercent: row.markup_percent,
      sellingPrice: row.selling_price,
      totalStock,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variants: variants.map((v) => ({
        id: v.id,
        productId: v.product_id,
        size: v.size,
        color: v.color,
        openingStock: v.opening_stock,
        currentStock: v.current_stock,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }))
    };
  }

  static create(input: CreateProductInput): Product {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanSku = input.sku.trim();

    // Check duplicate SKU
    const existing = db.prepare('SELECT id FROM products WHERE sku COLLATE NOCASE = ?').get(cleanSku);
    if (existing) {
      throw new Error(`Product with SKU "${cleanSku}" already exists.`);
    }

    return db.transaction(() => {
      const insertProduct = db.prepare(`
        INSERT INTO products (sku, name, category, cost_price, markup_percent, selling_price, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertProduct.run(
        cleanSku,
        input.name.trim(),
        input.category.trim() || 'General',
        input.costPrice || 0,
        input.markupPercent || 0,
        input.sellingPrice || 0,
        now,
        now
      );

      const productId = Number(result.lastInsertRowid);

      const insertVariant = db.prepare(`
        INSERT INTO product_variants (product_id, size, color, opening_stock, current_stock, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertTx = db.prepare(`
        INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
        VALUES (?, ?, ?, 'OPENING', ?, 'Opening inventory stock', ?)
      `);

      // Ensure at least one default variant if empty
      const variantsToCreate = input.variants && input.variants.length > 0
        ? input.variants
        : [{ size: '', color: '', openingStock: 0 }];

      for (const v of variantsToCreate) {
        const opening = Math.max(0, Number(v.openingStock) || 0);
        const vResult = insertVariant.run(
          productId,
          (v.size || '').trim(),
          (v.color || '').trim(),
          opening,
          opening,
          now,
          now
        );
        const variantId = Number(vResult.lastInsertRowid);

        if (opening > 0) {
          insertTx.run(variantId, opening, opening, cleanSku, now);
        }
      }

      return ProductsService.getById(productId)!;
    })();
  }

  static update(input: UpdateProductInput): Product {
    const db = getDb();
    const now = new Date().toISOString();
    const cleanSku = input.sku.trim();

    const existingProduct = ProductsService.getById(input.id);
    if (!existingProduct) {
      throw new Error(`Product #${input.id} not found.`);
    }

    // Check SKU conflict with another product
    const skuConflict = db
      .prepare('SELECT id FROM products WHERE sku COLLATE NOCASE = ? AND id != ?')
      .get(cleanSku, input.id) as any;
    if (skuConflict) {
      throw new Error(`SKU "${cleanSku}" is already used by another product.`);
    }

    return db.transaction(() => {
      db.prepare(`
        UPDATE products
        SET sku = ?, name = ?, category = ?, cost_price = ?, markup_percent = ?, selling_price = ?, updated_at = ?
        WHERE id = ?
      `).run(
        cleanSku,
        input.name.trim(),
        input.category.trim() || 'General',
        input.costPrice || 0,
        input.markupPercent || 0,
        input.sellingPrice || 0,
        now,
        input.id
      );

      // Existing variants map
      const existingVariants = existingProduct.variants || [];
      const incomingVariants = input.variants && input.variants.length > 0
        ? input.variants
        : [{ size: '', color: '', openingStock: 0 }];

      // Match and update or insert
      const keptVariantIds = new Set<number>();

      for (const iv of incomingVariants) {
        const cleanSize = (iv.size || '').trim();
        const cleanColor = (iv.color || '').trim();

        // Find existing match by ID or by size+color
        let match = iv.id
          ? existingVariants.find((ev) => ev.id === iv.id)
          : existingVariants.find(
              (ev) =>
                ev.size.toLowerCase() === cleanSize.toLowerCase() &&
                ev.color.toLowerCase() === cleanColor.toLowerCase()
            );

        if (match) {
          keptVariantIds.add(match.id);
          // If openingStock changed, adjust currentStock accordingly
          const oldOpening = match.openingStock;
          const newOpening = Math.max(0, Number(iv.openingStock) || 0);
          const diff = newOpening - oldOpening;
          const newCurrentStock = match.currentStock + diff;

          db.prepare(`
            UPDATE product_variants
            SET size = ?, color = ?, opening_stock = ?, current_stock = ?, updated_at = ?
            WHERE id = ?
          `).run(cleanSize, cleanColor, newOpening, newCurrentStock, now, match.id);

          if (diff !== 0) {
            db.prepare(`
              INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
              VALUES (?, ?, ?, 'ADJUSTMENT', ?, 'Opening stock adjusted via edit', ?)
            `).run(match.id, diff, newCurrentStock, cleanSku, now);
          }
        } else {
          // New variant combination
          const opening = Math.max(0, Number(iv.openingStock) || 0);
          const vResult = db.prepare(`
            INSERT INTO product_variants (product_id, size, color, opening_stock, current_stock, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(input.id, cleanSize, cleanColor, opening, opening, now, now);

          const newVariantId = Number(vResult.lastInsertRowid);
          keptVariantIds.add(newVariantId);

          if (opening > 0) {
            db.prepare(`
              INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
              VALUES (?, ?, ?, 'OPENING', ?, 'New variant added via edit', ?)
            `).run(newVariantId, opening, opening, cleanSku, now);
          }
        }
      }

      // Check variants to remove
      for (const ev of existingVariants) {
        if (!keptVariantIds.has(ev.id)) {
          // Safeguard: verify if variant has sales or current stock > 0
          if (ev.currentStock > 0) {
            throw new Error(
              `Cannot remove variant (${ev.size || 'One size'} / ${ev.color || 'Default'}) because it still has ${ev.currentStock} units in stock.`
            );
          }
          const hasSales = db.prepare('SELECT id FROM sale_items WHERE variant_id = ? LIMIT 1').get(ev.id);
          if (hasSales) {
            throw new Error(
              `Cannot remove variant (${ev.size || 'One size'} / ${ev.color || 'Default'}) because it has historical sales records.`
            );
          }
          const hasPurchases = db.prepare('SELECT id FROM purchase_items WHERE variant_id = ? LIMIT 1').get(ev.id);
          if (hasPurchases) {
            throw new Error(
              `Cannot remove variant (${ev.size || 'One size'} / ${ev.color || 'Default'}) because it has historical purchase records.`
            );
          }
          const hasReturns = db.prepare('SELECT id FROM return_items WHERE variant_id = ? LIMIT 1').get(ev.id);
          if (hasReturns) {
            throw new Error(
              `Cannot remove variant (${ev.size || 'One size'} / ${ev.color || 'Default'}) because it has historical return records.`
            );
          }
          db.prepare('DELETE FROM product_variants WHERE id = ?').run(ev.id);
        }
      }

      return ProductsService.getById(input.id)!;
    })();
  }

  static delete(id: number): { success: boolean; message?: string } {
    const db = getDb();
    const product = ProductsService.getById(id);
    if (!product) {
      throw new Error(`Product #${id} does not exist.`);
    }

    // Safeguard: Check stock > 0
    if ((product.totalStock || 0) > 0) {
      throw new Error(
        `Cannot delete product "${product.name}" (${product.sku}) because it has active stock of ${product.totalStock} units. Adjust or write-off stock first.`
      );
    }

    // Safeguard: Check sales history
    const hasSales = db.prepare('SELECT id FROM sale_items WHERE product_id = ? LIMIT 1').get(id);
    if (hasSales) {
      throw new Error(
        `Cannot delete product "${product.name}" (${product.sku}) because it has attached sales invoices. Deletion is blocked to preserve audit history.`
      );
    }

    // Safeguard: Check purchase history
    const hasPurchases = db.prepare('SELECT id FROM purchase_items WHERE product_id = ? LIMIT 1').get(id);
    if (hasPurchases) {
      throw new Error(
        `Cannot delete product "${product.name}" (${product.sku}) because it has inward purchase history. Deletion is blocked to preserve audit records.`
      );
    }

    // Safeguard: Check return history
    const hasReturns = db.prepare('SELECT id FROM return_items WHERE product_id = ? LIMIT 1').get(id);
    if (hasReturns) {
      throw new Error(
        `Cannot delete product "${product.name}" (${product.sku}) because it has attached customer return records. Deletion is blocked to preserve audit history.`
      );
    }

    return db.transaction(() => {
      // Delete stock transactions for variants
      const variantIds = (product.variants || []).map((v) => v.id);
      if (variantIds.length > 0) {
        const placeholders = variantIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM stock_transactions WHERE variant_id IN (${placeholders})`).run(...variantIds);
        db.prepare(`DELETE FROM product_variants WHERE id IN (${placeholders})`).run(...variantIds);
      }
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return { success: true, message: `Product "${product.name}" successfully deleted.` };
    })();
  }

  static getCategories(): string[] {
    const db = getDb();
    const rows = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" ORDER BY category ASC').all() as { category: string }[];
    const defaults = ['Boys', 'Girls', 'Newborn', 'Accessories', 'General'];
    const custom = rows.map((r) => r.category);
    return Array.from(new Set([...defaults, ...custom]));
  }
}
