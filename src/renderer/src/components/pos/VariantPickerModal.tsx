import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductVariant } from '../../types';
import { Check, Package } from 'lucide-react';

interface VariantPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSelectVariant: (variant: ProductVariant) => void;
}

export const VariantPickerModal: React.FC<VariantPickerModalProps> = ({
  isOpen,
  onClose,
  product,
  onSelectVariant
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const variants = product?.variants || [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [product, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < variants.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (variants[selectedIndex]) {
          onSelectVariant(variants[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, variants, selectedIndex, onSelectVariant]);

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Variant"
      subtitle={`Choose size & colour for "${product.name}" (${product.sku})`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Use <strong className="text-slate-700">↑ ↓ Arrow Keys</strong> to navigate and{' '}
          <strong className="text-slate-700">Enter</strong> to select.
        </p>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {variants.map((v, idx) => {
            const isSelected = idx === selectedIndex;
            const isOutOfStock = v.currentStock <= 0;

            return (
              <div
                key={v.id}
                onClick={() => onSelectVariant(v)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`cursor-pointer p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">
                        {v.size || 'One Size'}
                      </span>
                      {v.color && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-100 text-pink-700">
                          {v.color}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      MRP: <span className="font-semibold text-slate-700">₹{product.sellingPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-700'
                        : v.currentStock <= 3
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {v.currentStock} in stock
                  </span>
                  {isSelected && (
                    <div className="text-[10px] text-blue-600 font-semibold mt-1 flex items-center justify-end gap-1">
                      <Check className="w-3 h-3" /> Press Enter
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
