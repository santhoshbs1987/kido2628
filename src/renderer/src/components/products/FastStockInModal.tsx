import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductVariant } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { Barcode, Check } from 'lucide-react';

interface FastStockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FastStockInModal: React.FC<FastStockInModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const addToast = useUiStore((state) => state.addToast);

  const [sku, setSku] = useState<string>('');
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [cost, setCost] = useState<number>(0);
  const [supplier, setSupplier] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLookup = async () => {
    if (!sku.trim()) return;
    try {
      const res = await window.api.products.getBySku(sku.trim());
      if (res.success && res.data) {
        const p: Product = res.data;
        setProduct(p);
        setCost(p.costPrice || 0);
        if (p.variants && p.variants.length > 0) {
          setSelectedVariant(p.variants[0]);
        }
      } else {
        addToast({ type: 'warning', title: 'Product not found', message: `No product with SKU ${sku}.` });
        setProduct(null);
        setSelectedVariant(null);
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Lookup Error', message: e.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !selectedVariant) {
      addToast({ type: 'warning', title: 'Select variant', message: 'Please select a variant to add stock.' });
      return;
    }

    try {
      setLoading(true);
      const res = await window.api.inventory.fastStockIn({
        sku: product.sku,
        size: selectedVariant.size,
        color: selectedVariant.color,
        quantity: Number(quantity) || 1,
        cost: Number(cost) || 0,
        supplier: supplier || 'Counter Stock In',
        notes: notes || undefined
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Stock Added',
          message: res.data.message
        });
        onSuccess();
        onClose();
      } else {
        addToast({ type: 'error', title: 'Failed to add stock', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Stock In Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fast Scanner Stock Intake"
      subtitle="Scan existing barcode to quickly add received units to inventory"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Barcode Search */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Scan / Type Barcode
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Scan or enter SKU..."
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookup();
                  }
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Lookup
            </button>
          </div>
        </div>

        {/* Product Details if matched */}
        {product && (
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-blue-900">{product.name}</span>
              <span className="text-[10px] font-mono font-bold bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                {product.sku}
              </span>
            </div>

            {/* Variant Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Select Variant (Size / Colour)
              </label>
              <select
                value={selectedVariant?.id}
                onChange={(e) => {
                  const v = product.variants?.find((x) => x.id === Number(e.target.value));
                  if (v) setSelectedVariant(v);
                }}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(product.variants || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.size || 'One size'} {v.color ? `· ${v.color}` : ''} (Current Stock: {v.currentStock})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity to Add */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Qty to Add
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Unit Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Supplier & Batch Note */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Supplier Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Surat Lot"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Batch / Intake Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inward Lot 24A"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !product}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{loading ? 'Adding...' : 'Add to Inventory'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
