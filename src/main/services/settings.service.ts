import { getDb } from '../db/database';
import { ShopSettings } from '../db/schema';
import { BrowserWindow } from 'electron';

export interface UpdateSettingsInput {
  shopName?: string;
  subtitle?: string;
  address?: string;
  phone1?: string;
  phone2?: string;
  upiVpa?: string;
  upiName?: string;
  receiptPrinter?: string;
  labelPrinter?: string;
  autoBackupEnabled?: boolean;
  backupPath?: string;
  lowStockThreshold?: number;
}

export class SettingsService {
  static get(): ShopSettings {
    const db = getDb();
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    if (!row) {
      throw new Error('Settings row not found in database.');
    }
    return {
      id: row.id,
      shopName: row.shop_name,
      subtitle: row.subtitle,
      address: row.address,
      phone1: row.phone1,
      phone2: row.phone2,
      upiVpa: row.upi_vpa,
      upiName: row.upi_name,
      receiptPrinter: row.receipt_printer || '',
      labelPrinter: row.label_printer || '',
      autoBackupEnabled: Boolean(row.auto_backup_enabled),
      backupPath: row.backup_path || '',
      lowStockThreshold: row.low_stock_threshold || 3,
      updatedAt: row.updated_at
    };
  }

  static update(input: UpdateSettingsInput): ShopSettings {
    const db = getDb();
    const current = SettingsService.get();
    const now = new Date().toISOString();

    const updated = {
      shopName: input.shopName ?? current.shopName,
      subtitle: input.subtitle ?? current.subtitle,
      address: input.address ?? current.address,
      phone1: input.phone1 ?? current.phone1,
      phone2: input.phone2 ?? current.phone2,
      upiVpa: input.upiVpa ?? current.upiVpa,
      upiName: input.upiName ?? current.upiName,
      receiptPrinter: input.receiptPrinter ?? current.receiptPrinter,
      labelPrinter: input.labelPrinter ?? current.labelPrinter,
      autoBackupEnabled: input.autoBackupEnabled !== undefined ? input.autoBackupEnabled : current.autoBackupEnabled,
      backupPath: input.backupPath ?? current.backupPath,
      lowStockThreshold: input.lowStockThreshold ?? current.lowStockThreshold
    };

    db.prepare(`
      UPDATE settings
      SET
        shop_name = ?,
        subtitle = ?,
        address = ?,
        phone1 = ?,
        phone2 = ?,
        upi_vpa = ?,
        upi_name = ?,
        receipt_printer = ?,
        label_printer = ?,
        auto_backup_enabled = ?,
        backup_path = ?,
        low_stock_threshold = ?,
        updated_at = ?
      WHERE id = 1
    `).run(
      updated.shopName.trim(),
      updated.subtitle.trim(),
      updated.address.trim(),
      updated.phone1.trim(),
      updated.phone2.trim(),
      updated.upiVpa.trim(),
      updated.upiName.trim(),
      updated.receiptPrinter.trim(),
      updated.labelPrinter.trim(),
      updated.autoBackupEnabled ? 1 : 0,
      updated.backupPath.trim(),
      Math.max(0, updated.lowStockThreshold),
      now
    );

    return SettingsService.get();
  }

  static async getPrinters(win?: BrowserWindow | null): Promise<Array<{ name: string; isDefault: boolean }>> {
    try {
      if (win && !win.isDestroyed()) {
        const printers = await win.webContents.getPrintersAsync();
        return printers.map((p: any) => ({
          name: p.name,
          isDefault: Boolean(p.isDefault)
        }));
      }
    } catch (e) {
      console.error('Failed to get printers via webContents:', e);
    }
    return [];
  }
}
