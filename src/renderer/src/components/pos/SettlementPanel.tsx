import React, { useState, useEffect } from 'react';
import { useCartStore } from '../../stores/cartStore';
import { useUiStore } from '../../stores/uiStore';
import { ShopSettings, Sale } from '../../types';
import { Printer, QrCode, Banknote, CreditCard, Layers } from 'lucide-react';
import { generateUpiQrDataUrl } from '../../utils/upi';

interface SettlementPanelProps {
  settings: ShopSettings | null;
  onSaleCompleted: (sale: Sale) => void;
}

export const SettlementPanel: React.FC<SettlementPanelProps> = ({
  settings,
  onSaleCompleted
}) => {
  const {
    items,
    customerId,
    customerName,
    customerMobile,
    discountPercent,
    paymentMethod,
    tenderedAmount,
    notes,
    setDiscountPercent,
    setPaymentMethod,
    setTenderedAmount,
    setNotes,
    clearCart,
    getSubtotal,
    getDiscountAmount,
    getGrandTotal,
    getChangeDue
  } = useCartStore();

  const addToast = useUiStore((state) => state.addToast);
  const [saving, setSaving] = useState<boolean>(false);
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const grandTotal = getGrandTotal();
  const changeDue = getChangeDue();

  // Update UPI QR Code when amount changes or UPI mode selected
  useEffect(() => {
    if (paymentMethod === 'UPI' && grandTotal > 0 && settings?.upiVpa) {
      generateUpiQrDataUrl({
        vpa: settings.upiVpa,
        payeeName: settings.upiName || 'KIDO 2628',
        amount: grandTotal,
        invoiceNo: 'LIVE'
      })
        .then((url) => setUpiQrUrl(url))
        .catch((err) => console.error('UPI QR error:', err));
    }
  }, [paymentMethod, grandTotal, settings]);

  const handleSaveAndPrint = async () => {
    if (items.length === 0) {
      addToast({ type: 'warning', title: 'Cart is empty', message: 'Add at least one item to bill.' });
      return;
    }

    if (paymentMethod === 'Cash' && tenderedAmount > 0 && tenderedAmount < grandTotal) {
      addToast({
        type: 'warning',
        title: 'Insufficient Cash Tendered',
        message: `Tendered ₹${tenderedAmount.toFixed(2)} is less than Grand Total ₹${grandTotal.toFixed(2)}.`
      });
      return;
    }

    try {
      setSaving(true);

      const saleInput = {
        customerId,
        customerName: customerName || null,
        customerMobile: customerMobile || null,
        discountPercent,
        discountAmount,
        paymentMethod,
        tenderedAmount: paymentMethod === 'Cash' ? (tenderedAmount || grandTotal) : 0,
        changeDue: paymentMethod === 'Cash' ? changeDue : 0,
        notes: notes || null,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          sku: i.sku,
          name: i.name,
          size: i.size,
          color: i.color,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          discount: i.discount
        }))
      };

      const res = await window.api.sales.create(saleInput);

      if (res.success && res.data) {
        addToast({
          type: 'success',
          title: 'Bill Saved Atomically',
          message: `Invoice #${res.data.invoiceNo} committed & stock updated.`
        });
        clearCart();
        onSaleCompleted(res.data);
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Save Bill',
          message: res.error || 'Database transaction error.'
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Sale Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const paymentModes = [
    { id: 'Cash', label: 'Cash', icon: Banknote },
    { id: 'UPI', label: 'UPI', icon: QrCode },
    { id: 'Card', label: 'Card', icon: CreditCard },
    { id: 'Split', label: 'Split', icon: Layers }
  ] as const;

  return (
    <div className="w-80 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between shrink-0 p-4">
      {/* Calculation breakdown */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Payment & Totals
        </h4>

        {/* Subtotal */}
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Subtotal</span>
          <span className="font-bold text-slate-800 font-mono">₹{subtotal.toFixed(2)}</span>
        </div>

        {/* Bill Discount (%) */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-600">Discount (%)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent || ''}
              placeholder="0"
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveAndPrint();
                }
              }}
              className="w-16 px-2 py-1 text-right text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
            {discountAmount > 0 && (
              <span className="text-[11px] font-bold text-rose-600 font-mono">
                -₹{discountAmount.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Grand Total */}
        <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
              Grand Total
            </span>
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>
          <span className="text-xs px-2 py-1 bg-slate-800 rounded-lg text-slate-300 font-medium">
            {items.reduce((s, i) => s + i.quantity, 0)} Items
          </span>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-2">
            Payment Mode
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {paymentModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = paymentMethod === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setPaymentMethod(mode.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="text-[10px]">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cash Tendered & Change Due (If Cash selected) */}
        {paymentMethod === 'Cash' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-slate-600">
                Cash Tendered (₹)
              </label>
              <input
                type="number"
                min="0"
                value={tenderedAmount || ''}
                placeholder={grandTotal > 0 ? String(grandTotal) : '0'}
                onChange={(e) => setTenderedAmount(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveAndPrint();
                  }
                }}
                className="w-24 px-2 py-1 text-right text-xs font-bold font-mono text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
              <span className="text-slate-600 font-medium">Change Due:</span>
              <span
                className={`font-black font-mono ${
                  changeDue > 0 ? 'text-emerald-600 text-sm' : 'text-slate-500'
                }`}
              >
                ₹{changeDue.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic UPI QR Code View */}
        {paymentMethod === 'UPI' && upiQrUrl && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div className="flex justify-center mb-1">
              <img
                src={upiQrUrl}
                alt="UPI QR"
                className="w-32 h-32 rounded-lg border border-slate-200 bg-white p-1"
              />
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Scan to Pay <b className="text-slate-800 font-mono">₹{grandTotal.toFixed(2)}</b>
            </div>
            <div className="text-[9px] text-slate-400 font-mono truncate">{settings?.upiVpa}</div>
          </div>
        )}

        {/* Bill Notes */}
        <div>
          <input
            type="text"
            placeholder="Order / Bill remarks (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Primary Action: Save & Print */}
      <div className="pt-4 border-t border-slate-200">
        <button
          id="saveAndPrintBtn"
          onClick={handleSaveAndPrint}
          disabled={saving || items.length === 0}
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>{saving ? 'Processing...' : 'Save & Print Bill (Enter)'}</span>
        </button>
      </div>
    </div>
  );
};
