import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version
    )
  );

  const migrations: Array<{ version: number; name: string; run: (db: Database.Database) => void }> = [
    {
      version: 1,
      name: 'initial_schema',
      run: (db) => {
        db.exec(`
          -- Settings
          CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            shop_name TEXT NOT NULL DEFAULT 'KIDO 2628',
            subtitle TEXT NOT NULL DEFAULT 'Imported Korean Kids wear',
            address TEXT NOT NULL DEFAULT 'Shop No. 21, Nagarabhavi BDA Complex, Bengaluru - 560072',
            phone1 TEXT NOT NULL DEFAULT '8147464651',
            phone2 TEXT NOT NULL DEFAULT '9008300586',
            upi_vpa TEXT NOT NULL DEFAULT '8147464651@upi',
            upi_name TEXT NOT NULL DEFAULT 'KIDO 2628',
            receipt_printer TEXT DEFAULT '',
            label_printer TEXT DEFAULT '',
            auto_backup_enabled INTEGER NOT NULL DEFAULT 1,
            backup_path TEXT NOT NULL DEFAULT '',
            low_stock_threshold INTEGER NOT NULL DEFAULT 3,
            updated_at TEXT NOT NULL
          );

          -- Products
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            cost_price REAL NOT NULL DEFAULT 0.0,
            markup_percent REAL NOT NULL DEFAULT 0.0,
            selling_price REAL NOT NULL DEFAULT 0.0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
          CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

          -- Product Variants (Size & Color combinations)
          CREATE TABLE IF NOT EXISTS product_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            size TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            opening_stock INTEGER NOT NULL DEFAULT 0,
            current_stock INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(product_id, size, color)
          );
          CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

          -- Customers
          CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
          CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

          -- Sales
          CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT NOT NULL UNIQUE,
            customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            customer_name TEXT,
            customer_mobile TEXT,
            subtotal REAL NOT NULL,
            discount_percent REAL NOT NULL DEFAULT 0.0,
            discount_amount REAL NOT NULL DEFAULT 0.0,
            grand_total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            tendered_amount REAL NOT NULL DEFAULT 0.0,
            change_due REAL NOT NULL DEFAULT 0.0,
            total_cogs REAL NOT NULL DEFAULT 0.0,
            notes TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
          CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

          -- Sale Items
          CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
            sku TEXT NOT NULL,
            name TEXT NOT NULL,
            size TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            unit_cost REAL NOT NULL DEFAULT 0.0,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            discount REAL NOT NULL DEFAULT 0.0,
            line_total REAL NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
          CREATE INDEX IF NOT EXISTS idx_sale_items_sku ON sale_items(sku);

          -- Purchases (Supplier Inward Orders)
          CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_no TEXT NOT NULL UNIQUE,
            supplier TEXT NOT NULL,
            date TEXT NOT NULL,
            total_amount REAL NOT NULL DEFAULT 0.0,
            notes TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
          CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier);

          -- Purchase Items
          CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
            sku TEXT NOT NULL,
            size TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL,
            unit_cost REAL NOT NULL,
            line_total REAL NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

          -- Returns
          CREATE TABLE IF NOT EXISTS returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_no TEXT NOT NULL UNIQUE,
            sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
            invoice_no TEXT NOT NULL,
            customer_name TEXT,
            customer_mobile TEXT,
            total_refund REAL NOT NULL,
            reason TEXT,
            is_voided INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_returns_invoice ON returns(invoice_no);
          CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(created_at);

          -- Return Items
          CREATE TABLE IF NOT EXISTS return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
            sale_item_id INTEGER REFERENCES sale_items(id) ON DELETE SET NULL,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
            sku TEXT NOT NULL,
            name TEXT NOT NULL,
            size TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            refund_amount REAL NOT NULL,
            restock INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

          -- Stock Audit / Transaction Ledger
          CREATE TABLE IF NOT EXISTS stock_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
            change_qty INTEGER NOT NULL,
            balance_qty INTEGER NOT NULL,
            type TEXT NOT NULL,
            reference_id TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_stock_tx_variant ON stock_transactions(variant_id);
          CREATE INDEX IF NOT EXISTS idx_stock_tx_date ON stock_transactions(created_at);

          -- Register Shifts / Cash Till Reconciliation
          CREATE TABLE IF NOT EXISTS register_shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            opened_at TEXT NOT NULL,
            closed_at TEXT,
            opening_float REAL NOT NULL DEFAULT 0.0,
            expected_cash REAL NOT NULL DEFAULT 0.0,
            counted_cash REAL DEFAULT 0.0,
            cash_difference REAL DEFAULT 0.0,
            total_cash_sales REAL NOT NULL DEFAULT 0.0,
            total_upi_sales REAL NOT NULL DEFAULT 0.0,
            total_card_sales REAL NOT NULL DEFAULT 0.0,
            total_returns_refunded REAL NOT NULL DEFAULT 0.0,
            gross_sales REAL NOT NULL DEFAULT 0.0,
            net_sales REAL NOT NULL DEFAULT 0.0,
            status TEXT NOT NULL DEFAULT 'OPEN',
            notes TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_shifts_status ON register_shifts(status);
        `);
      }
    },
    {
      version: 2,
      name: 'seed_default_settings',
      run: (db) => {
        const now = new Date().toISOString();
        db.prepare(`
          INSERT OR IGNORE INTO settings (
            id, shop_name, subtitle, address, phone1, phone2, upi_vpa, upi_name,
            receipt_printer, label_printer, auto_backup_enabled, backup_path, low_stock_threshold, updated_at
          ) VALUES (
            1, 'KIDO 2628', 'Imported Korean Kids wear',
            'Shop No. 21, Nagarabhavi BDA Complex, Bengaluru - 560072',
            '8147464651', '9008300586', '8147464651@upi', 'KIDO 2628',
            '', '', 1, '', 3, ?
          )
        `).run(now);
      }
    }
  ];

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.transaction(() => {
        migration.run(db);
        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          migration.version,
          migration.name,
          new Date().toISOString()
        );
      })();
    }
  }
}
