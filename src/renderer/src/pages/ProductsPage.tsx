import React, { useState, useEffect } from 'react';
import { Product, ShopSettings } from '../types';
import { useUiStore } from '../stores/uiStore';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { FastStockInModal } from '../components/products/FastStockInModal';
import { LabelPrintModal } from '../components/products/LabelPrintModal';
import {
  Package,
  Plus,
  Search,
  Printer,
  Download,
  Edit2,
  Trash2,
  Barcode,
  AlertTriangle
} from 'lucide-react';

interface ProductsPageProps {
  settings: ShopSettings | null;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ settings }) => {
  const addToast = useUiStore((state) => state.addToast);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [showStockInModal, setShowStockInModal] = useState<boolean>(false);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [showLabelModal, setShowLabelModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, cRes] = await Promise.all([
        window.api.products.getAll({
          search: searchQuery || undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined
        }),
        window.api.products.getCategories()
      ]);

      if (pRes.success) setProducts(pRes.data);
      if (cRes.success) setCategories(cRes.data);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Data Load Failed', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDeleteProduct = async (product: Product) => {
    // 1. Safeguard: Check stock > 0
    if ((product.totalStock || 0) > 0) {
      alert(
        `Cannot delete product "${product.name}" (${product.sku}) because it still has active stock of ${product.totalStock} units. Please adjust or write off remaining inventory first.`
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${product.name}" (${product.sku})? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await window.api.products.delete(product.id);
      if (res.success) {
        addToast({ type: 'success', title: 'Product Deleted', message: res.data.message });
        loadData();
      } else {
        addToast({ type: 'error', title: 'Deletion Blocked', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Deletion Error', message: err.message });
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await window.api.export.products();
      if (res.success && res.data) {
        addToast({
          type: 'success',
          title: 'Excel Export Complete',
          message: `Saved inventory workbook to ${res.data.filePath}`
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
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or SKU / barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStockInModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Barcode className="w-4 h-4" />
            <span>Fast Stock Intake</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              setProductToEdit(null);
              setShowProductModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        {['All', ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">SKU / Barcode</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Sizes & Colours</th>
                <th className="px-4 py-3 text-right">Cost (₹)</th>
                <th className="px-4 py-3 text-right">Markup</th>
                <th className="px-4 py-3 text-right">Selling Price (₹)</th>
                <th className="px-4 py-3 text-center">Current Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    Loading inventory...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No products found matching your filter.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLowStock = (p.totalStock ?? 0) <= (settings?.lowStockThreshold ?? 3);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">
                        {p.sku}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(p.variants || []).map((v) => (
                            <span
                              key={v.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {v.size || 'One size'}
                              {v.color ? ` (${v.color})` : ''}: <b>{v.currentStock}</b>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        ₹{p.costPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {p.markupPercent}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ₹{p.sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                            (p.totalStock ?? 0) <= 0
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {p.totalStock ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setLabelProduct(p);
                              setShowLabelModal(true);
                            }}
                            title="Print Barcode Labels"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setProductToEdit(p);
                              setShowProductModal(true);
                            }}
                            title="Edit Product"
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete Product"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between">
          <span>Showing {products.length} products</span>
          <span>
            Total Stock Across Catalog:{' '}
            <strong className="text-slate-800 font-mono">
              {products.reduce((sum, p) => sum + (p.totalStock || 0), 0)} units
            </strong>
          </span>
        </div>
      </div>

      {/* Modals */}
      <ProductFormModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
        onSaved={loadData}
        categories={categories}
      />

      <FastStockInModal
        isOpen={showStockInModal}
        onClose={() => setShowStockInModal(false)}
        onSuccess={loadData}
      />

      <LabelPrintModal
        isOpen={showLabelModal}
        onClose={() => {
          setShowLabelModal(false);
          setLabelProduct(null);
        }}
        product={labelProduct}
        settings={settings}
      />
    </div>
  );
};
