# KIDO 2628 Hardware & Printing Integration Guide

This guide covers physical hardware connectivity, driver configuration, and silent printing integration for retail stores running KIDO 2628.

---

## 1. Supported Hardware Matrix

| Hardware Type | Supported Protocols | Standard Sizing / Specs | Verified Models |
| :--- | :--- | :--- | :--- |
| **POS Thermal Printer** | ESC/POS (USB, Network/LAN, Bluetooth) | 72mm (standard) & 80mm roll width | Epson TM-T82, TVS RP 3200, Posiflex, NGX |
| **Barcode Sticker Printer** | TSPL / ZPL / Standard OS Driver | 63mm × 34mm (1-across sticky label) | TSC TE244, Zebra ZD220, Xprinter XP-365B |
| **Barcode Scanner** | USB HID & 2.4GHz Wireless | 1D / 2D Code-128, EAN-13, QR | Honeywell 1400g, TVS BSC 101, Eyoyo 1D |
| **Digital Payments** | BharatQR / Dynamic UPI Spec | Live UPI QR on screen | PhonePe, Google Pay, Paytm, BHIM |

---

## 2. POS Thermal Receipt Printing (72mm / 80mm)

### Architecture
Printing executes via a hidden, sandboxed Electron `BrowserWindow` communicating directly with the operating system print spooler using `webContents.print({ silent: true, deviceName })`.

### Silent Printing Setup:
1. Connect thermal printer via USB or assign static IP for Network LAN.
2. Install standard manufacturer print driver on Windows (`Printers & Scanners`) or macOS (`System Settings > Printers`).
3. In KIDO 2628, navigate to **Settings (F7) > Hardware & Thermal Printers**.
4. Select the installed printer from the **POS Receipt Printer** dropdown and click **Save Settings**.
5. During checkout, clicking **Save & Print Bill (Enter)** commits the transaction to SQLite and instantly dispatches the silent print job without OS dialogue interruptions.

### Thermal Receipt Layout:
- Paper width: `72mm` with `2mm` margin.
- Font: High-contrast monospace / system sans-serif (`11px` body, `16px` store heading).
- Bilingual Heading: `KIDO 2628 · 基多`
- Breakdown: Bill Number, Date/Time, Customer Info, Itemized table with Size/Colour, Subtotal, Line & Bill Discounts, Grand Total, Tendered Cash, and Change Due.
- Auto-cutter trigger and exchange policy notice (`Within 7 days with original receipt`).

---

## 3. Barcode Sticky Label Printing (63mm × 34mm)

### Precision Dimension Specifications
- **Sticker Width**: `63mm`
- **Sticker Height**: `34mm`
- **Layout**: Single-label column (`page-break-after: always`).
- **Barcode Format**: Pure SVG **Code-128B** generated client-side without HTML canvas or external fonts, ensuring crisp laser/thermal line resolution without fuzzy rasterization.

### Label Content Hierarchy:
1. **Header**: Store name & Chinese characters (`KIDO 2628 · 基多`) in bold `10.5pt`.
2. **Product Name**: Truncated with ellipsis in `8pt` bold.
3. **Category**: `7pt` bold (`Boys`, `Girls`, `Newborn`).
4. **Variant Badges**: Size (`2Y`) and Colour (`Pink`) in `6.5pt`.
5. **Barcode Graphic**: SVG vector bars with `0.5px` letter-spaced human-readable SKU.
6. **Price**: Bold MRP (`₹700.00`).

### Batch Printing Flow:
1. Open **Products (F2)** and click the **Printer icon** on any product row.
2. The modal displays a **Live 63mm × 34mm Sticker Preview**.
3. Set individual label quantities per variant or use quick presets (`1 Each`, `5 Each`, `Match In-Stock`).
4. Click **Print Labels (Silent)** to send the batch (up to 500 stickers per run) directly to the sticky roll printer.

---

## 4. Hardware Barcode Scanner Buffer

Retail barcode scanners emulate rapid keyboard input (HID mode). However, cashiers encounter two common problems:
1. Scanners configured without an `Enter` suffix fail to trigger submit.
2. Slow human typing in input boxes can be misinterpreted as a scan.

### Buffer Engine (`useBarcodeScanner.ts`):
- Measures keystroke latency: scanners transmit keystrokes at intervals `<60ms`.
- Accumulates rapid characters into a burst buffer.
- Automatically handles both `Enter`-terminated and non-`Enter` scanner streams (firing after a `120ms` idle threshold).
- **Modal Guard**: If any modal dialog is currently open, global scanning is muted unless the active focus is explicitly the scan input.

---

## 5. Dynamic UPI BharatQR Integration

When selecting **UPI** as payment mode in POS billing:
- The system dynamically generates a UPI payment string matching the NPCI specification:
  ```
  upi://pay?pa=8147464651@upi&pn=KIDO%202628&am=1260.00&cu=INR&tn=KIDO-INV-LIVE
  ```
- Generates an on-screen QR code in real-time.
- Customers scan directly from the cashier screen using Google Pay, PhonePe, Paytm, or BHIM.
- The merchant receives immediate payment notification on their linked mobile device.
