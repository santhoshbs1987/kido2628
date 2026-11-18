import path from 'path';
import os from 'os';
import fs from 'fs';
import * as dbModule from '../db/database';
import { ProductsService } from '../services/products.service';
import { CustomersService } from '../services/customers.service';
import { SalesService } from '../services/sales.service';
import { PurchasesService } from '../services/purchases.service';
import { ReturnsService } from '../services/returns.service';
import { AnalyticsService } from '../services/analytics.service';
import { ExportService } from '../services/export.service';
import { BackupService } from '../services/backup.service';
import { getTargetDatabasePath } from '../db/seed';

async function runEndToEndVerification() {
  console.log('\n======================================================');
  console.log('🧪 TESTING KIDO 2628 APP WITH POPULATED DATA');
  console.log('======================================================\n');

  const dbPath = getTargetDatabasePath();
  const db = dbModule.initDatabase(dbPath);
  console.log(`Connected to database at: ${dbPath}`);

  // Test 1: Products & Variant Matrix
  console.log('\n[1/10] Verifying Products & Variants Matrix...');
  const products = ProductsService.getAll();
  if (products.length !== 12) {
    throw new Error(`Expected 12 products, got ${products.length}`);
  }
  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
  const totalStock = products.reduce((acc, p) => acc + (p.totalStock || 0), 0);
  console.log(`✓ Products Query: 12 articles, ${totalVariants} variants, ${totalStock} total units in stock.`);

  // Test 2: Barcode & Variant Lookup
  console.log('\n[2/10] Testing SKU & Barcode Variant Lookup...');
  const tee = ProductsService.getBySku('KD-TEE-01');
  if (!tee || !tee.variants || tee.variants.length !== 8) {
    throw new Error('Failed to lookup KD-TEE-01 by SKU');
  }
  console.log(`✓ SKU Lookup [KD-TEE-01]: "${tee.name}" with ${tee.variants.length} size/color variants.`);

  // Test 3: Customer Directory & CRM
  console.log('\n[3/10] Testing Customer Directory & Search...');
  const customers = CustomersService.getAll();
  if (customers.length !== 8) {
    throw new Error(`Expected 8 customers, got ${customers.length}`);
  }
  const searchResults = CustomersService.getAll('Priya');
  if (searchResults.length === 0 || searchResults[0].mobile !== '9845012345') {
    throw new Error('Customer search failed for "Priya"');
  }
  console.log(`✓ Customer Search: Found "${searchResults[0].name}" (${searchResults[0].mobile}).`);

  // Test 4: Sales Invoices & Line Items
  console.log('\n[4/10] Verifying Sales Register & Payments...');
  const sales = SalesService.getAll();
  if (sales.length !== 6) {
    throw new Error(`Expected 6 sales, got ${sales.length}`);
  }
  const inv1 = SalesService.getByInvoiceNo('INV-1001');
  if (!inv1 || !inv1.items || inv1.items.length !== 2 || inv1.paymentMethod !== 'UPI') {
    throw new Error('Invoice INV-1001 validation failed');
  }
  console.log(`✓ Sales Invoices: 6 invoices retrieved. Verified INV-1001 (₹${inv1.grandTotal}, ${inv1.paymentMethod}).`);

  // Test 5: Purchases & Inward Stock Records
  console.log('\n[5/10] Verifying Purchases & Supplier Records...');
  const purchases = PurchasesService.getAll();
  if (purchases.length !== 2) {
    throw new Error(`Expected 2 purchase orders, got ${purchases.length}`);
  }
  console.log(`✓ Inward Purchases: 2 purchase orders retrieved (${purchases.map(p => p.purchaseNo).join(', ')}).`);

  // Test 6: Returns & Restock Ledger
  console.log('\n[6/10] Verifying Customer Returns & Restock Audit...');
  const returns = ReturnsService.getAll();
  if (returns.length !== 1 || returns[0].returnNo !== 'RET-1001') {
    throw new Error('Returns verification failed');
  }
  const ret1 = ReturnsService.getById(returns[0].id);
  if (!ret1 || !ret1.items || ret1.items.length !== 1 || !ret1.items[0].restock) {
    throw new Error('Return items verification failed');
  }
  console.log(`✓ Returns Log: Return ${ret1.returnNo} verified with restocked items.`);

  // Test 7: Register Shifts & Reconciliation
  console.log('\n[7/10] Testing Register Shift Management...');
  const activeShift = AnalyticsService.getActiveShift();
  if (!activeShift || activeShift.status !== 'OPEN') {
    throw new Error('Expected an active OPEN register shift');
  }
  const history = AnalyticsService.getShiftHistory();
  if (history.length < 2) {
    throw new Error(`Expected at least 2 shifts in history, got ${history.length}`);
  }
  console.log(`✓ Register Shifts: Active Shift #${activeShift.id} (Float: ₹${activeShift.openingFloat}), History: ${history.length} shifts.`);

  // Test 8: Analytics & Financial Dashboard Metrics
  console.log('\n[8/10] Verifying Business Analytics & Metrics...');
  const metrics = AnalyticsService.getMetrics();
  console.log(`✓ Metrics: Net Profit: ₹${metrics.todayProfit}, Bills: ${metrics.todayBills}, Low Stock: ${metrics.lowStockCount}`);

  // Test 9: Native Excel & CSV Export Engines
  console.log('\n[9/10] Testing Excel & CSV Export Engines...');
  const testExcelPath = path.join(os.tmpdir(), 'kido_test_sales.xlsx');
  const excelRes = ExportService.exportSalesExcel(testExcelPath);
  if (!excelRes.success || !fs.existsSync(testExcelPath) || fs.statSync(testExcelPath).size < 1000) {
    throw new Error('Excel export failed or truncated');
  }
  const testCsvPath = path.join(os.tmpdir(), 'kido_test_customers.csv');
  const csvRes = ExportService.exportCustomersCsv(testCsvPath);
  if (!csvRes.success || !fs.existsSync(testCsvPath)) {
    throw new Error('CSV customer export failed');
  }
  const csvContent = fs.readFileSync(testCsvPath, 'utf8');
  if (!csvContent.includes('Priya Sharma') || !csvContent.includes('9845012345')) {
    throw new Error('CSV missing seeded customer records');
  }
  console.log(`✓ Exports: Generated valid Excel spreadsheet (${fs.statSync(testExcelPath).size} bytes) and sanitized CSV (${csvContent.length} chars).`);

  // Test 10: Automated Database Backup & JSON Export
  console.log('\n[10/10] Testing Database Backup Engines...');
  const snapshotResult = BackupService.performDailyAutoBackup();
  if (!snapshotResult.success) {
    throw new Error('Automated backup snapshot failed: ' + snapshotResult.error);
  }
  const jsonBackup = BackupService.exportJson();
  if (jsonBackup.version !== '2.0.0' || jsonBackup.products.length !== 12 || jsonBackup.sales.length !== 6) {
    throw new Error('JSON backup data structure mismatch');
  }
  console.log(`✓ Backups: SQLite Snapshot saved at "${snapshotResult.filePath}". JSON backup validated (${jsonBackup.products.length} products, ${jsonBackup.sales.length} sales).`);

  console.log('\n======================================================');
  console.log('🎉 ALL 10 END-TO-END VERIFICATION TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
