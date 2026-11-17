import React, { useState } from 'react';
import { ScanBar } from '../components/pos/ScanBar';
import { CartTable } from '../components/pos/CartTable';
import { CustomerLookup } from '../components/pos/CustomerLookup';
import { SettlementPanel } from '../components/pos/SettlementPanel';
import { VariantPickerModal } from '../components/pos/VariantPickerModal';
import { ReceiptPreviewModal } from '../components/pos/ReceiptPreviewModal';
import { Product, ProductVariant, Sale, ShopSettings, RegisterShift } from '../types';
import { useCartStore } from '../stores/cartStore';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useUiStore } from '../stores/uiStore';
import { AlertCircle } from 'lucide-react';

interface PosPageProps {
  settings: ShopSettings | null;
  activeShift?: RegisterShift | null;
}

export const PosPage: React.FC<PosPageProps> = ({ settings, activeShift }) => {
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);

  const addItem = useCartStore((state) => state.addItem);
  const addToast = useUiStore((state) => state.addToast);

  // Hardware barcode scanner buffer listener
  useBarcodeScanner({
    onScan: async (scannedBarcode) => {
      try {
        const res = await window.api.products.getBySku(scannedBarcode);
        if (res.success && res.data) {
          const product: Product = res.data;
          const variants = product.variants || [];

          if (variants.length === 1) {
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
            addToast({
              type: 'info',
              title: 'Scanned Item Added',
              message: `${product.name} (${v.size || 'One size'})`
            });
          } else if (variants.length > 1) {
            setPickerProduct(product);
            setShowPicker(true);
          }
        } else {
          addToast({
            type: 'warning',
            title: 'Barcode Not Found',
            message: `SKU "${scannedBarcode}" not in catalog.`
          });
        }
      } catch (err: any) {
        console.error('Hardware scan error:', err);
      }
    }
  });

  const handleSelectVariant = (variant: ProductVariant) => {
    if (!pickerProduct) return;
    addItem({
      productId: pickerProduct.id,
      variantId: variant.id,
      sku: pickerProduct.sku,
      name: pickerProduct.name,
      size: variant.size,
      color: variant.color,
      unitPrice: pickerProduct.sellingPrice,
      quantity: 1,
      discount: 0,
      maxStock: variant.currentStock
    });
    setShowPicker(false);
    setPickerProduct(null);
  };

  const handleSaleCompleted = (sale: Sale) => {
    setCompletedSale(sale);
    setShowReceipt(true);
  };

  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden bg-slate-100">
      {/* Left Column: Barcode Scan, Cart Table, Customer info */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {!activeShift && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <b>Shift is Closed:</b> Register cash till is not currently tracking. Open a shift to balance opening float & cash sales.
              </span>
            </div>
            <button
              onClick={() => useUiStore.getState().setActivePage('shifts')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition-colors"
            >
              Open Shift (F6)
            </button>
          </div>
        )}

        <ScanBar
          onOpenVariantPicker={(prod) => {
            setPickerProduct(prod);
            setShowPicker(true);
          }}
          onEmptyEnter={() => {
            document.getElementById('saveAndPrintBtn')?.click();
          }}
        />

        <CartTable />

        <CustomerLookup />
      </div>

      {/* Right Column: Settlement, Totals, Tender, Print */}
      <SettlementPanel
        settings={settings}
        onSaleCompleted={handleSaleCompleted}
      />

      {/* Modals */}
      <VariantPickerModal
        isOpen={showPicker}
        onClose={() => {
          setShowPicker(false);
          setPickerProduct(null);
        }}
        product={pickerProduct}
        onSelectVariant={handleSelectVariant}
      />

      <ReceiptPreviewModal
        isOpen={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          setCompletedSale(null);
        }}
        sale={completedSale}
        settings={settings}
      />
    </div>
  );
};
