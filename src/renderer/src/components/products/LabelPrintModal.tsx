import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ShopSettings } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { Printer, Eye } from 'lucide-react';
import { generateSingleLabelHtml } from '../../utils/barcode';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  settings: ShopSettings | null;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  isOpen,
  onClose,
  product,
  settings
}) => {
  const addToast = useUiStore((state) => state.addToast);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [printing, setPrinting] = useState<boolean>(false);
  const [previewVariantId, setPreviewVariantId] = useState<number | null>(null);

  useEffect(() => {
    if (product && product.variants) {
      const initialCounts: Record<number, number> = {};
      for (const v of product.variants) {
        initialCounts[v.id] = 1; // Default 1 label per variant
      }
      setCounts(initialCounts);
      if (product.variants.length > 0) {
        setPreviewVariantId(product.variants[0].id);
      }
    }
  }, [product, isOpen]);

  if (!product) return null;

  const totalLabels = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);

  const handleSetCount = (variantId: number, val: number) => {
    setCounts((prev) => ({
      ...prev,
      [variantId]: Math.max(0, Math.min(500, Math.round(val || 0)))
    }));
  };

  const handleSetAllCounts = (count: number) => {
    const updated: Record<number, number> = {};
    for (const v of product.variants || []) {
      updated[v.id] = count;
    }
    setCounts(updated);
  };

  const handleMatchStock = () => {
    const updated: Record<number, number> = {};
    for (const v of product.variants || []) {
      updated[v.id] = Math.max(0, v.currentStock);
    }
    setCounts(updated);
  };

  const handlePrint = async (silent: boolean) => {
    if (totalLabels === 0) {
      addToast({ type: 'warning', title: 'Zero labels selected', message: 'Set label quantity > 0.' });
      return;
    }
    if (totalLabels > 500) {
      addToast({ type: 'warning', title: 'Batch limit', message: 'Maximum 500 labels in one batch.' });
      return;
    }

    try {
      setPrinting(true);

      // Generate concatenated HTML for all requested labels
      let labelsHtml = '';
      for (const v of product.variants || []) {
        const qty = counts[v.id] || 0;
        for (let i = 0; i < qty; i++) {
          labelsHtml += generateSingleLabelHtml({
            shopName: settings?.shopName || 'KIDO 2628',
            name: product.name,
            category: product.category,
            size: v.size,
            color: v.color,
            sku: product.sku,
            price: product.sellingPrice
          });
        }
      }

      const res = await window.api.print.labels(labelsHtml, { silent });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Labels Dispatched',
          message: `Sent ${totalLabels} barcode label(s) to printer.`
        });
        onClose();
      } else {
        addToast({ type: 'error', title: 'Print Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Print Error', message: err.message });
    } finally {
      setPrinting(false);
    }
  };

  const previewVariant = (product.variants || []).find((v) => v.id === previewVariantId) || product.variants?.[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Barcode Label Batch Printer"
      subtitle={`Print 63mm × 34mm sticky labels for "${product.name}" (${product.sku})`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Top: Live Label Preview & Info */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Live Sticker Preview (63mm × 34mm)</span>
            </span>

            {/* Sticker Preview Container */}
            <div className="flex justify-center p-2 bg-slate-200/60 rounded-xl border border-slate-300">
              {previewVariant ? (
                <div
                  className="shadow-md rounded-sm overflow-hidden"
                  dangerouslySetInnerHTML={{
                    __html: generateSingleLabelHtml({
                      shopName: settings?.shopName || 'KIDO 2628',
                      name: product.name,
                      category: product.category,
                      size: previewVariant.size,
                      color: previewVariant.color,
                      sku: product.sku,
                      price: product.sellingPrice
                    })
                  }}
                />
              ) : (
                <div className="text-xs text-slate-400 p-4">No variant selected</div>
              )}
            </div>
          </div>

          {/* Quick presets & batch summary */}
          <div className="flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Total Labels in Batch:</span>
                <span className="text-2xl font-black text-blue-600 font-mono">{totalLabels}</span>
                <span className="text-xs text-slate-400 ml-1">stickers</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-600 mb-1.5 block">
                  Quick Quantity Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSetAllCounts(1)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-sm transition-colors"
                  >
                    1 Each
                  </button>
                  <button
                    onClick={() => handleSetAllCounts(5)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-sm transition-colors"
                  >
                    5 Each
                  </button>
                  <button
                    onClick={handleMatchStock}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 shadow-sm transition-colors"
                  >
                    Match In-Stock
                  </button>
                  <button
                    onClick={() => handleSetAllCounts(0)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-600 text-xs font-semibold rounded-lg border border-slate-200 shadow-sm transition-colors"
                  >
                    Reset (0)
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
              Heading: <b className="text-slate-700">{settings?.shopName || 'KIDO 2628'} · 基多</b>
              <br />
              MRP: <b className="text-slate-700">₹{product.sellingPrice.toFixed(2)}</b>
            </div>
          </div>
        </div>

        {/* Variants label counts table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
              <tr>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2">In Stock</th>
                <th className="px-3 py-2 w-32">Stickers to Print</th>
                <th className="px-3 py-2 text-right">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(product.variants || []).map((v) => (
                <tr
                  key={v.id}
                  className={`hover:bg-slate-50 ${previewVariantId === v.id ? 'bg-blue-50/40' : ''}`}
                >
                  <td className="px-3 py-2 font-bold text-slate-800">
                    {v.size || 'One size'} {v.color ? `· ${v.color}` : ''}
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono">{v.currentStock}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={counts[v.id] ?? 0}
                      onChange={(e) => handleSetCount(v.id, Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs font-bold font-mono text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => setPreviewVariantId(v.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded hover:bg-blue-50"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handlePrint(false)}
              disabled={printing || totalLabels === 0}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50"
            >
              Print with Dialog...
            </button>
            <button
              onClick={() => handlePrint(true)}
              disabled={printing || totalLabels === 0}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{printing ? 'Printing...' : `Print ${totalLabels} Labels (Silent)`}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
