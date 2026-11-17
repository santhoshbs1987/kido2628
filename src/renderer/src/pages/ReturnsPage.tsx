import React, { useState, useEffect } from 'react';
import { Return, Sale } from '../types';
import { useUiStore } from '../stores/uiStore';
import { Modal } from '../components/common/Modal';
import { RotateCcw } from 'lucide-react';

export const ReturnsPage: React.FC = () => {
  const addToast = useUiStore((state) => state.addToast);

  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Return Process Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [searchInvoice, setSearchInvoice] = useState<string>('');
  const [validatedSale, setValidatedSale] = useState<Sale | null>(null);
  const [eligibleItems, setEligibleItems] = useState<any[]>([]);
  const [remainingRefund, setRemainingRefund] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<
    Record<number, { quantity: number; restock: boolean; refundAmount: number }>
  >({});
  const [returnReason, setReturnReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const res = await window.api.returns.getAll();
      if (res.success) setReturns(res.data);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Load Error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const handleLookupInvoice = async () => {
    if (!searchInvoice.trim()) return;

    try {
      const res = await window.api.returns.lookupInvoice(searchInvoice.trim());
      if (res.success && res.data) {
        setValidatedSale(res.data.sale);
        setEligibleItems(res.data.itemsEligible);
        setRemainingRefund(res.data.remainingInvoiceRefund ?? res.data.sale.grandTotal);

        // Prepopulate empty selection map
        const initialSelected: Record<number, { quantity: number; restock: boolean; refundAmount: number }> = {};
        for (const item of res.data.itemsEligible) {
          if (item.eligibleQty > 0) {
            initialSelected[item.saleItemId] = {
              quantity: 0,
              restock: true,
              refundAmount: item.effectiveUnitPrice
            };
          }
        }
        setSelectedItems(initialSelected);
      } else {
        addToast({ type: 'error', title: 'Lookup Failed', message: res.error || 'Invoice not found.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Lookup Error', message: err.message });
    }
  };

  const handleUpdateItemSelection = (saleItemId: number, field: string, value: any) => {
    setSelectedItems((prev) => ({
      ...prev,
      [saleItemId]: {
        ...prev[saleItemId],
        [field]: value
      }
    }));
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatedSale) return;

    const itemsToReturn: Array<{
      saleItemId: number;
      quantity: number;
      unitPrice: number;
      refundAmount: number;
      restock: boolean;
    }> = [];

    for (const [saleItemIdStr, data] of Object.entries(selectedItems)) {
      const saleItemId = Number(saleItemIdStr);
      const eligible = eligibleItems.find((e) => e.saleItemId === saleItemId);
      if (eligible && data.quantity > 0) {
        itemsToReturn.push({
          saleItemId,
          quantity: data.quantity,
          unitPrice: eligible.unitPrice,
          refundAmount: eligible.effectiveUnitPrice * data.quantity,
          restock: data.restock
        });
      }
    }

    if (itemsToReturn.length === 0) {
      addToast({ type: 'warning', title: 'No items selected', message: 'Specify return quantity > 0 for at least one item.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await window.api.returns.create({
        invoiceNo: validatedSale.invoiceNo,
        reason: returnReason || null,
        items: itemsToReturn
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Return Processed',
          message: `Return #${res.data.returnNo} logged. Refund: ₹${res.data.totalRefund.toFixed(2)}`
        });
        setShowModal(false);
        setSearchInvoice('');
        setValidatedSale(null);
        setEligibleItems([]);
        setSelectedItems({});
        setReturnReason('');
        loadReturns();
      } else {
        addToast({ type: 'error', title: 'Return Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Processing Error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidReturn = async (ret: Return) => {
    if (!window.confirm(`Are you sure you want to void Return #${ret.returnNo}? Restocked items will be deducted back.`)) {
      return;
    }

    try {
      const res = await window.api.returns.void(ret.id);
      if (res.success) {
        addToast({ type: 'success', title: 'Return Voided', message: res.data.message });
        loadReturns();
      } else {
        addToast({ type: 'error', title: 'Void Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Void Error', message: err.message });
    }
  };

  const totalCalculatedRefund = Object.entries(selectedItems).reduce((sum, [saleItemIdStr, data]) => {
    const eligible = eligibleItems.find((e) => e.saleItemId === Number(saleItemIdStr));
    if (eligible && data.quantity > 0) {
      return sum + (eligible.effectiveUnitPrice * data.quantity);
    }
    return sum;
  }, 0);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100 gap-4">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Returns & Exchanges Log</h2>
          <p className="text-xs text-slate-500">
            Process invoice returns with active inventory restock or damaged write-off
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setSearchInvoice('');
            setValidatedSale(null);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Process New Return</span>
        </button>
      </div>

      {/* Returns Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Return No</th>
                <th className="px-4 py-3">Original Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Returned Items & Restock Status</th>
                <th className="px-4 py-3 text-right">Refund Amount (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Loading returns history...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <RotateCcw className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No returns logged yet.
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${r.isVoided ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {r.returnNo}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                      {r.invoiceNo}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {r.customerName || 'Walk-in'}
                    </td>
                    <td className="px-4 py-3 max-w-sm">
                      <div className="space-y-1">
                        {(r.items || []).map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                            <span className="font-semibold">{item.name}</span>
                            <span>× {item.quantity}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                item.restock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.restock ? 'Restocked' : 'Damaged / Write-off'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      ₹{r.totalRefund.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.isVoided ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.isVoided ? 'VOIDED' : 'COMPLETED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!r.isVoided && (
                        <button
                          onClick={() => handleVoidReturn(r)}
                          title="Void this Return"
                          className="px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Process Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Process Return & Restock"
        subtitle="Lookup invoice, verify eligible quantities, and choose restock destination"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmitReturn} className="space-y-4">
          {/* Invoice Lookup Bar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Enter or Scan Invoice Number <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="e.g. INV-1001"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookupInvoice();
                  }
                }}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleLookupInvoice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Validate Invoice
              </button>
            </div>
          </div>

          {/* Validated Invoice Details */}
          {validatedSale && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-blue-900">Bill: {validatedSale.invoiceNo}</span>
                  <span className="text-slate-500 ml-2">Date: {validatedSale.createdAt.slice(0, 10)}</span>
                </div>
                <div className="font-semibold text-slate-700">
                  Customer: {validatedSale.customerName || 'Walk-in'} ({validatedSale.customerMobile || 'N/A'})
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-blue-200/60">
                <span className="text-slate-600">
                  Original Grand Total: <b className="font-mono text-slate-800">₹{validatedSale.grandTotal.toFixed(2)}</b>
                  {validatedSale.discountAmount > 0 && (
                    <span className="text-rose-600 text-[10px] ml-1">
                      (Includes ₹{validatedSale.discountAmount.toFixed(2)} Bill Discount)
                    </span>
                  )}
                </span>
                <span className="font-bold text-emerald-800">
                  Remaining Refundable Cap: <b className="font-mono">₹{remainingRefund.toFixed(2)}</b>
                </span>
              </div>
            </div>
          )}

          {/* Eligible Items Selection */}
          {eligibleItems.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Items to Return
              </span>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">Eligible</th>
                      <th className="px-3 py-2 w-24">Return Qty</th>
                      <th className="px-3 py-2">Restock to Inventory?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleItems.map((item) => {
                      const sel = selectedItems[item.saleItemId] || { quantity: 0, restock: true };

                      return (
                        <tr key={item.saleItemId} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-bold text-slate-800">{item.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {item.sku} {item.size ? `· ${item.size}` : ''} {item.color ? `· ${item.color}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">{item.soldQty}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-600">
                            {item.eligibleQty}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              max={item.eligibleQty}
                              disabled={item.eligibleQty <= 0}
                              value={sel.quantity}
                              onChange={(e) =>
                                handleUpdateItemSelection(
                                  item.saleItemId,
                                  'quantity',
                                  Math.min(item.eligibleQty, Math.max(0, Number(e.target.value)))
                                )
                              }
                              className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sel.restock}
                                onChange={(e) =>
                                  handleUpdateItemSelection(item.saleItemId, 'restock', e.target.checked)
                                }
                                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className={sel.restock ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                                {sel.restock ? 'Restock' : 'Damaged / Scrap'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reason */}
          {eligibleItems.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Reason for Return (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Size exchange, defective zipper, customer change of mind"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Bottom Total & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              Total Refund Due:{' '}
              <strong className="text-sm font-black text-rose-600 font-mono">
                ₹{totalCalculatedRefund.toFixed(2)}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || totalCalculatedRefund <= 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Confirm Return & Refund'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
