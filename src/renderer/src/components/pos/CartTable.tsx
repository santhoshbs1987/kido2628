import React from 'react';
import { useCartStore } from '../../stores/cartStore';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';

export const CartTable: React.FC = () => {
  const { items, updateQuantity, updateDiscount, removeItem, clearCart } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h4 className="text-base font-bold text-slate-700">Billing Cart is Empty</h4>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          Scan a barcode sticker or type SKU to add items to this bill.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          Items in Cart ({items.reduce((s, i) => s + i.quantity, 0)})
        </span>
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to clear the active bill?')) {
              clearCart();
            }
          }}
          className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
        >
          Clear Cart
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center gap-3"
          >
            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {item.sku}
                </span>
                <h5 className="text-sm font-bold text-slate-800 truncate">{item.name}</h5>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>
                  Size: <b className="text-slate-700">{item.size || 'One size'}</b>
                </span>
                {item.color && (
                  <span>
                    Colour: <b className="text-slate-700">{item.color}</b>
                  </span>
                )}
                <span className="text-slate-400">·</span>
                <span>
                  Rate: <b className="text-slate-700 font-mono">₹{item.unitPrice.toFixed(2)}</b>
                </span>
              </div>
            </div>

            {/* Quantity Controls (Focus-preserving) */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                title="Decrease"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                className="w-12 text-center text-xs font-bold text-slate-800 font-mono py-1 focus:outline-none focus:bg-blue-50/50"
              />
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                title="Increase"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Line Discount Input */}
            <div className="w-20 shrink-0">
              <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">
                Item Disc (₹)
              </label>
              <input
                type="number"
                min="0"
                value={item.discount || ''}
                placeholder="0"
                onChange={(e) => updateDiscount(item.id, Number(e.target.value))}
                className="w-full px-2 py-1 text-xs font-mono font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Line Total */}
            <div className="w-24 text-right shrink-0">
              <span className="block text-xs font-black text-slate-900 font-mono">
                ₹{item.lineTotal.toFixed(2)}
              </span>
              {item.discount > 0 && (
                <span className="text-[10px] text-rose-500 font-medium">
                  -₹{item.discount.toFixed(2)}
                </span>
              )}
            </div>

            {/* Remove */}
            <button
              onClick={() => removeItem(item.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              title="Remove item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
