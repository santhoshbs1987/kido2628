# KIDO 2628 Database Schema Specification

This document details the relational SQLite schema, foreign key relationships, indexes, and sequential migrations powering the KIDO 2628 retail desktop app.

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PRODUCTS ||--o{ SALE_ITEMS : referenced_in
    PRODUCTS ||--o{ PURCHASE_ITEMS : inwarded_in
    PRODUCT_VARIANTS ||--o{ STOCK_TRANSACTIONS : audited_in
    PRODUCT_VARIANTS ||--o{ SALE_ITEMS : sold_as
    PRODUCT_VARIANTS ||--o{ PURCHASE_ITEMS : received_as
    PRODUCT_VARIANTS ||--o{ RETURN_ITEMS : returned_as
    CUSTOMERS ||--o{ SALES : purchases
    SALES ||--|{ SALE_ITEMS : contains
    SALES ||--o{ RETURNS : refunded_in
    RETURNS ||--|{ RETURN_ITEMS : contains
    PURCHASES ||--|{ PURCHASE_ITEMS : contains
    REGISTER_SHIFTS ||--o{ RETURNS : logs

    SETTINGS {
        int id PK
        string shop_name
        string subtitle
        string address
        string phone1
        string phone2
        string upi_vpa
        string upi_name
        string receipt_printer
        string label_printer
        int auto_backup_enabled
        string backup_path
        int low_stock_threshold
        string updated_at
    }

    PRODUCTS {
        int id PK
        string sku UK
        string name
        string category
        real cost_price
        real markup_percent
        real selling_price
        string created_at
        string updated_at
    }

    PRODUCT_VARIANTS {
        int id PK
        int product_id FK
        string size
        string color
        int opening_stock
        int current_stock
        string created_at
        string updated_at
    }

    CUSTOMERS {
        int id PK
        string name
        string mobile UK
        string created_at
        string updated_at
    }

    SALES {
        int id PK
        string invoice_no UK
        int customer_id FK
        string customer_name
        string customer_mobile
        real subtotal
        real discount_percent
        real discount_amount
        real grand_total
        string payment_method
        real tendered_amount
        real change_due
        real total_cogs
        string notes
        string created_at
    }

    SALE_ITEMS {
        int id PK
        int sale_id FK
        int product_id FK
        int variant_id FK
        string sku
        string name
        string size
        string color
        real unit_cost
        real unit_price
        int quantity
        real discount
        real line_total
        string created_at
    }

    PURCHASES {
        int id PK
        string purchase_no UK
        string supplier
        string date
        real total_amount
        string notes
        string created_at
    }

    PURCHASE_ITEMS {
        int id PK
        int purchase_id FK
        int product_id FK
        int variant_id FK
        string sku
        string size
        string color
        int quantity
        real unit_cost
        real line_total
        string created_at
    }

    RETURNS {
        int id PK
        string return_no UK
        int shift_id FK
        int sale_id FK
        string invoice_no
        string customer_name
        string customer_mobile
        real total_refund
        string reason
        int is_voided
        string created_at
    }

    RETURN_ITEMS {
        int id PK
        int return_id FK
        int sale_item_id FK
        int product_id FK
        int variant_id FK
        string sku
        string name
        string size
        string color
        int quantity
        real unit_price
        real refund_amount
        int restock
        string created_at
    }

    STOCK_TRANSACTIONS {
        int id PK
        int variant_id FK
        int change_qty
        int balance_qty
        string type
        string reference_id
        string notes
        string created_at
    }

    REGISTER_SHIFTS {
        int id PK
        string opened_at
        string closed_at
        real opening_float
        real expected_cash
        real counted_cash
        real cash_difference
        real total_cash_sales
        real total_upi_sales
        real total_card_sales
        real total_returns_refunded
        real gross_sales
        real net_sales
        string status
        string notes
    }
```

---

## 2. Table Specifications

### 2.1 `products` (Article Master)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal product ID |
| `sku` | `TEXT` | `NOT NULL UNIQUE COLLATE NOCASE` | Master Barcode / SKU |
| `name` | `TEXT` | `NOT NULL` | Product title |
| `category` | `TEXT` | `NOT NULL DEFAULT 'General'` | Category (`Boys`, `Girls`, `Newborn`) |
| `cost_price` | `REAL` | `NOT NULL DEFAULT 0.0` | Cost of goods (weighted average) |
| `markup_percent`| `REAL` | `NOT NULL DEFAULT 0.0` | Markup % on cost |
| `selling_price`| `REAL` | `NOT NULL DEFAULT 0.0` | Retail MRP |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 update timestamp |

### 2.2 `product_variants` (Size & Colour Matrix)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal variant ID |
| `product_id` | `INTEGER` | `NOT NULL REFERENCES products(id) ON DELETE RESTRICT` | Parent product ID |
| `size` | `TEXT` | `NOT NULL DEFAULT ''` | Size label (`2Y`, `3Y`, `Free Size`) |
| `color` | `TEXT` | `NOT NULL DEFAULT ''` | Colour label (`Pink`, `Navy`) |
| `opening_stock`| `INTEGER` | `NOT NULL DEFAULT 0` | Initial opening quantity |
| `current_stock`| `INTEGER` | `NOT NULL DEFAULT 0` | Current real-time balance |
| `created_at` | `TEXT` | `NOT NULL` | Creation timestamp |
| `updated_at` | `TEXT` | `NOT NULL` | Last stock update timestamp |
| **Unique** | — | `UNIQUE(product_id, size, color)` | Prevents duplicate variant combos |

### 2.3 `sales` (Invoices)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal invoice ID |
| `invoice_no` | `TEXT` | `NOT NULL UNIQUE` | Sequential invoice (`INV-1001`) |
| `customer_id` | `INTEGER` | `REFERENCES customers(id) ON DELETE SET NULL` | Linked customer CRM ID |
| `customer_name`| `TEXT` | `NULLABLE` | Customer name snapshot |
| `customer_mobile`| `TEXT` | `NULLABLE` | Customer phone snapshot |
| `subtotal` | `REAL` | `NOT NULL` | Sum of item line totals |
| `discount_percent`| `REAL`| `NOT NULL DEFAULT 0.0` | Bill-level percentage discount |
| `discount_amount`| `REAL` | `NOT NULL DEFAULT 0.0` | Bill-level rupee discount |
| `grand_total` | `REAL` | `NOT NULL` | Final payable amount |
| `payment_method`| `TEXT` | `NOT NULL` | `Cash`, `UPI`, `Card`, `Split` |
| `tendered_amount`| `REAL`| `NOT NULL DEFAULT 0.0` | Cash tendered by customer |
| `change_due` | `REAL` | `NOT NULL DEFAULT 0.0` | Change returned to customer |
| `total_cogs` | `REAL` | `NOT NULL DEFAULT 0.0` | Total cost of items sold |
| `notes` | `TEXT` | `NULLABLE` | Order remarks |
| `created_at` | `TEXT` | `NOT NULL` | Sale timestamp |

### 2.4 `returns` (Sales Returns & Exchanges)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal return ID |
| `return_no` | `TEXT` | `NOT NULL UNIQUE` | Sequential return number (`RET-1001`) |
| `shift_id` | `INTEGER` | `REFERENCES register_shifts(id) ON DELETE SET NULL` | Active shift during return |
| `sale_id` | `INTEGER` | `REFERENCES sales(id) ON DELETE SET NULL` | Linked original sale ID |
| `invoice_no` | `TEXT` | `NOT NULL` | Original invoice number reference |
| `customer_name`| `TEXT` | `NULLABLE` | Customer name snapshot |
| `customer_mobile`| `TEXT` | `NULLABLE` | Customer phone snapshot |
| `total_refund` | `REAL` | `NOT NULL` | Total refund paid to customer |
| `reason` | `TEXT` | `NULLABLE` | Return reason |
| `is_voided` | `INTEGER` | `NOT NULL DEFAULT 0` | 1 if clerical error voided |
| `created_at` | `TEXT` | `NOT NULL` | Return timestamp |

---

## 3. Indexes & Performance Optimization

```sql
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sku ON sale_items(sku);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_returns_invoice ON returns(invoice_no);
CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(created_at);
CREATE INDEX IF NOT EXISTS idx_returns_shift ON returns(shift_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_variant ON stock_transactions(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_date ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON register_shifts(status);
```
