import { ipcMain, dialog, BrowserWindow } from 'electron';
import { ProductsService } from '../services/products.service';
import { InventoryService } from '../services/inventory.service';
import { SalesService } from '../services/sales.service';
import { PurchasesService } from '../services/purchases.service';
import { ReturnsService } from '../services/returns.service';
import { CustomersService } from '../services/customers.service';
import { AnalyticsService } from '../services/analytics.service';
import { SettingsService } from '../services/settings.service';
import { BackupService } from '../services/backup.service';
import { ExportService } from '../services/export.service';
import { PrintService } from '../services/print.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
  FastStockInSchema,
  CreateSaleSchema,
  CreatePurchaseSchema,
  CreateReturnSchema,
  CustomerSchema,
  UpdateSettingsSchema
} from './schemas';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Products
  ipcMain.handle('products:getAll', async (_, filters) => {
    try {
      const data = ProductsService.getAll(filters);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('products:getBySku', async (_, sku) => {
    try {
      const data = ProductsService.getBySku(sku);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('products:getById', async (_, id) => {
    try {
      const data = ProductsService.getById(id);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('products:create', async (_, input) => {
    try {
      const validated = CreateProductSchema.parse(input);
      const data = ProductsService.create(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('products:update', async (_, input) => {
    try {
      const validated = UpdateProductSchema.parse(input);
      const data = ProductsService.update(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('products:delete', async (_, id) => {
    try {
      const res = ProductsService.delete(Number(id));
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('products:getCategories', async () => {
    try {
      const data = ProductsService.getCategories();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Inventory
  ipcMain.handle('inventory:fastStockIn', async (_, input) => {
    try {
      const validated = FastStockInSchema.parse(input);
      const data = InventoryService.fastStockIn(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('inventory:getLowStock', async (_, threshold) => {
    try {
      const data = InventoryService.getLowStock(threshold);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('inventory:getTransactions', async (_, filter) => {
    try {
      const data = InventoryService.getStockTransactions(filter?.variantId, filter?.sku);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Sales
  ipcMain.handle('sales:getNextInvoiceNo', async () => {
    try {
      const data = SalesService.getNextInvoiceNo();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sales:create', async (_, input) => {
    try {
      const validated = CreateSaleSchema.parse(input);
      const sale = SalesService.create(validated);

      // Trigger automatic silent receipt print if enabled in settings
      const settings = SettingsService.get();
      if (settings.receiptPrinter) {
        PrintService.printReceipt(sale, { silent: true, deviceName: settings.receiptPrinter }).catch((err) =>
          console.error('Silent receipt print error:', err)
        );
      }

      return { success: true, data: sale };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sales:getAll', async (_, filters) => {
    try {
      const data = SalesService.getAll(filters);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sales:getByInvoiceNo', async (_, invoiceNo) => {
    try {
      const data = SalesService.getByInvoiceNo(invoiceNo);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Purchases
  ipcMain.handle('purchases:create', async (_, input) => {
    try {
      const validated = CreatePurchaseSchema.parse(input);
      const data = PurchasesService.create(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('purchases:getAll', async (_, filters) => {
    try {
      const data = PurchasesService.getAll(filters);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('purchases:delete', async (_, id) => {
    try {
      const data = PurchasesService.delete(Number(id));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Returns
  ipcMain.handle('returns:lookupInvoice', async (_, invoiceNo) => {
    try {
      const data = ReturnsService.lookupInvoice(invoiceNo);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('returns:create', async (_, input) => {
    try {
      const validated = CreateReturnSchema.parse(input);
      const data = ReturnsService.create(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('returns:getAll', async (_, filters) => {
    try {
      const data = ReturnsService.getAll(filters);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('returns:void', async (_, id) => {
    try {
      const data = ReturnsService.voidReturn(Number(id));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Customers
  ipcMain.handle('customers:getAll', async (_, search) => {
    try {
      const data = CustomersService.getAll(search);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('customers:findByMobile', async (_, mobile) => {
    try {
      const data = CustomersService.findByMobile(mobile);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('customers:create', async (_, input) => {
    try {
      const validated = CustomerSchema.parse(input);
      const data = CustomersService.create(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('customers:update', async (_, { id, data }) => {
    try {
      const validated = CustomerSchema.parse(data);
      const res = CustomersService.update(Number(id), validated);
      return { success: true, data: res };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('customers:delete', async (_, id) => {
    try {
      const data = CustomersService.delete(Number(id));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Analytics & Shifts
  ipcMain.handle('analytics:getMetrics', async (_, { fromDate, toDate }) => {
    try {
      const data = AnalyticsService.getMetrics(fromDate, toDate);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('analytics:getActiveShift', async () => {
    try {
      const data = AnalyticsService.getActiveShift();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('analytics:openShift', async (_, { openingFloat, notes }) => {
    try {
      const data = AnalyticsService.openShift(openingFloat, notes);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('analytics:closeShift', async (_, { countedCash, notes }) => {
    try {
      const data = AnalyticsService.closeShift(countedCash, notes);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('analytics:getShiftHistory', async () => {
    try {
      const data = AnalyticsService.getShiftHistory();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Settings & Printers
  ipcMain.handle('settings:get', async () => {
    try {
      const data = SettingsService.get();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:update', async (_, input) => {
    try {
      const validated = UpdateSettingsSchema.parse(input);
      const data = SettingsService.update(validated);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:getPrinters', async () => {
    try {
      const data = await SettingsService.getPrinters(mainWindow);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Backups & Exports
  ipcMain.handle('backup:exportJson', async () => {
    try {
      const saveDialog = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Full Database Backup (JSON)',
        defaultPath: `kido2628_backup_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const json = BackupService.exportJson();
      const fs = await import('fs');
      fs.writeFileSync(saveDialog.filePath, JSON.stringify(json, null, 2), 'utf8');

      return { success: true, data: { filePath: saveDialog.filePath } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backup:importJson', async () => {
    try {
      const openDialog = await dialog.showOpenDialog(mainWindow, {
        title: 'Restore Database Backup (JSON)',
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        properties: ['openFile']
      });

      if (openDialog.canceled || openDialog.filePaths.length === 0) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const fs = await import('fs');
      const content = fs.readFileSync(openDialog.filePaths[0], 'utf8');
      const parsed = JSON.parse(content);

      const result = BackupService.importJson(parsed);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backup:exportSqlite', async () => {
    try {
      const saveDialog = await dialog.showSaveDialog(mainWindow, {
        title: 'Export SQLite Database File',
        defaultPath: `kido2628_db_${new Date().toISOString().slice(0, 10)}.sqlite`,
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const result = BackupService.exportSqliteBackup(saveDialog.filePath);
      return { success: result.success, data: { filePath: saveDialog.filePath }, error: result.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backup:importSqlite', async () => {
    try {
      const openDialog = await dialog.showOpenDialog(mainWindow, {
        title: 'Restore SQLite Database File',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
      });

      if (openDialog.canceled || openDialog.filePaths.length === 0) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const result = BackupService.importSqliteBackup(openDialog.filePaths[0]);
      return { success: result.success, error: result.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Excel / CSV Exports
  ipcMain.handle('export:sales', async (_, filters) => {
    try {
      const saveDialog = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Sales Register to Excel',
        defaultPath: `KIDO_Sales_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const data = ExportService.exportSalesExcel(saveDialog.filePath, filters);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('export:products', async () => {
    try {
      const saveDialog = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Inventory to Excel',
        defaultPath: `KIDO_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const data = ExportService.exportProductsExcel(saveDialog.filePath);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('export:purchases', async (_, filters) => {
    try {
      const saveDialog = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Purchases to Excel',
        defaultPath: `KIDO_Purchases_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const data = ExportService.exportPurchasesExcel(saveDialog.filePath, filters);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('export:customers', async () => {
    try {
      const saveDialog = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Customers to CSV',
        defaultPath: `KIDO_Customers_${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV File', extensions: ['csv'] }]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { success: false, error: 'Cancelled by user.' };
      }

      const data = ExportService.exportCustomersCsv(saveDialog.filePath);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Print Services
  ipcMain.handle('print:receipt', async (_, { sale, options }) => {
    try {
      const data = await PrintService.printReceipt(sale, options);
      return { success: data.success, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('print:labels', async (_, { html, options }) => {
    try {
      const data = await PrintService.printBarcodeLabels(html, options);
      return { success: data.success, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
