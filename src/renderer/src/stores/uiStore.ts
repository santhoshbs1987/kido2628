import { create } from 'zustand';

export type NavPage = 'pos' | 'products' | 'purchases' | 'returns' | 'customers' | 'reports' | 'shifts' | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface UiState {
  activePage: NavPage;
  toasts: ToastMessage[];

  setActivePage: (page: NavPage) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'pos',
  toasts: [],

  setActivePage: (page) => set({ activePage: page }),

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));
