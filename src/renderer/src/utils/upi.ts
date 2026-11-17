import QRCode from 'qrcode';

export interface UpiPaymentDetails {
  vpa: string;
  payeeName: string;
  amount: number;
  invoiceNo: string;
}

export function generateUpiString(details: UpiPaymentDetails): string {
  const vpa = details.vpa.trim();
  const name = encodeURIComponent(details.payeeName.trim() || 'KIDO 2628');
  const amount = details.amount.toFixed(2);
  const note = encodeURIComponent(`Bill-${details.invoiceNo}`);

  return `upi://pay?pa=${vpa}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
}

export async function generateUpiQrDataUrl(details: UpiPaymentDetails): Promise<string> {
  const upiUrl = generateUpiString(details);
  return QRCode.toDataURL(upiUrl, {
    width: 256,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}
