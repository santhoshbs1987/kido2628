import { BrowserWindow } from 'electron';
import { SettingsService } from './settings.service';
import { Sale } from '../db/schema';
import QRCode from 'qrcode';

export interface PrintReceiptOptions {
  silent?: boolean;
  deviceName?: string;
  format?: 'THERMAL_72MM' | 'A4_INVOICE' | 'A5_BILL';
}

export interface PrintLabelOptions {
  silent?: boolean;
  deviceName?: string;
  format?: 'ROLL_63X34' | 'A4_SHEET_24';
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class PrintService {
  static async printReceipt(sale: Sale, options?: PrintReceiptOptions): Promise<{ success: boolean; error?: string }> {
    const settings = SettingsService.get();
    const printerName = options?.deviceName || settings.receiptPrinter || undefined;
    const isSilent = options?.silent !== undefined ? options.silent : Boolean(printerName);
    const format = options?.format || settings.printFormat || 'A4_INVOICE';

    // Create offscreen/hidden window sized for the target paper format
    const isA4 = format === 'A4_INVOICE';
    const isA5 = format === 'A5_BILL';
    const winWidth = isA4 ? 800 : isA5 ? 700 : 380;
    const winHeight = isA4 ? 1100 : isA5 ? 500 : 700;

    const printWin = new BrowserWindow({
      show: false,
      width: winWidth,
      height: winHeight,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    const receiptHtml = await PrintService.generateReceiptHtml(sale, settings, format);

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`);

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            if (!printWin.isDestroyed()) printWin.destroy();
          } catch (e) {}
          resolve({ success: false, error: 'Print operation timed out.' });
        }
      }, 20000);

      const printOptions: Electron.WebContentsPrintOptions = {
        silent: isSilent,
        printBackground: true,
        deviceName: printerName,
        margins: isA4 || isA5 ? { marginType: 'printableArea' } : { marginType: 'none' },
        landscape: isA5
      };

      if (isA4) {
        printOptions.pageSize = 'A4';
      } else if (isA5) {
        printOptions.pageSize = 'A5';
      }

      printWin.webContents.print(printOptions, (success, failureReason) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try {
            if (!printWin.isDestroyed()) printWin.destroy();
          } catch (e) {}
          if (!success) {
            resolve({ success: false, error: failureReason });
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  }

  static async printBarcodeLabels(labelsHtml: string, options?: PrintLabelOptions): Promise<{ success: boolean; error?: string }> {
    const settings = SettingsService.get();
    const printerName = options?.deviceName || settings.labelPrinter || undefined;
    const isSilent = options?.silent !== undefined ? options.silent : Boolean(printerName);
    const format = options?.format || settings.labelFormat || 'ROLL_63X34';
    const isA4Sheet = format === 'A4_SHEET_24';

    const printWin = new BrowserWindow({
      show: false,
      width: isA4Sheet ? 850 : 420,
      height: isA4Sheet ? 1150 : 600,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    let fullHtml = '';
    if (isA4Sheet) {
      // 24-Up A4 Sticker Grid (3 columns x 8 rows) for desktop printers like Epson L380
      fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Barcode Sticker Sheet (A4)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 7mm;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: Arial, sans-serif;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(3, 63.5mm);
              grid-auto-rows: 34mm;
              column-gap: 2.5mm;
              row-gap: 0;
              justify-content: center;
            }
            .label-cell {
              width: 63.5mm;
              height: 34mm;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${labelsHtml}
          </div>
        </body>
        </html>
      `;
    } else {
      // Dedicated roll printer (63mm x 34mm per page)
      fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Barcode Labels</title>
          <style>
            @page {
              size: 63mm 34mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: #fff;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
        </body>
        </html>
      `;
    }

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            if (!printWin.isDestroyed()) printWin.destroy();
          } catch (e) {}
          resolve({ success: false, error: 'Print operation timed out.' });
        }
      }, 20000);

      const printOptions: Electron.WebContentsPrintOptions = {
        silent: isSilent,
        printBackground: true,
        deviceName: printerName,
        margins: isA4Sheet ? { marginType: 'printableArea' } : { marginType: 'none' }
      };

      if (isA4Sheet) {
        printOptions.pageSize = 'A4';
      }

      printWin.webContents.print(printOptions, (success, failureReason) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try {
            if (!printWin.isDestroyed()) printWin.destroy();
          } catch (e) {}
          if (!success) {
            resolve({ success: false, error: failureReason });
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  }

  static async testPrint(printerName?: string, type: 'receipt' | 'label' = 'receipt'): Promise<{ success: boolean; error?: string }> {
    const settings = SettingsService.get();
    const targetDevice = printerName || settings.receiptPrinter || undefined;

    if (type === 'receipt') {
      const sampleSale: Sale = {
        id: 99999,
        invoiceNo: 'TEST-1001',
        customerId: null,
        customerName: 'Store Test Verification',
        customerMobile: '9845012345',
        subtotal: 1298,
        discountPercent: 0,
        discountAmount: 0,
        grandTotal: 1298,
        paymentMethod: 'Test / Diagnostic',
        tenderedAmount: 1500,
        changeDue: 202,
        totalCogs: 760,
        notes: 'Test print sent from KIDO 2628 Settings',
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 1,
            saleId: 99999,
            productId: 1,
            variantId: 1,
            sku: 'KD-TEE-01',
            name: 'Seoul Dino Graphic Cotton Tee',
            size: '2-3Y',
            color: 'Mint Green',
            unitCost: 380,
            unitPrice: 649,
            quantity: 2,
            discount: 0,
            lineTotal: 1298,
            createdAt: new Date().toISOString()
          }
        ]
      };

      return PrintService.printReceipt(sampleSale, { deviceName: targetDevice, silent: false });
    } else {
      const sampleLabelHtml = `
        <div style="width:63mm;height:34mm;border:1px dashed #999;padding:2mm;box-sizing:border-box;text-align:center;font-family:Arial,sans-serif;page-break-after:always;">
          <div style="font-size:10px;font-weight:900;letter-spacing:1px;color:#1e3a8a;">KIDO 2628 · 基多</div>
          <div style="font-size:8px;font-weight:600;margin-top:1px;">Seoul Dino Graphic Cotton Tee</div>
          <div style="margin:2px 0;">
            <svg width="150" height="30" viewBox="0 0 150 30" xmlns="http://www.w3.org/2000/svg">
              <rect width="150" height="30" fill="#fff" />
              <rect x="10" y="2" width="2" height="26" fill="#000" />
              <rect x="14" y="2" width="4" height="26" fill="#000" />
              <rect x="22" y="2" width="2" height="26" fill="#000" />
              <rect x="28" y="2" width="6" height="26" fill="#000" />
              <rect x="38" y="2" width="2" height="26" fill="#000" />
              <rect x="44" y="2" width="4" height="26" fill="#000" />
              <rect x="52" y="2" width="2" height="26" fill="#000" />
              <rect x="58" y="2" width="6" height="26" fill="#000" />
              <rect x="68" y="2" width="2" height="26" fill="#000" />
              <rect x="74" y="2" width="4" height="26" fill="#000" />
              <rect x="82" y="2" width="2" height="26" fill="#000" />
              <rect x="88" y="2" width="6" height="26" fill="#000" />
              <rect x="98" y="2" width="2" height="26" fill="#000" />
              <rect x="104" y="2" width="4" height="26" fill="#000" />
              <rect x="112" y="2" width="2" height="26" fill="#000" />
              <rect x="118" y="2" width="6" height="26" fill="#000" />
              <rect x="128" y="2" width="2" height="26" fill="#000" />
              <rect x="134" y="2" width="4" height="26" fill="#000" />
            </svg>
          </div>
          <div style="font-size:7px;font-family:monospace;letter-spacing:1px;">KD-TEE-01-2Y-MINT</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;padding:0 2mm;">
            <span style="font-size:8px;font-weight:bold;background:#e2e8f0;padding:1px 3px;border-radius:2px;">Size: 2-3Y</span>
            <span style="font-size:10px;font-weight:900;color:#000;">MRP: ₹649</span>
          </div>
        </div>
      `;

      return PrintService.printBarcodeLabels(sampleLabelHtml, { deviceName: targetDevice, silent: false });
    }
  }

  private static async generateReceiptHtml(
    sale: Sale,
    settings: any,
    format: 'THERMAL_72MM' | 'A4_INVOICE' | 'A5_BILL' = 'A4_INVOICE'
  ): Promise<string> {
    const money = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const items = sale.items || [];

    // Optional UPI QR code generation if UPI is configured
    let upiQrDataUrl = '';
    if (settings.upiVpa) {
      try {
        const upiUri = `upi://pay?pa=${encodeURIComponent(settings.upiVpa)}&pn=${encodeURIComponent(settings.upiName || 'KIDO 2628')}&am=${sale.grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(sale.invoiceNo)}`;
        upiQrDataUrl = await QRCode.toDataURL(upiUri, { width: 120, margin: 1 });
      } catch (e) {
        // Fallback gracefully without QR
      }
    }

    if (format === 'A4_INVOICE' || format === 'A5_BILL') {
      const isA5 = format === 'A5_BILL';
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Tax Invoice ${escapeHtml(sale.invoiceNo)}</title>
          <style>
            @page {
              size: ${isA5 ? 'A5 landscape' : 'A4 portrait'};
              margin: ${isA5 ? '8mm' : '12mm'};
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: ${isA5 ? '11px' : '12px'};
              line-height: 1.4;
              background: #fff;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: ${isA5 ? '10px' : '16px'};
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
            }
            .store-brand {
              font-size: ${isA5 ? '20px' : '26px'};
              font-weight: 900;
              letter-spacing: 1px;
              color: #0f172a;
            }
            .store-subtitle {
              font-size: ${isA5 ? '10px' : '12px'};
              font-weight: 600;
              color: #475569;
              margin-top: 2px;
            }
            .store-meta {
              font-size: ${isA5 ? '9px' : '10px'};
              color: #64748b;
              margin-top: 3px;
              line-height: 1.3;
            }
            .invoice-badge-title {
              font-size: ${isA5 ? '18px' : '22px'};
              font-weight: 900;
              color: #0284c7;
              text-align: right;
              letter-spacing: 0.5px;
            }
            .info-grid {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: ${isA5 ? '10px' : '16px'};
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .info-grid td {
              padding: ${isA5 ? '6px 10px' : '8px 12px'};
              vertical-align: top;
              font-size: ${isA5 ? '10px' : '11px'};
            }
            .info-label {
              color: #64748b;
              font-size: ${isA5 ? '9px' : '10px'};
              text-transform: uppercase;
              font-weight: 700;
            }
            .info-val {
              font-weight: 700;
              color: #0f172a;
              margin-top: 1px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: ${isA5 ? '10px' : '16px'};
            }
            .items-table th {
              background: #0f172a;
              color: #fff;
              font-weight: 700;
              text-align: left;
              padding: ${isA5 ? '6px 8px' : '8px 10px'};
              font-size: ${isA5 ? '9px' : '10px'};
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .items-table td {
              padding: ${isA5 ? '6px 8px' : '8px 10px'};
              border-bottom: 1px solid #e2e8f0;
              font-size: ${isA5 ? '10px' : '11px'};
            }
            .items-table tr:nth-child(even) {
              background: #f8fafc;
            }
            .variant-badge {
              display: inline-block;
              font-size: ${isA5 ? '8px' : '9px'};
              font-weight: 600;
              color: #475569;
              background: #e2e8f0;
              padding: 1px 5px;
              border-radius: 3px;
              margin-left: 4px;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
            }
            .summary-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: ${isA5 ? '8px 12px' : '12px 16px'};
              width: 280px;
              margin-left: auto;
            }
            .summary-line {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: ${isA5 ? '10px' : '11px'};
            }
            .grand-total-line {
              display: flex;
              justify-content: space-between;
              border-top: 2px solid #0f172a;
              padding-top: 6px;
              margin-top: 6px;
              font-size: ${isA5 ? '14px' : '16px'};
              font-weight: 900;
              color: #0f172a;
            }
            .terms-box {
              font-size: ${isA5 ? '8px' : '9px'};
              color: #64748b;
              line-height: 1.4;
              border-left: 2px solid #0284c7;
              padding-left: 8px;
            }
            .qr-container {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-top: 8px;
            }
            .qr-container img {
              width: ${isA5 ? '55px' : '70px'};
              height: ${isA5 ? '55px' : '70px'};
              border: 1px solid #cbd5e1;
              border-radius: 4px;
            }
            .footer-sign {
              text-align: right;
              font-size: ${isA5 ? '9px' : '10px'};
              color: #475569;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align:top;width:60%">
                <div class="store-brand">
                  <span style="color:#2563eb">KI</span><span style="color:#db2777">DO</span> <span style="color:#0284c7">26</span><span style="color:#9333ea">28</span> · 基多
                </div>
                <div class="store-subtitle">${escapeHtml(settings.subtitle || 'Imported Korean & Japanese Kids Wear')}</div>
                <div class="store-meta">
                  ${escapeHtml(settings.address || 'Shop No. 21, Ground Floor, BDA Complex, Nagarabhavi 2nd Stage, Bengaluru - 560072')}<br>
                  <b>Ph:</b> ${escapeHtml(settings.phone1 || '8147464651')} / ${escapeHtml(settings.phone2 || '9008300586')} | <b>UPI:</b> ${escapeHtml(settings.upiVpa || '8147464651@upi')}
                </div>
              </td>
              <td style="vertical-align:top;text-align:right;width:40%">
                <div class="invoice-badge-title">TAX INVOICE</div>
                <div style="font-size:12px;font-weight:700;color:#0f172a;margin-top:2px;"># ${escapeHtml(sale.invoiceNo)}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">Original for Recipient</div>
              </td>
            </tr>
          </table>

          <table class="info-grid">
            <tr>
              <td style="width:30%">
                <div class="info-label">Invoice Details</div>
                <div class="info-val">Date: ${escapeHtml(sale.createdAt.slice(0, 10))}</div>
                <div style="font-size:9px;color:#64748b">Time: ${new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </td>
              <td style="width:35%">
                <div class="info-label">Billed To (Customer)</div>
                <div class="info-val">${escapeHtml(sale.customerName || 'Walk-in Customer')}</div>
                ${sale.customerMobile ? `<div style="font-size:9px;color:#64748b">Mob: ${escapeHtml(sale.customerMobile)}</div>` : ''}
              </td>
              <td style="width:35%">
                <div class="info-label">Payment Mode</div>
                <div class="info-val" style="color:#16a34a">PAID · ${escapeHtml(sale.paymentMethod)}</div>
                ${sale.tenderedAmount > 0 ? `<div style="font-size:9px;color:#64748b">Tendered: ${money(sale.tenderedAmount)} | Change: ${money(sale.changeDue)}</div>` : ''}
              </td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width:5%;text-align:center">#</th>
                <th style="width:45%">Item Description & SKU</th>
                <th style="width:15%;text-align:center">Variant</th>
                <th style="width:12%;text-align:right">Rate (MRP)</th>
                <th style="width:8%;text-align:center">Qty</th>
                <th style="width:15%;text-align:right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (i, idx) => `
                <tr>
                  <td style="text-align:center;color:#64748b">${idx + 1}</td>
                  <td>
                    <b>${escapeHtml(i.name)}</b>
                    <span style="font-size:9px;color:#64748b;margin-left:4px">[${escapeHtml(i.sku)}]</span>
                  </td>
                  <td style="text-align:center">
                    ${i.size ? `<span class="variant-badge">${escapeHtml(i.size)}</span>` : ''}
                    ${i.color ? `<span class="variant-badge">${escapeHtml(i.color)}</span>` : ''}
                  </td>
                  <td style="text-align:right">${money(i.unitPrice)}</td>
                  <td style="text-align:center;font-weight:700">${i.quantity}</td>
                  <td style="text-align:right;font-weight:700">${money(i.lineTotal)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <table class="summary-table">
            <tr>
              <td style="vertical-align:top;width:55%">
                <div class="terms-box">
                  <b>Store Terms & Exchange Policy:</b><br>
                  1. Exchange valid within <b>7 days</b> of purchase with original invoice & price tags intact.<br>
                  2. Altered, worn, washed, or damaged garments cannot be exchanged.<br>
                  3. Please contact store manager for any assistance or size inquiries.
                </div>
                ${
                  upiQrDataUrl
                    ? `
                  <div class="qr-container">
                    <img src="${upiQrDataUrl}" alt="UPI QR" />
                    <div style="font-size:9px;color:#475569">
                      <b>Scan & Pay with UPI</b><br>
                      GPay, PhonePe, Paytm<br>
                      <span style="font-family:monospace;font-size:8px">${escapeHtml(settings.upiVpa)}</span>
                    </div>
                  </div>
                `
                    : ''
                }
              </td>
              <td style="vertical-align:top;width:45%">
                <div class="summary-box">
                  <div class="summary-line">
                    <span style="color:#64748b">Subtotal</span>
                    <span>${money(sale.subtotal)}</span>
                  </div>
                  ${
                    sale.discountAmount > 0
                      ? `
                    <div class="summary-line" style="color:#dc2626">
                      <span>Discount (${sale.discountPercent}%)</span>
                      <span>-${money(sale.discountAmount)}</span>
                    </div>
                  `
                      : ''
                  }
                  <div class="grand-total-line">
                    <span>Grand Total</span>
                    <span>${money(sale.grandTotal)}</span>
                  </div>
                  <div style="font-size:9px;color:#64748b;text-align:right;margin-top:4px">
                    (Inclusive of all applicable taxes)
                  </div>
                </div>
                <div class="footer-sign">
                  <b>For KIDO 2628</b><br>
                  <div style="height:25px"></div>
                  Authorized Signatory
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }

    // Default 72mm Thermal Receipt Roll Format
    const tenderedHtml =
      sale.tenderedAmount > 0
        ? `
      <div>Cash Tendered: ${money(sale.tenderedAmount)}</div>
      <div style="font-weight:bold">Change Due: ${money(sale.changeDue)}</div>
    `
        : '';

    const itemsHtml = items
      .map(
        (i) => `
        <tr>
          <td style="text-align:left;padding:3px 0">
            ${escapeHtml(i.name)}
            ${i.size ? `<span style="font-size:9px"> · ${escapeHtml(i.size)}</span>` : ''}
            ${i.color ? `<span style="font-size:9px"> · ${escapeHtml(i.color)}</span>` : ''}
          </td>
          <td style="text-align:center;padding:3px 0">${i.quantity}</td>
          <td style="text-align:right;padding:3px 0">${money(i.lineTotal)}</td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt ${escapeHtml(sale.invoiceNo)}</title>
        <style>
          @page {
            size: 72mm auto;
            margin: 2mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
            font-size: 11px;
            color: #000;
            margin: 0;
            padding: 4px;
            width: 68mm;
            line-height: 1.3;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #666; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div style="font-size:16px;font-weight:900;letter-spacing:1px">
            <span style="color:#2563eb">KI</span><span style="color:#db2777">DO</span> <span style="color:#0284c7">26</span><span style="color:#9333ea">28</span> · 基多
          </div>
          <div style="font-size:10px;font-weight:600;margin-top:2px">${escapeHtml(settings.subtitle || 'Imported Korean Kids wear')}</div>
          <div style="font-size:9px;margin-top:3px">${escapeHtml(settings.address || 'Shop No. 21, Nagarabhavi BDA Complex, Bengaluru')}</div>
          <div style="font-size:9px">Ph: ${escapeHtml(settings.phone1 || '8147464651')} / ${escapeHtml(settings.phone2 || '9008300586')}</div>
        </div>

        <div class="divider"></div>

        <div style="font-size:10px">
          <div style="display:flex;justify-content:space-between">
            <span><b>Bill:</b> ${escapeHtml(sale.invoiceNo)}</span>
            <span><b>Date:</b> ${escapeHtml(sale.createdAt.slice(0, 10))}</span>
          </div>
          ${sale.customerName ? `<div><b>Cust:</b> ${escapeHtml(sale.customerName)}</div>` : ''}
          ${sale.customerMobile ? `<div><b>Mob:</b> ${escapeHtml(sale.customerMobile)}</div>` : ''}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom:1px solid #000">
              <th style="text-align:left;width:55%">Item</th>
              <th style="text-align:center;width:15%">Qty</th>
              <th style="text-align:right;width:30%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="text-right" style="font-size:11px">
          <div>Subtotal: ${money(sale.subtotal)}</div>
          ${sale.discountAmount > 0 ? `<div>Discount: -${money(sale.discountAmount)} (${sale.discountPercent}%)</div>` : ''}
          <div style="font-size:13px;font-weight:bold;margin-top:3px">Grand Total: ${money(sale.grandTotal)}</div>
          ${tenderedHtml}
        </div>

        <div class="divider"></div>

        <div class="text-center" style="font-size:10px">
          <div>Payment Mode: <b>${escapeHtml(sale.paymentMethod)}</b></div>
          ${
            upiQrDataUrl
              ? `
            <div style="margin:6px 0;">
              <img src="${upiQrDataUrl}" style="width:75px;height:75px;" alt="QR" />
              <div style="font-size:8px;color:#444">Scan to Pay via UPI</div>
            </div>
          `
              : ''
          }
          <div style="margin-top:6px;font-weight:600">Thank you for shopping with us!</div>
          <div style="font-size:8px;color:#444">Please retain receipt for exchange within 7 days.</div>
        </div>
      </body>
      </html>
    `;
  }
}
