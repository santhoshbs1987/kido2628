import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Sale, ShopSettings } from '../../types';
import { Printer } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  settings: ShopSettings | null;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  sale,
  settings
}) => {
  const addToast = useUiStore((state) => state.addToast);
  const [printing, setPrinting] = useState<boolean>(false);

  if (!sale) return null;

  const handleSilentPrint = async () => {
    try {
      setPrinting(true);
      const res = await window.api.print.receipt(sale, { silent: true });
      if (res.success) {
        addToast({ type: 'success', title: 'Receipt Printed', message: `Sent to thermal printer.` });
        onClose();
      } else {
        addToast({ type: 'error', title: 'Print Failed', message: res.error || 'Check printer connection.' });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Print Error', message: e.message });
    } finally {
      setPrinting(false);
    }
  };

  const handleDialogPrint = async () => {
    try {
      setPrinting(true);
      const res = await window.api.print.receipt(sale, { silent: false });
      if (res.success) {
        addToast({ type: 'success', title: 'Print Dispatched', message: 'Print job completed.' });
        onClose();
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Print Error', message: e.message });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bill Receipt #${sale.invoiceNo}`}
      subtitle="72mm Thermal Receipt Preview"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Thermal Receipt Paper Card */}
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-5 shadow-sm font-mono text-[11px] text-slate-900 leading-tight space-y-3 mx-auto max-w-[320px]">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="text-lg font-black tracking-wider">
              <span className="text-blue-600">KI</span>
              <span className="text-pink-600">DO</span>{' '}
              <span className="text-sky-600">26</span>
              <span className="text-purple-600">28</span>
            </div>
            <div className="text-[10px] font-sans font-semibold text-slate-700">
              {settings?.subtitle || 'Imported Korean Kids wear'}
            </div>
            <div className="text-[9px] text-slate-500 font-sans leading-tight">
              {settings?.address || 'Shop No. 21, Nagarabhavi BDA Complex, Bengaluru - 560072'}
            </div>
            <div className="text-[9px] text-slate-500 font-sans">
              Ph: {settings?.phone1} / {settings?.phone2}
            </div>
          </div>

          <div className="border-t border-dashed border-slate-400 pt-2">
            <div className="flex justify-between">
              <span><b>Bill:</b> {sale.invoiceNo}</span>
              <span><b>Date:</b> {sale.createdAt.slice(0, 10)}</span>
            </div>
            {sale.customerName && <div><b>Cust:</b> {sale.customerName}</div>}
            {sale.customerMobile && <div><b>Mob:</b> {sale.customerMobile}</div>}
          </div>

          {/* Table */}
          <div className="border-t border-dashed border-slate-400 pt-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-400">
                  <th className="py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(sale.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1 pr-1">
                      <div className="font-semibold text-slate-900 leading-tight">{item.name}</div>
                      {(item.size || item.color) && (
                        <div className="text-[9px] text-slate-500 font-sans">
                          {item.size} {item.color ? `· ${item.color}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="text-center py-1 align-top">{item.quantity}</td>
                    <td className="text-right py-1 align-top font-semibold">
                      {item.lineTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-right">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount ({sale.discountPercent}%):</span>
                <span>-₹{sale.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-300">
              <span>Grand Total:</span>
              <span>₹{sale.grandTotal.toFixed(2)}</span>
            </div>
            {sale.tenderedAmount > 0 && (
              <>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Cash Tendered:</span>
                  <span>₹{sale.tenderedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Change Due:</span>
                  <span>₹{sale.changeDue.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-slate-400 pt-2 text-center text-[10px] space-y-1">
            <div>Payment Mode: <b className="font-bold">{sale.paymentMethod}</b></div>
            <div className="font-bold font-sans mt-1">Thank you for shopping!</div>
            <div className="text-[8px] text-slate-500 font-sans">
              Exchange within 7 days with original bill & tag.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSilentPrint}
            disabled={printing}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print Silent (Default)'}</span>
          </button>
          <button
            onClick={handleDialogPrint}
            disabled={printing}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            Print with Dialog...
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
