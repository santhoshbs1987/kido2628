import { BrowserWindow } from 'electron';
import { SettingsService } from './settings.service';
import { Sale } from '../db/schema';

export interface PrintReceiptOptions {
  silent?: boolean;
  deviceName?: string;
}

export class PrintService {
  static async printReceipt(sale: Sale, options?: PrintReceiptOptions): Promise<{ success: boolean; error?: string }> {
    const settings = SettingsService.get();
    const printerName = options?.deviceName || settings.receiptPrinter || undefined;
    const isSilent = options?.silent !== undefined ? options.silent : Boolean(printerName);

    // Create offscreen/hidden window to render and print
    const printWin = new BrowserWindow({
      show: false,
      width: 350,
      height: 600,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    const receiptHtml = PrintService.generateReceiptHtml(sale, settings);

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`);

    return new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: isSilent,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: 'none' }
        },
        (success, failureReason) => {
          printWin.destroy();
          if (!success) {
            resolve({ success: false, error: failureReason });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  }

  static async printBarcodeLabels(labelsHtml: string, options?: { silent?: boolean; deviceName?: string }): Promise<{ success: boolean; error?: string }> {
    const settings = SettingsService.get();
    const printerName = options?.deviceName || settings.labelPrinter || undefined;
    const isSilent = options?.silent !== undefined ? options.silent : Boolean(printerName);

    const printWin = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    const fullHtml = `
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

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    return new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: isSilent,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: 'none' }
        },
        (success, failureReason) => {
          printWin.destroy();
          if (!success) {
            resolve({ success: false, error: failureReason });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  }

  private static generateReceiptHtml(sale: Sale, settings: any): string {
    const money = (n: number) => '₹' + (Number(n) || 0).toFixed(2);
    const tenderedHtml = sale.tenderedAmount > 0 ? `
      <div>Cash Tendered: ${money(sale.tenderedAmount)}</div>
      <div style="font-weight:bold">Change Due: ${money(sale.changeDue)}</div>
    ` : '';

    const itemsHtml = (sale.items || [])
      .map(
        (i) => `
        <tr>
          <td style="text-align:left;padding:3px 0">
            ${i.name}
            ${i.size ? `<span style="font-size:9px"> · ${i.size}</span>` : ''}
            ${i.color ? `<span style="font-size:9px"> · ${i.color}</span>` : ''}
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
        <title>Receipt ${sale.invoiceNo}</title>
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
            <span style="color:#2563eb">KI</span><span style="color:#db2777">DO</span> <span style="color:#0284c7">26</span><span style="color:#9333ea">28</span>
          </div>
          <div style="font-size:10px;font-weight:600;margin-top:2px">${settings.subtitle || 'Imported Korean Kids wear'}</div>
          <div style="font-size:9px;margin-top:3px">${settings.address}</div>
          <div style="font-size:9px">Ph: ${settings.phone1} / ${settings.phone2}</div>
        </div>

        <div class="divider"></div>

        <div style="font-size:10px">
          <div style="display:flex;justify-content:space-between">
            <span><b>Bill:</b> ${sale.invoiceNo}</span>
            <span><b>Date:</b> ${sale.createdAt.slice(0, 10)}</span>
          </div>
          ${sale.customerName ? `<div><b>Cust:</b> ${sale.customerName}</div>` : ''}
          ${sale.customerMobile ? `<div><b>Mob:</b> ${sale.customerMobile}</div>` : ''}
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
          <div>Payment Mode: <b>${sale.paymentMethod}</b></div>
          <div style="margin-top:6px;font-weight:600">Thank you for shopping with us!</div>
          <div style="font-size:8px;color:#444">Please retain receipt for exchange within 7 days.</div>
        </div>
      </body>
      </html>
    `;
  }
}
