import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getDb, getDatabasePath, closeDatabase, initDatabase } from '../db/database';
import { SettingsService } from './settings.service';

export class BackupService {
  static getDefaultBackupDir(): string {
    const documentsDir = app ? app.getPath('documents') : process.cwd();
    const backupDir = path.join(documentsDir, 'Kido2628_Backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  static performDailyAutoBackup(): { success: boolean; filePath?: string; error?: string } {
    try {
      const settings = SettingsService.get();
      if (!settings.autoBackupEnabled) {
        return { success: true };
      }

      const backupDir = settings.backupPath && fs.existsSync(settings.backupPath)
        ? settings.backupPath
        : BackupService.getDefaultBackupDir();

      const todayStr = new Date().toISOString().slice(0, 10);
      const fileName = `kido2628_backup_${todayStr}.sqlite`;
      const targetPath = path.join(backupDir, fileName);

      // Check if backup already exists for today
      if (fs.existsSync(targetPath)) {
        return { success: true, filePath: targetPath };
      }

      const db = getDb();
      // Use SQLite online backup API via VACUUM INTO or better-sqlite3 backup()
      db.backup(targetPath);
      return { success: true, filePath: targetPath };
    } catch (err: any) {
      console.error('Auto backup failed:', err);
      return { success: false, error: err.message };
    }
  }

  static exportSqliteBackup(destPath: string): { success: boolean; error?: string } {
    try {
      const db = getDb();
      db.backup(destPath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static importSqliteBackup(sourcePath: string): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(sourcePath)) {
        throw new Error('Selected backup file does not exist.');
      }
      closeDatabase();
      const currentDbPath = getDatabasePath();
      const walPath = `${currentDbPath}-wal`;
      const shmPath = `${currentDbPath}-shm`;

      // Make backup of current first
      const recoveryPath = `${currentDbPath}.before_restore`;
      if (fs.existsSync(currentDbPath)) {
        fs.copyFileSync(currentDbPath, recoveryPath);
      }
      // Remove stale WAL and SHM files to prevent replaying stale logs over the new database
      if (fs.existsSync(walPath)) {
        try { fs.unlinkSync(walPath); } catch (e) {}
      }
      if (fs.existsSync(shmPath)) {
        try { fs.unlinkSync(shmPath); } catch (e) {}
      }

      fs.copyFileSync(sourcePath, currentDbPath);
      initDatabase(currentDbPath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static exportJson(): any {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const products = db.prepare('SELECT * FROM products').all();
    const variants = db.prepare('SELECT * FROM product_variants').all();
    const customers = db.prepare('SELECT * FROM customers').all();
    const sales = db.prepare('SELECT * FROM sales').all();
    const saleItems = db.prepare('SELECT * FROM sale_items').all();
    const purchases = db.prepare('SELECT * FROM purchases').all();
    const purchaseItems = db.prepare('SELECT * FROM purchase_items').all();
    const returns = db.prepare('SELECT * FROM returns').all();
    const returnItems = db.prepare('SELECT * FROM return_items').all();
    const stockTransactions = db.prepare('SELECT * FROM stock_transactions').all();
    const shifts = db.prepare('SELECT * FROM register_shifts').all();

    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      products,
      variants,
      customers,
      sales,
      saleItems,
      purchases,
      purchaseItems,
      returns,
      returnItems,
      stockTransactions,
      shifts
    };
  }

  static importJson(jsonData: any): { success: boolean; message: string } {
    const db = getDb();
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Invalid JSON format for backup restoration.');
    }

    // Disable foreign keys outside the transaction to allow clean bulk restoration
    db.pragma('foreign_keys = OFF;');
    try {
      return db.transaction(() => {
        const now = new Date().toISOString();

      // Check if this is a legacy v1.x JSON structure
      if (jsonData.products && Array.isArray(jsonData.products) && (jsonData.lastInvoice !== undefined || jsonData.settings?.salesHistoryCleared !== undefined)) {
        // LEGACY v1.40 RESTORE
        // Clear current active tables
        db.exec(`
          DELETE FROM sale_items;
          DELETE FROM sales;
          DELETE FROM return_items;
          DELETE FROM returns;
          DELETE FROM purchase_items;
          DELETE FROM purchases;
          DELETE FROM stock_transactions;
          DELETE FROM product_variants;
          DELETE FROM products;
          DELETE FROM customers;
        `);

        // 1. Settings
        if (jsonData.settings) {
          const s = jsonData.settings;
          db.prepare(`
            UPDATE settings
            SET shop_name = ?, subtitle = ?, address = ?, phone1 = ?, phone2 = ?, updated_at = ?
            WHERE id = 1
          `).run(
            s.shopName || 'KIDO 2628',
            'Imported Korean Kids wear',
            s.address || 'Shop No. 21, Nagarabhavi BDA Complex, Bengaluru - 560072',
            s.phone1 || '8147464651',
            s.phone2 || '9008300586',
            now
          );
        }

        // 2. Customers
        const customerMap = new Map<string, number>();
        if (Array.isArray(jsonData.customers)) {
          for (const c of jsonData.customers) {
            if (c.mobile) {
              const res = db.prepare('INSERT OR IGNORE INTO customers (name, mobile, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
                c.name || 'Valued Customer',
                c.mobile,
                now,
                now
              );
              if (res.lastInsertRowid) {
                customerMap.set(c.mobile, Number(res.lastInsertRowid));
              }
            }
          }
        }

        // 3. Products & Variants
        const productMap = new Map<string, number>();
        const variantMap = new Map<string, number>(); // key: sku|size|color -> variantId

        for (const p of jsonData.products) {
          const sku = String(p.sku || '').trim();
          if (!sku) continue;

          const pRes = db.prepare(`
            INSERT INTO products (sku, name, category, cost_price, markup_percent, selling_price, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            sku,
            p.name || sku,
            p.category || 'General',
            Number(p.cost) || 0,
            Number(p.markup) || 0,
            Number(p.price) || 0,
            now,
            now
          );
          const pId = Number(pRes.lastInsertRowid);
          productMap.set(sku.toLowerCase(), pId);

          // Handle variants
          const rawVariants = Array.isArray(p.sizes) ? p.sizes : [{ size: p.size || '', color: p.color || '', opening: p.opening || 0 }];
          for (const v of rawVariants) {
            const size = typeof v === 'object' ? String(v.size || '').trim() : String(v || '').trim();
            const color = typeof v === 'object' ? String(v.color || '').trim() : '';
            const opening = typeof v === 'object' ? Math.max(0, Number(v.opening) || 0) : 0;

            const vRes = db.prepare(`
              INSERT INTO product_variants (product_id, size, color, opening_stock, current_stock, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(pId, size, color, opening, opening, now, now);

            const vId = Number(vRes.lastInsertRowid);
            const vKey = `${sku.toLowerCase()}|${size.toLowerCase()}|${color.toLowerCase()}`;
            variantMap.set(vKey, vId);

            if (opening > 0) {
              db.prepare(`
                INSERT INTO stock_transactions (variant_id, change_qty, balance_qty, type, reference_id, notes, created_at)
                VALUES (?, ?, ?, 'OPENING', ?, 'Restored legacy opening stock', ?)
              `).run(vId, opening, opening, sku, now);
            }
          }
        }

        // 4. Legacy Sales
        if (Array.isArray(jsonData.sales)) {
          for (const s of jsonData.sales) {
            const invoiceNo = s.invoice || `INV-${s.id || 1000}`;
            const sRes = db.prepare(`
              INSERT INTO sales (
                invoice_no, customer_name, customer_mobile, subtotal,
                discount_percent, discount_amount, grand_total, payment_method,
                tendered_amount, change_due, total_cogs, notes, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            `).run(
              invoiceNo,
              s.customer || null,
              s.mobile || null,
              Number(s.subtotal) || Number(s.total) || 0,
              Number(s.discountPercent) || 0,
              Number(s.discount) || 0,
              Number(s.total) || 0,
              s.payment || 'Cash',
              Number(s.tendered) || 0,
              Number(s.change) || 0,
              s.notes || null,
              s.date || now
            );
            const saleId = Number(sRes.lastInsertRowid);

            for (const item of (s.items || [])) {
              const sku = String(item.sku || '').trim();
              const size = String(item.size || '').trim();
              const color = String(item.color || '').trim();
              const vKey = `${sku.toLowerCase()}|${size.toLowerCase()}|${color.toLowerCase()}`;
              const vId = variantMap.get(vKey) || null;
              const pId = productMap.get(sku.toLowerCase()) || null;
              const qty = Number(item.qty) || 1;
              const price = Number(item.price) || 0;
              const discount = Number(item.discount) || 0;
              const lineTotal = price * qty - discount;

              db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, variant_id, sku, name, size, color, unit_cost, unit_price, quantity, discount, line_total, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
              `).run(saleId, pId, vId, sku, item.name || sku, size, color, price, qty, discount, lineTotal, s.date || now);

              // Deduct stock if variant exists
              if (vId) {
                db.prepare('UPDATE product_variants SET current_stock = current_stock - ? WHERE id = ?').run(qty, vId);
              }
            }
          }
        }

        // 5. Legacy Purchases
        if (Array.isArray(jsonData.purchases)) {
          let pIdx = 1001;
          for (const pur of jsonData.purchases) {
            const pNo = `PO-${pIdx++}`;
            const qty = Number(pur.qty) || 0;
            const cost = Number(pur.cost) || 0;
            const total = qty * cost;
            db.prepare(`
              INSERT INTO purchases (purchase_no, supplier, date, total_amount, notes, created_at)
              VALUES (?, ?, ?, ?, 'Legacy Purchase Record', ?)
            `).run(pNo, pur.supplier || 'General Supplier', pur.date || now.slice(0, 10), total, now);
          }
        }

        return {
          success: true,
          message: `Successfully restored legacy backup: ${jsonData.products.length} products, ${jsonData.sales?.length || 0} bills imported.`
        };
      } else {
        // MODERN v2.0 JSON RESTORE
        db.exec(`
          DELETE FROM sale_items;
          DELETE FROM sales;
          DELETE FROM return_items;
          DELETE FROM returns;
          DELETE FROM purchase_items;
          DELETE FROM purchases;
          DELETE FROM stock_transactions;
          DELETE FROM product_variants;
          DELETE FROM products;
          DELETE FROM customers;
          DELETE FROM register_shifts;
        `);

        if (jsonData.settings) {
          const s = jsonData.settings;
          db.prepare(`
            UPDATE settings
            SET shop_name = ?, subtitle = ?, address = ?, phone1 = ?, phone2 = ?,
                upi_vpa = ?, upi_name = ?, receipt_printer = ?, label_printer = ?,
                auto_backup_enabled = ?, backup_path = ?, low_stock_threshold = ?, updated_at = ?
            WHERE id = 1
          `).run(
            s.shop_name, s.subtitle, s.address, s.phone1, s.phone2,
            s.upi_vpa, s.upi_name, s.receipt_printer, s.label_printer,
            s.auto_backup_enabled, s.backup_path, s.low_stock_threshold, now
          );
        }

        // Insert tables directly with column validation & safe identifier quoting
        const insertTable = (table: string, rows: any[]) => {
          if (!Array.isArray(rows) || rows.length === 0) return;
          // Validate and filter column identifiers
          const rawCols = Object.keys(rows[0]);
          const cols = rawCols.filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
          if (cols.length === 0) return;

          const quotedCols = cols.map((c) => `"${c}"`).join(',');
          const placeholders = cols.map(() => '?').join(',');
          const stmt = db.prepare(`INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`);
          for (const r of rows) {
            stmt.run(...cols.map((c) => (r[c] === undefined ? null : r[c])));
          }
        };

        insertTable('customers', jsonData.customers);
        insertTable('products', jsonData.products);
        insertTable('product_variants', jsonData.variants);
        insertTable('sales', jsonData.sales);
        insertTable('sale_items', jsonData.saleItems);
        insertTable('purchases', jsonData.purchases);
        insertTable('purchase_items', jsonData.purchaseItems);
        insertTable('returns', jsonData.returns);
        insertTable('return_items', jsonData.returnItems);
        insertTable('stock_transactions', jsonData.stockTransactions);
        insertTable('register_shifts', jsonData.shifts);

        return {
          success: true,
          message: 'Successfully imported database snapshot.'
        };
      }
    })();
    } finally {
      db.pragma('foreign_keys = ON;');
    }
  }
}
