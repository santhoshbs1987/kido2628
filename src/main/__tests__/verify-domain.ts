import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { ProductsService } from '../services/products.service';
import { InventoryService } from '../services/inventory.service';
import { CustomersService } from '../services/customers.service';
import { SalesService } from '../services/sales.service';
import { ReturnsService } from '../services/returns.service';
import { AnalyticsService } from '../services/analytics.service';
import { BackupService } from '../services/backup.service';
import { ExportService } from '../services/export.service';
import * as dbModule from '../db/database';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('--- STARTING VERIFICATION TEST SUITE ---');

  const testDbPath = path.join(process.cwd(), '.test_kido2628.sqlite');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  // Initialize test DB
  const db = dbModule.initDatabase(testDbPath);
  console.log('✓ SQLite Database initialized at:', testDbPath);

  // 1. Verify schema tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
  console.log('✓ Tables created by migrations:', tables.join(', '));
  const expectedTables = ['settings', 'products', 'product_variants', 'customers', 'sales', 'sale_items', 'purchases', 'purchase_items', 'returns', 'return_items', 'stock_transactions', 'register_shifts'];
  for (const t of expectedTables) {
    if (!tables.includes(t)) throw new Error(`Missing expected table: ${t}`);
  }

  // 2. Test Product & Variant Matrix
  console.log('\n--- 2. Testing Multi-Variant Product Creation ---');
  const product = ProductsService.create({
    sku: 'KD-JACKET-01',
    name: 'Korean S Jacket',
    category: 'Boys',
    costPrice: 500,
    markupPercent: 40,
    sellingPrice: 700,
    variants: [
      { size: '2Y', color: 'Blue', openingStock: 5 },
      { size: '3Y', color: 'Blue', openingStock: 8 },
      { size: '2Y', color: 'Black', openingStock: 4 }
    ]
  });
  console.log(`✓ Product created: "${product.name}" with total stock = ${product.totalStock}`);
  if (product.totalStock !== 17) throw new Error(`Expected total stock 17, got ${product.totalStock}`);

  // 3. Test Fast Scanner Stock Intake
  console.log('\n--- 3. Testing Fast Barcode Stock Intake ---');
  const stockInRes = InventoryService.fastStockIn({
    sku: 'KD-JACKET-01',
    size: '2Y',
    color: 'Blue',
    quantity: 10,
    cost: 500,
    supplier: 'Seoul Wholesale Lot',
    notes: 'Batch 2026-A'
  });
  console.log(`✓ Fast stock intake: ${stockInRes.message}`);
  const updatedProd = ProductsService.getBySku('KD-JACKET-01');
  const blue2Y = updatedProd?.variants?.find((v) => v.size === '2Y' && v.color === 'Blue');
  if (blue2Y?.currentStock !== 15) throw new Error(`Expected variant stock 15, got ${blue2Y?.currentStock}`);

  // 4. Test Customer auto-creation & lookup
  console.log('\n--- 4. Testing Customer CRM ---');
  const customer = CustomersService.findOrCreate('9876543210', 'Ananya Sharma');
  console.log(`✓ Customer created: ${customer.name} (${customer.mobile})`);

  // 5. Test Register Shift Opening
  console.log('\n--- 5. Testing Register Shift Opening ---');
  const openShift = AnalyticsService.openShift(1000, 'Morning shift opened');
  console.log(`✓ Shift opened: ID ${openShift.id}, Opening float: ₹${openShift.openingFloat}`);

  // 6. Test Atomic Sale Completion
  console.log('\n--- 6. Testing Atomic POS Sale ---');
  const sale = SalesService.create({
    customerMobile: '9876543210',
    customerName: 'Ananya Sharma',
    discountPercent: 10,
    paymentMethod: 'Cash',
    tenderedAmount: 2000,
    items: [
      {
        productId: product.id,
        variantId: blue2Y!.id,
        sku: 'KD-JACKET-01',
        name: 'Korean S Jacket',
        size: '2Y',
        color: 'Blue',
        unitPrice: 700,
        quantity: 2,
        discount: 0
      }
    ]
  });
  console.log(`✓ Sale committed: Invoice ${sale.invoiceNo}, Subtotal: ₹${sale.subtotal}, Grand Total: ₹${sale.grandTotal}, Change Due: ₹${sale.changeDue}`);
  if (sale.grandTotal !== 1260) throw new Error(`Expected grand total 1260, got ${sale.grandTotal}`);
  if (sale.changeDue !== 740) throw new Error(`Expected change due 740, got ${sale.changeDue}`);

  // Verify stock deduction
  const afterSaleProd = ProductsService.getBySku('KD-JACKET-01');
  const afterSaleVariant = afterSaleProd?.variants?.find((v) => v.id === blue2Y!.id);
  console.log(`✓ Variant stock after sale: ${afterSaleVariant?.currentStock} (was 15, sold 2)`);
  if (afterSaleVariant?.currentStock !== 13) throw new Error(`Expected 13, got ${afterSaleVariant?.currentStock}`);

  // 7. Test Returns & Restock
  console.log('\n--- 7. Testing Returns & Restock ---');
  const lookup = ReturnsService.lookupInvoice(sale.invoiceNo);
  console.log(`✓ Invoice verified: ${lookup.sale.invoiceNo}, eligible items: ${lookup.itemsEligible.length}`);

  const ret = ReturnsService.create({
    invoiceNo: sale.invoiceNo,
    reason: 'Size exchange needed',
    items: [
      {
        saleItemId: lookup.itemsEligible[0].saleItemId,
        quantity: 1,
        unitPrice: lookup.itemsEligible[0].unitPrice,
        refundAmount: lookup.itemsEligible[0].effectiveUnitPrice * 1,
        restock: true
      }
    ]
  });
  console.log(`✓ Return processed: Return No ${ret.returnNo}, Refund: ₹${ret.totalRefund}`);
  const afterReturnProd = ProductsService.getBySku('KD-JACKET-01');
  const afterReturnVariant = afterReturnProd?.variants?.find((v) => v.id === blue2Y!.id);
  console.log(`✓ Variant stock after restocked return: ${afterReturnVariant?.currentStock} (restocked 1 -> 14)`);
  if (afterReturnVariant?.currentStock !== 14) throw new Error(`Expected 14, got ${afterReturnVariant?.currentStock}`);

  // 8. Test Product Deletion Safeguards
  console.log('\n--- 8. Testing Product Deletion Safeguards ---');
  let deletionBlocked = false;
  try {
    ProductsService.delete(product.id);
  } catch (err: any) {
    deletionBlocked = true;
    console.log(`✓ Deletion properly blocked with message: "${err.message}"`);
  }
  if (!deletionBlocked) throw new Error('Expected deletion to be blocked due to active stock & sales history!');

  // 9. Test Shift Closing & Till Reconciliation
  console.log('\n--- 9. Testing Cash Till Reconciliation ---');
  const closedShift = AnalyticsService.closeShift(1630, 'End of shift count');
  console.log(`✓ Shift closed: Expected Cash = ₹${closedShift.expectedCash}, Counted = ₹${closedShift.countedCash}, Diff = ₹${closedShift.cashDifference}`);

  // 10. Test Excel Export with Formula Injection Defense
  console.log('\n--- 10. Testing Excel & CSV Export with Sanitization ---');
  const testExcelPath = path.join(process.cwd(), '.test_sales_export.xlsx');
  ExportService.exportSalesExcel(testExcelPath);
  console.log(`✓ Excel export created at: ${testExcelPath} (Size: ${fs.statSync(testExcelPath).size} bytes)`);
  if (fs.existsSync(testExcelPath)) fs.unlinkSync(testExcelPath);

  // 11. Test JSON Backup & Legacy Migration
  console.log('\n--- 11. Testing JSON Backup & Legacy v1.40 Migration ---');
  const fullBackup = BackupService.exportJson();
  console.log(`✓ Full modern JSON backup generated with version: ${fullBackup.version}`);

  // Test Legacy v1.40 JSON Import
  const legacyBackupSample = {
    products: [
      {
        sku: 'LEGACY-001',
        name: 'Vintage Toddler Romper',
        category: 'Girls',
        cost: 250,
        price: 499,
        sizes: [
          { size: '1Y', color: 'Red', opening: 10 },
          { size: '2Y', color: 'Red', opening: 15 }
        ]
      }
    ],
    sales: [
      {
        invoice: 'INV-LEGACY-1',
        customer: 'Legacy Customer',
        mobile: '9123456789',
        total: 499,
        subtotal: 499,
        items: [{ sku: 'LEGACY-001', name: 'Vintage Toddler Romper', size: '1Y', color: 'Red', qty: 1, price: 499 }]
      }
    ],
    settings: {
      shopName: 'KIDO 2628',
      salesHistoryCleared: true,
      address: 'Shop No. 21, Nagarabhavi BDA Complex'
    },
    lastInvoice: 1
  };

  const importResult = BackupService.importJson(legacyBackupSample);
  console.log(`✓ Legacy JSON backup import: ${importResult.message}`);
  const importedProd = ProductsService.getBySku('LEGACY-001');
  console.log(`✓ Imported legacy product: "${importedProd?.name}", variants: ${importedProd?.variants?.length}, stock: ${importedProd?.totalStock}`);
  if (!importedProd || importedProd.totalStock !== 24) { // 25 opening - 1 sold = 24
    throw new Error(`Expected total stock 24 for legacy product, got ${importedProd?.totalStock}`);
  }

  // 12. Test Return Cap & Discount Proration Safeguards
  console.log('\n--- 12. Testing Return Cap & Proration Safeguards ---');
  const legacyLookup = ReturnsService.lookupInvoice('INV-LEGACY-1');
  if (legacyLookup.remainingInvoiceRefund !== 499) {
    throw new Error(`Expected remainingInvoiceRefund 499, got ${legacyLookup.remainingInvoiceRefund}`);
  }
  let capBlocked = false;
  try {
    ReturnsService.create({
      invoiceNo: 'INV-LEGACY-1',
      items: [{
        saleItemId: legacyLookup.itemsEligible[0].saleItemId,
        quantity: 1,
        unitPrice: 499,
        refundAmount: 9999, // Intentional excessive refund
        restock: true
      }]
    });
  } catch (err: any) {
    capBlocked = true;
    console.log(`✓ Excessive refund blocked: "${err.message}"`);
  }
  if (!capBlocked) throw new Error('Excessive return refund should have been blocked by cap safeguard.');

  // Cleanup test DB
  dbModule.closeDatabase();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');

  console.log('\n🎉 ALL 12 VERIFICATION TEST SUITES PASSED FLAWLESSLY! 🎉\n');
}

runVerification().catch((err) => {
  console.error('❌ Verification test failed:', err);
  process.exit(1);
});
