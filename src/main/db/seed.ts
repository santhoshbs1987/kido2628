import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import * as dbModule from './database';
import { runMigrations } from './migrations';
import { ProductsService } from '../services/products.service';
import { CustomersService } from '../services/customers.service';
import { PurchasesService } from '../services/purchases.service';
import { SalesService } from '../services/sales.service';
import { ReturnsService } from '../services/returns.service';
import { SettingsService } from '../services/settings.service';
import { AnalyticsService } from '../services/analytics.service';

export function getTargetDatabasePath(): string {
  if (process.argv[2]) {
    return path.resolve(process.argv[2]);
  }
  // If app is available, use app.getPath('userData')
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'kido2628.sqlite');
    }
  } catch (e) {
    // Non-electron environment fallback
  }

  // OS-specific standard fallback
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/kido2628-desktop/kido2628.sqlite');
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'com.kido2628.retail', 'kido2628.sqlite');
  }
  return path.join(process.cwd(), '.data', 'kido2628.sqlite');
}

export function seedDatabase(targetPath?: string): void {
  const dbPath = targetPath || getTargetDatabasePath();
  console.log(`\n======================================================`);
  console.log(`🌸 KIDO 2628 RETAIL APP · EXPERT DATA POPULATION`);
  console.log(`🎯 Target Database: ${dbPath}`);
  console.log(`======================================================\n`);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = dbModule.initDatabase(dbPath);
  runMigrations(db);

  // Clean existing transactional and catalog data for a pristine seed
  db.transaction(() => {
    db.prepare('DELETE FROM return_items').run();
    db.prepare('DELETE FROM returns').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM purchase_items').run();
    db.prepare('DELETE FROM purchases').run();
    db.prepare('DELETE FROM stock_transactions').run();
    db.prepare('DELETE FROM product_variants').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM register_shifts').run();
  })();
  console.log('✓ Cleaned existing tables for fresh seed.');

  // 1. Settings Configuration
  console.log('\n--- 1. Configuring Store Master Settings ---');
  SettingsService.update({
    shopName: 'KIDO 2628 · 基多',
    subtitle: 'Imported Korean & Japanese Kids Wear',
    address: 'Shop No. 21, Ground Floor, BDA Complex, Nagarabhavi 2nd Stage, Bengaluru - 560072',
    phone1: '8147464651',
    phone2: '9008300586',
    upiVpa: '8147464651@upi',
    upiName: 'KIDO 2628',
    receiptPrinter: '',
    labelPrinter: '',
    autoBackupEnabled: true,
    backupPath: path.join(os.homedir(), 'Documents', 'Kido2628_Backups'),
    lowStockThreshold: 3
  });
  console.log('✓ Store settings configured with Bengaluru BDA Complex address and official UPI VPA.');

  // 2. Customers Directory
  console.log('\n--- 2. Populating Customer Directory (CRM) ---');
  const customersData = [
    { name: 'Priya Sharma', mobile: '9845012345' },
    { name: 'Rajesh Menon', mobile: '9731234567' },
    { name: 'Kavitha Reddy', mobile: '9900112233' },
    { name: 'Arjun Narang', mobile: '9611223344' },
    { name: 'Deepa Sundaram', mobile: '9880556677' },
    { name: 'Sneha Venkatesh', mobile: '9742334455' },
    { name: 'Mohammed Farooq', mobile: '9844001122' },
    { name: 'Lakshmi Prasad', mobile: '9980123456' }
  ];

  const createdCustomers: Record<string, any> = {};
  for (const c of customersData) {
    createdCustomers[c.mobile] = CustomersService.create(c);
  }
  console.log(`✓ Created ${customersData.length} retail customers with phone numbers and loyalty profiles.`);

  // 3. Products & Multi-Variant Matrix
  console.log('\n--- 3. Creating Multi-Variant Korean Kids Catalog ---');
  const catalog = [
    // Boys
    {
      sku: 'KD-TEE-01',
      name: 'Seoul Dino Graphic Cotton Tee',
      category: 'Boys',
      costPrice: 380,
      markupPercent: 70.79,
      sellingPrice: 649,
      variants: [
        { size: '1-2Y', color: 'Mint Green', openingStock: 6 },
        { size: '2-3Y', color: 'Mint Green', openingStock: 8 },
        { size: '3-4Y', color: 'Mint Green', openingStock: 4 },
        { size: '1-2Y', color: 'Oatmeal', openingStock: 6 },
        { size: '2-3Y', color: 'Oatmeal', openingStock: 6 },
        { size: '3-4Y', color: 'Oatmeal', openingStock: 4 },
        { size: '2-3Y', color: 'Sky Blue', openingStock: 8 },
        { size: '3-4Y', color: 'Sky Blue', openingStock: 6 }
      ]
    },
    {
      sku: 'KD-JOG-02',
      name: 'Korean Washed Cargo Denim Joggers',
      category: 'Boys',
      costPrice: 520,
      markupPercent: 72.88,
      sellingPrice: 899,
      variants: [
        { size: '2-3Y', color: 'Khaki Beige', openingStock: 5 },
        { size: '3-4Y', color: 'Khaki Beige', openingStock: 6 },
        { size: '5-6Y', color: 'Khaki Beige', openingStock: 4 },
        { size: '2-3Y', color: 'Slate Grey', openingStock: 5 },
        { size: '3-4Y', color: 'Slate Grey', openingStock: 6 },
        { size: '5-6Y', color: 'Slate Grey', openingStock: 4 }
      ]
    },
    {
      sku: 'KD-JCK-03',
      name: 'Tokyo Varsity Wool Blend Bomber Jacket',
      category: 'Boys',
      costPrice: 850,
      markupPercent: 88.12,
      sellingPrice: 1599,
      variants: [
        { size: '2-3Y', color: 'Navy Blue', openingStock: 4 },
        { size: '3-4Y', color: 'Navy Blue', openingStock: 4 },
        { size: '4-5Y', color: 'Navy Blue', openingStock: 3 },
        { size: '2-3Y', color: 'Hunter Green', openingStock: 3 },
        { size: '3-4Y', color: 'Hunter Green', openingStock: 4 }
      ]
    },
    {
      sku: 'KD-SHR-04',
      name: 'Pastel Oxford Pure Linen Shirt',
      category: 'Boys',
      costPrice: 420,
      markupPercent: 78.33,
      sellingPrice: 749,
      variants: [
        { size: '2-3Y', color: 'Butter Cream', openingStock: 5 },
        { size: '3-4Y', color: 'Butter Cream', openingStock: 5 },
        { size: '2-3Y', color: 'Sky Blue', openingStock: 5 },
        { size: '3-4Y', color: 'Sky Blue', openingStock: 5 },
        { size: '2-3Y', color: 'Dusty Pink', openingStock: 4 }
      ]
    },

    // Girls
    {
      sku: 'KD-DRS-05',
      name: 'Korean Floral Cottagecore Tiered Dress',
      category: 'Girls',
      costPrice: 620,
      markupPercent: 93.39,
      sellingPrice: 1199,
      variants: [
        { size: '1-2Y', color: 'Lavender Floral', openingStock: 6 },
        { size: '2-3Y', color: 'Lavender Floral', openingStock: 6 },
        { size: '3-4Y', color: 'Lavender Floral', openingStock: 5 },
        { size: '1-2Y', color: 'Vintage Rose', openingStock: 5 },
        { size: '2-3Y', color: 'Vintage Rose', openingStock: 6 },
        { size: '3-4Y', color: 'Vintage Rose', openingStock: 4 }
      ]
    },
    {
      sku: 'KD-SKT-06',
      name: 'Pleated Suspender Pinafore & Tee Set',
      category: 'Girls',
      costPrice: 580,
      markupPercent: 80.86,
      sellingPrice: 1049,
      variants: [
        { size: '2-3Y', color: 'Caramel Brown', openingStock: 5 },
        { size: '3-4Y', color: 'Caramel Brown', openingStock: 5 },
        { size: '5-6Y', color: 'Caramel Brown', openingStock: 4 },
        { size: '2-3Y', color: 'Charcoal Grey', openingStock: 4 },
        { size: '3-4Y', color: 'Charcoal Grey', openingStock: 5 }
      ]
    },
    {
      sku: 'KD-TOP-07',
      name: 'Puff-Sleeve Ruffle Embroidered Blouse',
      category: 'Girls',
      costPrice: 360,
      markupPercent: 80.28,
      sellingPrice: 649,
      variants: [
        { size: '1-2Y', color: 'Soft Ivory', openingStock: 5 },
        { size: '2-3Y', color: 'Soft Ivory', openingStock: 6 },
        { size: '3-4Y', color: 'Soft Ivory', openingStock: 4 },
        { size: '2-3Y', color: 'Sage Green', openingStock: 5 },
        { size: '3-4Y', color: 'Sage Green', openingStock: 4 }
      ]
    },
    {
      sku: 'KD-FOT-08',
      name: 'Korean Teddy Sherpa Fleece Hooded Coat',
      category: 'Girls',
      costPrice: 950,
      markupPercent: 89.37,
      sellingPrice: 1799,
      variants: [
        { size: '2-3Y', color: 'Cookie Brown', openingStock: 4 },
        { size: '3-4Y', color: 'Cookie Brown', openingStock: 3 },
        { size: '2-3Y', color: 'Vanilla Cream', openingStock: 4 },
        { size: '3-4Y', color: 'Vanilla Cream', openingStock: 3 }
      ]
    },

    // Newborn / Toddler
    {
      sku: 'KD-RMP-09',
      name: 'Organic Cotton Kimono Romper & Beanie',
      category: 'Newborn',
      costPrice: 440,
      markupPercent: 81.59,
      sellingPrice: 799,
      variants: [
        { size: '0-3M', color: 'Oatmeal Speckle', openingStock: 6 },
        { size: '3-6M', color: 'Oatmeal Speckle', openingStock: 6 },
        { size: '6-12M', color: 'Oatmeal Speckle', openingStock: 5 },
        { size: '0-3M', color: 'Blush Pink', openingStock: 5 },
        { size: '3-6M', color: 'Blush Pink', openingStock: 5 },
        { size: '0-3M', color: 'Sage Stripe', openingStock: 5 },
        { size: '3-6M', color: 'Sage Stripe', openingStock: 5 }
      ]
    },
    {
      sku: 'KD-SLP-10',
      name: 'Bamboo Ribbed Two-Way Zipper Sleepsuit',
      category: 'Newborn',
      costPrice: 480,
      markupPercent: 76.88,
      sellingPrice: 849,
      variants: [
        { size: '0-3M', color: 'Olive Green', openingStock: 5 },
        { size: '3-6M', color: 'Olive Green', openingStock: 5 },
        { size: '6-12M', color: 'Olive Green', openingStock: 4 },
        { size: '0-3M', color: 'Mustard Yellow', openingStock: 5 },
        { size: '3-6M', color: 'Mustard Yellow', openingStock: 4 },
        { size: '0-3M', color: 'Cloud White', openingStock: 6 },
        { size: '3-6M', color: 'Cloud White', openingStock: 5 }
      ]
    },
    {
      sku: 'KD-KNT-11',
      name: 'Chunky Knit Wooden Button Cardigan',
      category: 'Newborn',
      costPrice: 650,
      markupPercent: 84.46,
      sellingPrice: 1199,
      variants: [
        { size: '3-6M', color: 'Warm Beige', openingStock: 4 },
        { size: '6-12M', color: 'Warm Beige', openingStock: 4 },
        { size: '1-2Y', color: 'Warm Beige', openingStock: 4 },
        { size: '3-6M', color: 'Terracotta', openingStock: 3 },
        { size: '6-12M', color: 'Terracotta', openingStock: 3 }
      ]
    },

    // Accessories
    {
      sku: 'KD-ACC-12',
      name: 'Korean Anti-Slip Cartoon Crew Socks (3-Pack)',
      category: 'Accessories',
      costPrice: 160,
      markupPercent: 118.13,
      sellingPrice: 349,
      variants: [
        { size: 'S (0-1Y)', color: 'Bear / Bunny / Duck Mix', openingStock: 12 },
        { size: 'M (1-3Y)', color: 'Bear / Bunny / Duck Mix', openingStock: 14 },
        { size: 'L (3-5Y)', color: 'Bear / Bunny / Duck Mix', openingStock: 10 }
      ]
    }
  ];

  const createdProducts: Record<string, any> = {};
  for (const item of catalog) {
    const prod = ProductsService.create(item);
    createdProducts[item.sku] = prod;
    const vCount = prod.variants?.length || 0;
    const sCount = prod.totalStock || 0;
    console.log(` - Created [${prod.sku}] ${prod.name} (${vCount} variants, total ${sCount} units)`);
  }

  // 4. Inward Supplier Purchases (PO Records)
  console.log('\n--- 4. Recording Inward Supplier Purchases & Weighted COGS ---');
  const po1 = PurchasesService.create({
    supplier: 'Seoul Kids Apparel Importers',
    date: '2026-11-12',
    notes: 'Winter catalog batch intake - Korean Dino tees, Cargo joggers & Varsity bombers',
    items: [
      {
        productId: createdProducts['KD-TEE-01'].id,
        variantId: createdProducts['KD-TEE-01'].variants[0].id,
        sku: 'KD-TEE-01',
        size: '1-2Y',
        color: 'Mint Green',
        quantity: 10,
        unitCost: 380
      },
      {
        productId: createdProducts['KD-JOG-02'].id,
        variantId: createdProducts['KD-JOG-02'].variants[0].id,
        sku: 'KD-JOG-02',
        size: '2-3Y',
        color: 'Khaki Beige',
        quantity: 10,
        unitCost: 520
      }
    ]
  });
  console.log(`✓ Logged Purchase Order ${po1.purchaseNo} from ${po1.supplier} (Total: ₹${po1.totalAmount.toLocaleString('en-IN')})`);

  const po2 = PurchasesService.create({
    supplier: 'Dongdaemun Fashion Direct',
    date: '2026-11-14',
    notes: 'Girls festive dresses & Fleece teddy coats intake',
    items: [
      {
        productId: createdProducts['KD-DRS-05'].id,
        variantId: createdProducts['KD-DRS-05'].variants[0].id,
        sku: 'KD-DRS-05',
        size: '1-2Y',
        color: 'Lavender Floral',
        quantity: 8,
        unitCost: 620
      },
      {
        productId: createdProducts['KD-FOT-08'].id,
        variantId: createdProducts['KD-FOT-08'].variants[0].id,
        sku: 'KD-FOT-08',
        size: '2-3Y',
        color: 'Cookie Brown',
        quantity: 6,
        unitCost: 950
      }
    ]
  });
  console.log(`✓ Logged Purchase Order ${po2.purchaseNo} from ${po2.supplier} (Total: ₹${po2.totalAmount.toLocaleString('en-IN')})`);

  // 5. Register Shift 1 (Historical Closed Shift)
  console.log('\n--- 5. Recording Historical Closed Register Shift ---');
  const shift1 = AnalyticsService.openShift(2000, 'Morning shift opened with standard ₹2,000 petty cash float');
  
  // Set opened_at to yesterday
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE register_shifts SET opened_at = ? WHERE id = ?').run(yesterday, shift1.id);

  // 6. Realistic Sales Transactions
  console.log('\n--- 6. Generating Realistic POS Customer Transactions ---');

  // Sale 1: VIP Priya Sharma (UPI)
  const teeVar1 = createdProducts['KD-TEE-01'].variants[1]; // 2-3Y Mint
  const jogVar1 = createdProducts['KD-JOG-02'].variants[0]; // 2-3Y Khaki
  const s1 = SalesService.create({
    customerId: createdCustomers['9845012345'].id,
    customerName: 'Priya Sharma',
    customerMobile: '9845012345',
    paymentMethod: 'UPI',
    items: [
      {
        productId: createdProducts['KD-TEE-01'].id,
        variantId: teeVar1.id,
        sku: 'KD-TEE-01',
        name: createdProducts['KD-TEE-01'].name,
        size: teeVar1.size,
        color: teeVar1.color,
        unitPrice: 649,
        quantity: 1
      },
      {
        productId: createdProducts['KD-JOG-02'].id,
        variantId: jogVar1.id,
        sku: 'KD-JOG-02',
        name: createdProducts['KD-JOG-02'].name,
        size: jogVar1.size,
        color: jogVar1.color,
        unitPrice: 899,
        quantity: 1
      }
    ]
  });
  console.log(`✓ Invoice ${s1.invoiceNo}: Priya Sharma · ₹${s1.grandTotal} (UPI)`);

  // Sale 2: Walk-in Cash Sale
  const fleeceVar1 = createdProducts['KD-FOT-08'].variants[0]; // 2-3Y Cookie Brown
  const s2 = SalesService.create({
    paymentMethod: 'Cash',
    tenderedAmount: 2000,
    changeDue: 201,
    items: [
      {
        productId: createdProducts['KD-FOT-08'].id,
        variantId: fleeceVar1.id,
        sku: 'KD-FOT-08',
        name: createdProducts['KD-FOT-08'].name,
        size: fleeceVar1.size,
        color: fleeceVar1.color,
        unitPrice: 1799,
        quantity: 1
      }
    ]
  });
  console.log(`✓ Invoice ${s2.invoiceNo}: Walk-in Customer · ₹${s2.grandTotal} (Cash tendered: ₹2000, change: ₹201)`);

  // Sale 3: Rajesh Menon (Card) with 5% bill discount
  const rmpVar1 = createdProducts['KD-RMP-09'].variants[0];
  const slpVar1 = createdProducts['KD-SLP-10'].variants[0];
  const kntVar1 = createdProducts['KD-KNT-11'].variants[0];
  const s3 = SalesService.create({
    customerId: createdCustomers['9731234567'].id,
    customerName: 'Rajesh Menon',
    customerMobile: '9731234567',
    discountPercent: 5,
    discountAmount: 142.35,
    paymentMethod: 'Card',
    items: [
      {
        productId: createdProducts['KD-RMP-09'].id,
        variantId: rmpVar1.id,
        sku: 'KD-RMP-09',
        name: createdProducts['KD-RMP-09'].name,
        size: rmpVar1.size,
        color: rmpVar1.color,
        unitPrice: 799,
        quantity: 1
      },
      {
        productId: createdProducts['KD-SLP-10'].id,
        variantId: slpVar1.id,
        sku: 'KD-SLP-10',
        name: createdProducts['KD-SLP-10'].name,
        size: slpVar1.size,
        color: slpVar1.color,
        unitPrice: 849,
        quantity: 1
      },
      {
        productId: createdProducts['KD-KNT-11'].id,
        variantId: kntVar1.id,
        sku: 'KD-KNT-11',
        name: createdProducts['KD-KNT-11'].name,
        size: kntVar1.size,
        color: kntVar1.color,
        unitPrice: 1199,
        quantity: 1
      }
    ]
  });
  console.log(`✓ Invoice ${s3.invoiceNo}: Rajesh Menon · ₹${s3.grandTotal} (Card, 5% Bill Discount)`);

  // Sale 4: Kavitha Reddy (UPI)
  const drsVar1 = createdProducts['KD-DRS-05'].variants[0];
  const topVar1 = createdProducts['KD-TOP-07'].variants[0];
  const s4 = SalesService.create({
    customerId: createdCustomers['9900112233'].id,
    customerName: 'Kavitha Reddy',
    customerMobile: '9900112233',
    paymentMethod: 'UPI',
    items: [
      {
        productId: createdProducts['KD-DRS-05'].id,
        variantId: drsVar1.id,
        sku: 'KD-DRS-05',
        name: createdProducts['KD-DRS-05'].name,
        size: drsVar1.size,
        color: drsVar1.color,
        unitPrice: 1199,
        quantity: 1
      },
      {
        productId: createdProducts['KD-TOP-07'].id,
        variantId: topVar1.id,
        sku: 'KD-TOP-07',
        name: createdProducts['KD-TOP-07'].name,
        size: topVar1.size,
        color: topVar1.color,
        unitPrice: 649,
        quantity: 1
      }
    ]
  });
  console.log(`✓ Invoice ${s4.invoiceNo}: Kavitha Reddy · ₹${s4.grandTotal} (UPI)`);

  // Sale 5: Walk-in Cash Sale (Varsity Bomber) -> will be returned for demonstration
  const bmbVar1 = createdProducts['KD-JCK-03'].variants[0];
  const s5 = SalesService.create({
    paymentMethod: 'Cash',
    tenderedAmount: 2000,
    changeDue: 401,
    items: [
      {
        productId: createdProducts['KD-JCK-03'].id,
        variantId: bmbVar1.id,
        sku: 'KD-JCK-03',
        name: createdProducts['KD-JCK-03'].name,
        size: bmbVar1.size,
        color: bmbVar1.color,
        unitPrice: 1599,
        quantity: 1
      }
    ]
  });
  console.log(`✓ Invoice ${s5.invoiceNo}: Walk-in Customer · ₹${s5.grandTotal} (Cash)`);

  // Sale 6: Deepa Sundaram (Split Payment)
  const sktVar1 = createdProducts['KD-SKT-06'].variants[0];
  const sckVar1 = createdProducts['KD-ACC-12'].variants[1];
  const s6 = SalesService.create({
    customerId: createdCustomers['9880556677'].id,
    customerName: 'Deepa Sundaram',
    customerMobile: '9880556677',
    paymentMethod: 'Split',
    notes: 'Split payment: ₹1,000 Cash + ₹398 PhonePe UPI',
    items: [
      {
        productId: createdProducts['KD-SKT-06'].id,
        variantId: sktVar1.id,
        sku: 'KD-SKT-06',
        name: createdProducts['KD-SKT-06'].name,
        size: sktVar1.size,
        color: sktVar1.color,
        unitPrice: 1049,
        quantity: 1
      },
      {
        productId: createdProducts['KD-ACC-12'].id,
        variantId: sckVar1.id,
        sku: 'KD-ACC-12',
        name: createdProducts['KD-ACC-12'].name,
        size: sckVar1.size,
        color: sckVar1.color,
        unitPrice: 349,
        quantity: 1
      }
    ]
  });
  console.log(`✓ Invoice ${s6.invoiceNo}: Deepa Sundaram · ₹${s6.grandTotal} (Split Payment)`);

  // 7. Process a Return on Invoice 5
  console.log('\n--- 7. Processing Customer Return with Restock & Proration ---');
  const returnLookup = ReturnsService.lookupInvoice(s5.invoiceNo);
  const eligibleItem = returnLookup.itemsEligible[0];
  const returnRes = ReturnsService.create({
    invoiceNo: s5.invoiceNo,
    reason: 'Size too large for child (restocked into active inventory)',
    items: [
      {
        saleItemId: eligibleItem.saleItemId,
        quantity: 1,
        unitPrice: eligibleItem.unitPrice,
        refundAmount: eligibleItem.effectiveUnitPrice,
        restock: true
      }
    ]
  });
  console.log(`✓ Processed Return ${returnRes.returnNo} for ${s5.invoiceNo}: Refunded ₹${returnRes.totalRefund} (Restocked back to shelf)`);

  // Close Shift 1 cleanly
  const currentShiftSummary = AnalyticsService.getActiveShift()!;
  const countedCash = currentShiftSummary.expectedCash;
  const closedShift1 = AnalyticsService.closeShift(countedCash, 'End of day till balanced with exact count');
  console.log(`✓ Reconciled & Closed Shift #${closedShift1.id}: Expected Cash: ₹${closedShift1.expectedCash}, Counted: ₹${closedShift1.countedCash}, Variance: ₹${closedShift1.cashDifference}`);

  // 8. Open Active Shift for Today (Shift 2)
  console.log('\n--- 8. Opening Active Morning Register Shift for Today ---');
  const todayShift = AnalyticsService.openShift(2000, 'Morning register float initialized at ₹2,000 for today');
  console.log(`✓ Active Register Shift #${todayShift.id} is OPEN with ₹2,000 float. Cashiers can immediately bill.`);

  // 9. Financial Analytics & Database Verification
  console.log('\n======================================================');
  console.log('📊 FINANCIAL AUDIT & DATABASE INTEGRITY SUMMARY');
  console.log('======================================================');

  const metrics = AnalyticsService.getMetrics();
  const prodRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
  const variantRow = db.prepare('SELECT COUNT(*) as count, SUM(current_stock) as total_units FROM product_variants').get() as any;
  const valuationRow = db.prepare(`
    SELECT
      ROUND(SUM(p.cost_price * v.current_stock), 2) as cost_val,
      ROUND(SUM(p.selling_price * v.current_stock), 2) as retail_val
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
  `).get() as any;
  const salesRow = db.prepare('SELECT COUNT(*) as count, SUM(grand_total) as gross FROM sales').get() as any;
  const returnRow = db.prepare('SELECT COUNT(*) as count, SUM(total_refund) as refunds FROM returns WHERE is_voided = 0').get() as any;

  const totalProducts = prodRow.count;
  const totalVariants = variantRow.count;
  const totalStockUnits = variantRow.total_units;
  const inventoryCostVal = valuationRow.cost_val;
  const inventoryRetailVal = valuationRow.retail_val;
  const totalGross = salesRow.gross || 0;
  const totalRefunds = returnRow.refunds || 0;
  const totalNet = Math.round((totalGross - totalRefunds) * 100) / 100;

  console.log(`\n• Total Master Products           : ${totalProducts} articles`);
  console.log(`• Total Variant Combinations      : ${totalVariants} SKU-size-color variants`);
  console.log(`• Total Physical Garments on Hand : ${totalStockUnits} units`);
  console.log(`• Inventory Asset Cost Valuation  : ₹${inventoryCostVal.toLocaleString('en-IN')}`);
  console.log(`• Inventory Retail MRP Valuation  : ₹${inventoryRetailVal.toLocaleString('en-IN')}`);
  console.log(`• Gross Sales Revenue             : ₹${totalGross.toLocaleString('en-IN')} (${salesRow.count} invoices)`);
  console.log(`• Returns & Refunds Processed     : ₹${totalRefunds.toLocaleString('en-IN')} (${returnRow.count} return)`);
  console.log(`• Net Retail Sales Revenue        : ₹${totalNet.toLocaleString('en-IN')}`);
  console.log(`• Net Realized Profit (Post-COGS) : ₹${metrics.todayProfit.toLocaleString('en-IN')}`);
  console.log(`• Low-Stock Alerts (< threshold)  : ${metrics.lowStockCount} variants`);
  console.log(`• Active Register Shift           : Shift #${metrics.activeShift?.id} (${metrics.activeShift?.status}, Float: ₹${metrics.activeShift?.openingFloat})`);

  console.log('\n🎉 EXPERT DATA POPULATION COMPLETED SUCCESSFULLY! 🎉\n');
}

// Allow direct CLI execution
if (require.main === module) {
  seedDatabase();
}
