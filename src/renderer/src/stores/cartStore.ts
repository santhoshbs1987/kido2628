import { create } from 'zustand';
import { CartItem } from '../types';

interface CartState {
  items: CartItem[];
  customerId: number | null;
  customerName: string;
  customerMobile: string;
  discountPercent: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Split' | 'Other';
  tenderedAmount: number;
  notes: string;

  // Actions
  addItem: (item: Omit<CartItem, 'id' | 'lineTotal'>) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateDiscount: (id: string, discount: number) => void;
  removeItem: (id: string) => void;
  setCustomer: (customer: { id?: number | null; name: string; mobile: string }) => void;
  setDiscountPercent: (percent: number) => void;
  setPaymentMethod: (method: 'Cash' | 'UPI' | 'Card' | 'Split' | 'Other') => void;
  setTenderedAmount: (amount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;

  // Computed helpers
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getGrandTotal: () => number;
  getChangeDue: () => number;
  getTotalItemsCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customerName: '',
  customerMobile: '',
  discountPercent: 0,
  paymentMethod: 'Cash',
  tenderedAmount: 0,
  notes: '',

  addItem: (newItem) => {
    set((state) => {
      const lineId = `${newItem.sku}-${newItem.variantId || 'default'}-${newItem.size || ''}-${newItem.color || ''}`;
      const existingIdx = state.items.findIndex((i) => i.id === lineId);

      if (existingIdx >= 0) {
        const updated = [...state.items];
        const item = updated[existingIdx];
        const newQty = item.quantity + (newItem.quantity || 1);
        const itemDiscount = item.discount || 0;
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          lineTotal: Math.max(0, item.unitPrice * newQty - itemDiscount)
        };
        return { items: updated };
      } else {
        const qty = newItem.quantity || 1;
        const discount = newItem.discount || 0;
        const lineTotal = Math.max(0, newItem.unitPrice * qty - discount);
        return {
          items: [
            ...state.items,
            {
              ...newItem,
              id: lineId,
              quantity: qty,
              discount,
              lineTotal
            }
          ]
        };
      }
    });
  },

  updateQuantity: (id, qty) => {
    set((state) => {
      const safeQty = Math.max(1, Math.round(Number(qty) || 1));
      const items = state.items.map((item) => {
        if (item.id === id) {
          const discount = Math.min(item.unitPrice * safeQty, item.discount);
          return {
            ...item,
            quantity: safeQty,
            discount,
            lineTotal: Math.max(0, item.unitPrice * safeQty - discount)
          };
        }
        return item;
      });
      return { items };
    });
  },

  updateDiscount: (id, discount) => {
    set((state) => {
      const items = state.items.map((item) => {
        if (item.id === id) {
          const safeDiscount = Math.min(item.unitPrice * item.quantity, Math.max(0, Number(discount) || 0));
          return {
            ...item,
            discount: safeDiscount,
            lineTotal: Math.max(0, item.unitPrice * item.quantity - safeDiscount)
          };
        }
        return item;
      });
      return { items };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id)
    }));
  },

  setCustomer: (customer) => {
    set({
      customerId: customer.id || null,
      customerName: customer.name || '',
      customerMobile: customer.mobile || ''
    });
  },

  setDiscountPercent: (percent) => {
    set({ discountPercent: Math.max(0, Math.min(100, Number(percent) || 0)) });
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method });
  },

  setTenderedAmount: (amount) => {
    set({ tenderedAmount: Math.max(0, Number(amount) || 0) });
  },

  setNotes: (notes) => {
    set({ notes });
  },

  clearCart: () => {
    set({
      items: [],
      customerId: null,
      customerName: '',
      customerMobile: '',
      discountPercent: 0,
      paymentMethod: 'Cash',
      tenderedAmount: 0,
      notes: ''
    });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.lineTotal, 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const percent = get().discountPercent;
    if (percent > 0) {
      return Math.round(((subtotal * percent) / 100) * 100) / 100;
    }
    return 0;
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    return Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  },

  getChangeDue: () => {
    const grandTotal = get().getGrandTotal();
    const tendered = get().tenderedAmount;
    if (tendered > grandTotal) {
      return Math.round((tendered - grandTotal) * 100) / 100;
    }
    return 0;
  },

  getTotalItemsCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  }
}));
