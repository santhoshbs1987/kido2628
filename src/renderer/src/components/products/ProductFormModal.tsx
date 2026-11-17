import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product } from '../../types';
import { useUiStore } from '../../stores/uiStore';
import { Trash2, Sparkles, Layers } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSaved: () => void;
  categories: string[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSaved,
  categories
}) => {
  const addToast = useUiStore((state) => state.addToast);

  const [sku, setSku] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('General');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [markupPercent, setMarkupPercent] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);

  // Variant Matrix inputs
  const [sizesInput, setSizesInput] = useState<string>('2Y, 3Y, 4Y');
  const [colorsInput, setColorsInput] = useState<string>('Pink, Blue');
  const [variants, setVariants] = useState<
    Array<{ id?: number; size: string; color: string; openingStock: number; currentStock?: number }>
  >([]);

  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (productToEdit) {
      setSku(productToEdit.sku);
      setName(productToEdit.name);
      setCategory(productToEdit.category || 'General');
      setCostPrice(productToEdit.costPrice || 0);
      setMarkupPercent(productToEdit.markupPercent || 0);
      setSellingPrice(productToEdit.sellingPrice || 0);

      const existingVars = (productToEdit.variants || []).map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        openingStock: v.openingStock,
        currentStock: v.currentStock
      }));
      setVariants(existingVars);

      const uniqueSizes = Array.from(new Set(existingVars.map((v) => v.size).filter(Boolean))).join(', ');
      const uniqueColors = Array.from(new Set(existingVars.map((v) => v.color).filter(Boolean))).join(', ');
      setSizesInput(uniqueSizes);
      setColorsInput(uniqueColors);
    } else {
      // New product defaults
      setSku('');
      setName('');
      setCategory('Boys');
      setCostPrice(0);
      setMarkupPercent(30);
      setSellingPrice(0);
      setSizesInput('2Y, 3Y, 4Y');
      setColorsInput('');
      setVariants([
        { size: '2Y', color: '', openingStock: 2 },
        { size: '3Y', color: '', openingStock: 2 },
        { size: '4Y', color: '', openingStock: 2 }
      ]);
    }
  }, [productToEdit, isOpen]);

  // Recalculate selling price when cost or markup changes
  const handleCostChange = (newCost: number) => {
    setCostPrice(newCost);
    if (markupPercent > 0) {
      const sp = Math.round((newCost * (1 + markupPercent / 100)) * 100) / 100;
      setSellingPrice(sp);
    }
  };

  const handleMarkupChange = (newMarkup: number) => {
    setMarkupPercent(newMarkup);
    if (costPrice > 0) {
      const sp = Math.round((costPrice * (1 + newMarkup / 100)) * 100) / 100;
      setSellingPrice(sp);
    }
  };

  const handlePriceChange = (newPrice: number) => {
    setSellingPrice(newPrice);
    if (costPrice > 0) {
      const markup = Math.round((((newPrice - costPrice) / costPrice) * 100) * 10) / 10;
      setMarkupPercent(Math.max(0, markup));
    }
  };

  // Generate Matrix
  const handleGenerateMatrix = () => {
    const rawSizes = sizesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const rawColors = colorsInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const sizes = rawSizes.length > 0 ? rawSizes : ['One size'];
    const colors = rawColors.length > 0 ? rawColors : [''];

    const newMatrix: Array<{ size: string; color: string; openingStock: number }> = [];

    for (const s of sizes) {
      for (const c of colors) {
        // Retain existing opening stock if available
        const existing = variants.find(
          (v) => v.size.toLowerCase() === s.toLowerCase() && v.color.toLowerCase() === c.toLowerCase()
        );
        newMatrix.push({
          size: s,
          color: c,
          openingStock: existing ? existing.openingStock : 1
        });
      }
    }

    setVariants(newMatrix);
  };

  const handleStockChange = (idx: number, stock: number) => {
    const updated = [...variants];
    updated[idx].openingStock = Math.max(0, stock);
    setVariants(updated);
  };

  const handleRemoveVariant = (idx: number) => {
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sku.trim()) {
      addToast({ type: 'warning', title: 'Missing SKU', message: 'Enter SKU / Barcode.' });
      return;
    }
    if (!name.trim()) {
      addToast({ type: 'warning', title: 'Missing Name', message: 'Enter product name.' });
      return;
    }
    if (variants.length === 0) {
      addToast({ type: 'warning', title: 'Missing Variants', message: 'Add at least one size/colour variant.' });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        costPrice: Number(costPrice) || 0,
        markupPercent: Number(markupPercent) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        variants: variants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          openingStock: Number(v.openingStock) || 0
        }))
      };

      if (productToEdit) {
        const res = await window.api.products.update({ id: productToEdit.id, ...payload });
        if (res.success) {
          addToast({ type: 'success', title: 'Product Updated', message: `Updated "${res.data.name}".` });
          onSaved();
          onClose();
        } else {
          addToast({ type: 'error', title: 'Update Failed', message: res.error });
        }
      } else {
        const res = await window.api.products.create(payload);
        if (res.success) {
          addToast({ type: 'success', title: 'Product Created', message: `Added "${res.data.name}" with ${variants.length} variant(s).` });
          onSaved();
          onClose();
        } else {
          addToast({ type: 'error', title: 'Creation Failed', message: res.error });
        }
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? `Edit Product: ${productToEdit.name}` : 'New Product & Variant Matrix'}
      subtitle="Define master SKU, sizes, colours, and opening inventory"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: SKU & Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              SKU / Barcode <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. KD-2024-01"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Korean Floral Summer Dress"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Row 2: Category, Cost, Markup, Selling Price */}
        <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
            <input
              type="text"
              list="categoryOptions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <datalist id="categoryOptions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cost Price (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPrice || ''}
              onChange={(e) => handleCostChange(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Markup (%)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={markupPercent || ''}
              onChange={(e) => handleMarkupChange(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Selling Price (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice || ''}
              onChange={(e) => handlePriceChange(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-black font-mono text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Variant Matrix Generator */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Variant Matrix Generator</span>
            </div>
            <button
              type="button"
              onClick={handleGenerateMatrix}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Combinations</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Sizes (comma-separated)
              </label>
              <input
                type="text"
                value={sizesInput}
                onChange={(e) => setSizesInput(e.target.value)}
                placeholder="e.g. 2Y, 3Y, 4Y, 5Y"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Colours (optional, comma-separated)
              </label>
              <input
                type="text"
                value={colorsInput}
                onChange={(e) => setColorsInput(e.target.value)}
                placeholder="e.g. Pink, Blue, Beige"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Variants Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Colour</th>
                  <th className="px-3 py-2 w-32">Opening Stock</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-bold text-slate-800">{v.size || 'One size'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{v.color || '—'}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        value={v.openingStock}
                        onChange={(e) => handleStockChange(idx, Number(e.target.value))}
                        className="w-20 px-2 py-1 text-xs font-bold font-mono text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : productToEdit ? 'Save Changes' : 'Save Product & Variants'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
