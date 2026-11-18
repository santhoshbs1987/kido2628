import { getDb } from '../db/database';
import { ShopSettings } from '../db/schema';
import { BrowserWindow } from 'electron';
import { execSync } from 'child_process';

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
  printFormat?: 'THERMAL_72MM' | 'A4_INVOICE' | 'A5_BILL';
  labelFormat?: 'ROLL_63X34' | 'A4_SHEET_24';
  autoBackupEnabled?: boolean;
  backupPath?: string;
  lowStockThreshold?: number;
}

export interface DetectedPrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
  printerType: 'DESKTOP_INKJET_LASER' | 'THERMAL_POS' | 'LABEL_PRINTER' | 'GENERIC';
  description: string;
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
      printFormat: (row.print_format as any) || 'A4_INVOICE',
      labelFormat: (row.label_format as any) || 'ROLL_63X34',
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
      printFormat: input.printFormat ?? current.printFormat,
      labelFormat: input.labelFormat ?? current.labelFormat,
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
        print_format = ?,
        label_format = ?,
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
      updated.printFormat,
      updated.labelFormat,
      updated.autoBackupEnabled ? 1 : 0,
      updated.backupPath.trim(),
      Math.max(0, updated.lowStockThreshold),
      now
    );

    return SettingsService.get();
  }

  static classifyPrinter(name: string): { type: DetectedPrinterInfo['printerType']; desc: string } {
    const lower = name.toLowerCase();
    if (/l380|l3110|l3210|l130|l3150|epson l|inktank|ecotank|laserjet|deskjet|pixma|smart tank/i.test(lower)) {
      return {
        type: 'DESKTOP_INKJET_LASER',
        desc: 'All-in-One InkTank / Laser Printer (A4 & A5 Sheet-Fed)'
      };
    }
    if (/pos|thermal|receipt|t82|t88|xprinter|rongta|citizen|tvs|rp3200|bixolon/i.test(lower)) {
      return {
        type: 'THERMAL_POS',
        desc: 'Thermal POS Receipt Printer (72mm / 80mm Roll)'
      };
    }
    if (/tsc|zebra|label|barcode|godex|argox|gx420|zd220|te244/i.test(lower)) {
      return {
        type: 'LABEL_PRINTER',
        desc: 'Dedicated Barcode Sticker Printer (63mm × 34mm Roll)'
      };
    }
    return {
      type: 'GENERIC',
      desc: 'Standard Desktop / Office Document Printer'
    };
  }

  static getSystemPrintersCli(): DetectedPrinterInfo[] {
    const printers: string[] = [];
    let defaultPrinter = '';

    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        const output = execSync('lpstat -p -d', { timeout: 4000, encoding: 'utf8' });
        for (const line of output.split('\n')) {
          const defMatch = line.match(/system default destination:\s*(.+)/i);
          if (defMatch) defaultPrinter = defMatch[1].trim();
          const pMatch = line.match(/^printer\s+([^\s]+)/i);
          if (pMatch) printers.push(pMatch[1].trim());
        }
      } else if (process.platform === 'win32') {
        const psCmd = 'Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json';
        const output = execSync(`powershell -NoProfile -Command "${psCmd}"`, { timeout: 5000, encoding: 'utf8' });
        const parsed = JSON.parse(output);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const p of list) {
          if (p && p.Name) {
            printers.push(p.Name);
            if (p.Default) defaultPrinter = p.Name;
          }
        }
      }
    } catch (e) {
      console.error('System CLI printer query error:', e);
    }

    return Array.from(new Set(printers)).map((name) => {
      const { type, desc } = SettingsService.classifyPrinter(name);
      const isDef = name === defaultPrinter || name.replace(/_/g, ' ') === defaultPrinter;
      return {
        name,
        displayName: name.replace(/_/g, ' '),
        isDefault: isDef,
        printerType: type,
        description: desc
      };
    });
  }

  static async getPrinters(win?: BrowserWindow | null): Promise<DetectedPrinterInfo[]> {
    const results: Map<string, DetectedPrinterInfo> = new Map();

    // 1. Try Electron webContents API
    try {
      if (win && !win.isDestroyed()) {
        const electronPrinters = await win.webContents.getPrintersAsync();
        for (const p of electronPrinters) {
          const { type, desc } = SettingsService.classifyPrinter(p.name);
          results.set(p.name, {
            name: p.name,
            displayName: p.displayName || p.name.replace(/_/g, ' '),
            isDefault: Boolean(p.isDefault),
            printerType: type,
            description: desc
          });
        }
      }
    } catch (e) {
      console.error('Failed to get printers via webContents:', e);
    }

    // 2. Merge with System CLI fallback to guarantee complete list
    const cliPrinters = SettingsService.getSystemPrintersCli();
    for (const cp of cliPrinters) {
      if (!results.has(cp.name) && !results.has(cp.displayName)) {
        results.set(cp.name, cp);
      } else if (cp.isDefault) {
        // Ensure default flag is marked correctly
        const existing = results.get(cp.name) || results.get(cp.displayName);
        if (existing) existing.isDefault = true;
      }
    }

    return Array.from(results.values()).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }

  static async autoDetectAndConfigure(win?: BrowserWindow | null): Promise<{
    detected: DetectedPrinterInfo | null;
    allPrinters: DetectedPrinterInfo[];
    updatedSettings: ShopSettings;
  }> {
    const allPrinters = await SettingsService.getPrinters(win);
    const targetPrinter = allPrinters.find((p) => p.isDefault) || allPrinters[0] || null;

    if (!targetPrinter) {
      return {
        detected: null,
        allPrinters: [],
        updatedSettings: SettingsService.get()
      };
    }

    // Configure optimal settings based on printer type
    let printFormat: 'THERMAL_72MM' | 'A4_INVOICE' | 'A5_BILL' = 'A4_INVOICE';
    let labelFormat: 'ROLL_63X34' | 'A4_SHEET_24' = 'A4_SHEET_24';

    if (targetPrinter.printerType === 'THERMAL_POS') {
      printFormat = 'THERMAL_72MM';
      labelFormat = 'ROLL_63X34';
    } else if (targetPrinter.printerType === 'LABEL_PRINTER') {
      labelFormat = 'ROLL_63X34';
    } else {
      // Desktop InkJet / Laser like Epson L380
      printFormat = 'A4_INVOICE';
      labelFormat = 'A4_SHEET_24';
    }

    const updatedSettings = SettingsService.update({
      receiptPrinter: targetPrinter.name,
      labelPrinter: targetPrinter.name,
      printFormat,
      labelFormat
    });

    return {
      detected: targetPrinter,
      allPrinters,
      updatedSettings
    };
  }
}
