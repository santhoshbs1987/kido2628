import React, { useState, useEffect } from 'react';
import { useUiStore, NavPage } from '../../stores/uiStore';
import { Clock, Plus, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onNewProduct?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewProduct }) => {
  const { activePage, setActivePage } = useUiStore();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) + ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pageTitles: Record<NavPage, { title: string; subtitle: string }> = {
    pos: { title: 'Point of Sale (POS)', subtitle: 'Fast scan & keyboard-driven counter billing' },
    products: { title: 'Products & Inventory', subtitle: 'Multi-variant catalog, stock intake & label printing' },
    reports: { title: 'Sales Register & Analytics', subtitle: 'Performance KPIs, shift reports & Excel exports' },
    purchases: { title: 'Supplier Purchases', subtitle: 'Inward inventory orders and cost tracking' },
    returns: { title: 'Returns & Exchanges', subtitle: 'Invoice verification, restock & damaged item write-offs' },
    customers: { title: 'Customer Directory', subtitle: 'CRM contacts, purchase history & exports' },
    shifts: { title: 'Register Shifts & Cash Drawer', subtitle: 'Daily opening float and till reconciliation' },
    settings: { title: 'Settings & Backups', subtitle: 'Hardware printers, automated snapshots & JSON migration' }
  };

  const currentMeta = pageTitles[activePage] || { title: 'KIDO 2628', subtitle: '' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none">
      <div>
        <h1 className="text-lg font-bold text-slate-800 leading-tight">{currentMeta.title}</h1>
        <p className="text-xs text-slate-400 font-medium">{currentMeta.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Date/Clock */}
        <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime}</span>
        </div>

        {/* Action Button: Quick Add Product */}
        {activePage === 'products' && onNewProduct && (
          <button
            onClick={onNewProduct}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </button>
        )}

        {/* Quick New Bill if not already on POS */}
        {activePage !== 'pos' && (
          <button
            onClick={() => setActivePage('pos')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Bill (F1)</span>
          </button>
        )}
      </div>
    </header>
  );
};
