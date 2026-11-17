import React, { useState, useRef, useEffect } from 'react';
import { useCartStore } from '../../stores/cartStore';
import { useUiStore } from '../../stores/uiStore';
import { Barcode } from 'lucide-react';
import { Product } from '../../types';

interface ScanBarProps {
  onOpenVariantPicker: (product: Product) => void;
}

export const ScanBar: React.FC<ScanBarProps> = ({ onOpenVariantPicker }) => {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const addToast = useUiStore((state) => state.addToast);

  useEffect(() => {
    // Keep focus on barcode input for fast counter checkout
    inputRef.current?.focus();
  }, []);

  const handleProcessBarcode = async (barcodeVal: string) => {
    const clean = barcodeVal.trim();
    if (!clean) return;

    try {
      setLoading(true);
      const res = await window.api.products.getBySku(clean);

      if (res.success && res.data) {
        const product: Product = res.data;
        const variants = product.variants || [];

        if (variants.length === 0) {
          addToast({
            type: 'error',
            title: 'No variants configured',
            message: `Product ${product.name} has no variant data.`
          });
        } else if (variants.length === 1) {
          // Exactly 1 variant: add directly to cart!
          const v = variants[0];
          addItem({
            productId: product.id,
            variantId: v.id,
            sku: product.sku,
            name: product.name,
            size: v.size,
            color: v.color,
            unitPrice: product.sellingPrice,
            quantity: 1,
            discount: 0,
            maxStock: v.currentStock
          });
          setQuery('');
        } else {
          // Multiple variants: open fast variant picker modal!
          setQuery('');
          onOpenVariantPicker(product);
        }
      } else {
        addToast({
          type: 'warning',
          title: 'Product not found',
          message: `SKU / Barcode "${clean}" is not in product catalog.`
        });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Lookup Error', message: e.message });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleProcessBarcode(query);
    }
  };

  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <Barcode className="w-6 h-6" />
      </div>

      <div className="flex-1 relative">
        <input
          id="barcodeScanInput"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scan barcode sticker or type SKU and press Enter..."
          disabled={loading}
          autoComplete="off"
          className="w-full pl-3 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
        />
        <button
          onClick={() => handleProcessBarcode(query)}
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md text-xs font-bold transition-colors"
        >
          {loading ? '...' : 'Add'}
        </button>
      </div>
    </div>
  );
};
