import React, { useState, useEffect } from 'react';
import { Purchase, Product } from '../types';
import { useUiStore } from '../stores/uiStore';
import { Modal } from '../components/common/Modal';
import { Truck, Plus, Trash2, Download, Search } from 'lucide-react';

export const PurchasesPage: React.FC = () => {
  const addToast = useUiStore((state) => state.addToast);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchSupplier, setSearchSupplier] = useState<string>('');

  // New Purchase Inward Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [supplier, setSupplier] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<
    Array<{ productId: number; variantId: number; sku: string; size: string; color: string; quantity: number; unitCost: number }>
  >([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [purRes, prodRes] = await Promise.all([
        window.api.purchases.getAll({ supplier: searchSupplier || undefined }),
        window.api.products.getAll()
      ]);

      if (purRes.success) setPurchases(purRes.data);
      if (prodRes.success) setProducts(prodRes.data);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Load Error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchSupplier]);

  const handleAddLineItem = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    const firstVar = firstProd.variants?.[0];
    setLineItems([
      ...lineItems,
      {
        productId: firstProd.id,
        variantId: firstVar?.id || 0,
        sku: firstProd.sku,
        size: firstVar?.size || '',
        color: firstVar?.color || '',
        quantity: 10,
        unitCost: firstProd.costPrice || 0
      }
    ]);
  };

  const handleProductSelect = (index: number, productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const firstVar = prod.variants?.[0];
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      productId: prod.id,
      variantId: firstVar?.id || 0,
      sku: prod.sku,
      size: firstVar?.size || '',
      color: firstVar?.color || '',
      unitCost: prod.costPrice || 0
    };
    setLineItems(updated);
  };

  const handleVariantSelect = (index: number, variantId: number) => {
    const item = lineItems[index];
    const prod = products.find((p) => p.id === item.productId);
    const variant = prod?.variants?.find((v) => v.id === variantId);
    if (!variant) return;
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      variantId: variant.id,
      size: variant.size,
      color: variant.color
    };
    setLineItems(updated);
  };

  const handleUpdateLine = (index: number, field: string, val: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = val;
    setLineItems(updated);
  };

  const handleRemoveLine = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim()) {
      addToast({ type: 'warning', title: 'Missing supplier', message: 'Enter supplier name.' });
      return;
    }
    if (lineItems.length === 0) {
      addToast({ type: 'warning', title: 'Missing items', message: 'Add at least one item to purchase order.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await window.api.purchases.create({
        supplier: supplier.trim(),
        date,
        notes: notes || undefined,
        items: lineItems.map((li) => ({
          productId: li.productId,
          variantId: li.variantId,
          sku: li.sku,
          size: li.size,
          color: li.color,
          quantity: Number(li.quantity) || 1,
          unitCost: Number(li.unitCost) || 0
        }))
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Stock Inward Recorded',
          message: `PO #${res.data.purchaseNo} created and inventory updated.`
        });
        setShowModal(false);
        setSupplier('');
        setNotes('');
        setLineItems([]);
        loadData();
      } else {
        addToast({ type: 'error', title: 'Purchase Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Inward Error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePurchase = async (p: Purchase) => {
    if (
      !window.confirm(
        `Are you sure you want to delete purchase #${p.purchaseNo}? Doing so will deduct ${p.items?.reduce(
          (s, i) => s + i.quantity,
          0
        )} units from inventory stock.`
      )
    ) {
      return;
    }

    try {
      const res = await window.api.purchases.delete(p.id);
      if (res.success) {
        addToast({ type: 'success', title: 'Purchase Deleted', message: res.data.message });
        loadData();
      } else {
        addToast({ type: 'error', title: 'Deletion Blocked', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Error', message: err.message });
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await window.api.export.purchases();
      if (res.success && res.data) {
        addToast({
          type: 'success',
          title: 'Excel Export Complete',
          message: `Purchases exported to ${res.data.filePath}`
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Export Failed', message: err.message });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100 gap-4">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by supplier name..."
            value={searchSupplier}
            onChange={(e) => setSearchSupplier(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              setShowModal(true);
              if (lineItems.length === 0 && products.length > 0) {
                handleAddLineItem();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Supplier Purchase</span>
          </button>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Items / Received Breakdown</th>
                <th className="px-4 py-3 text-right">Total Quantity</th>
                <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Loading purchase records...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No supplier purchases recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const totalQty = (p.items || []).reduce((s, i) => s + i.quantity, 0);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">
                        {p.purchaseNo}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {p.date}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {p.supplier}
                      </td>
                      <td className="px-4 py-3 max-w-sm">
                        <div className="space-y-1">
                          {(p.items || []).map((i) => (
                            <div key={i.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                              <span className="font-mono text-blue-600 font-bold">{i.sku}</span>
                              <span>({i.size || 'One size'}{i.color ? `/${i.color}` : ''})</span>
                              <span>× <b>{i.quantity}</b></span>
                              <span className="text-slate-400">@ ₹{i.unitCost.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        {totalQty}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ₹{p.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px] truncate max-w-xs">
                        {p.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeletePurchase(p)}
                          title="Delete Purchase"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Inward Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Supplier Purchase / Inward Stock"
        subtitle="Stock will be automatically added to selected variants and supplier record logged"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmitPurchase} className="space-y-4">
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supplier Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Surat Wholesale Hub"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Purchase Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notes / Invoice Ref
              </label>
              <input
                type="text"
                placeholder="e.g. Bill #8829"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Inward Items
              </span>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Variant</th>
                    <th className="px-3 py-2 w-24">Quantity</th>
                    <th className="px-3 py-2 w-28">Unit Cost (₹)</th>
                    <th className="px-3 py-2 text-right">Line Total (₹)</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const variants = prod?.variants || [];
                    const lineTotal = (item.quantity || 0) * (item.unitCost || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5">
                          <select
                            value={item.productId}
                            onChange={(e) => handleProductSelect(idx, Number(e.target.value))}
                            className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-1.5">
                          <select
                            value={item.variantId}
                            onChange={(e) => handleVariantSelect(idx, Number(e.target.value))}
                            className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.size || 'One size'} {v.color ? `· ${v.color}` : ''} (Stock: {v.currentStock})
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLine(idx, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => handleUpdateLine(idx, 'unitCost', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Total & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              Total Order Amount:{' '}
              <strong className="text-sm font-black text-slate-900 font-mono">
                ₹{lineItems.reduce((s, i) => s + (i.quantity * i.unitCost), 0).toFixed(2)}
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
                disabled={submitting || lineItems.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Commit Inward Stock'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
