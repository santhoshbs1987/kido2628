import React from 'react';
import { Database, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

interface StatusBarProps {
  lowStockCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ lowStockCount }) => {
  const setActivePage = useUiStore((state) => state.setActivePage);

  return (
    <footer className="h-7 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-[11px] text-slate-400 select-none shrink-0 font-medium">
      {/* Left: DB & Security Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Database className="w-3.5 h-3.5" />
          <span>SQLite WAL · ACID Transactions</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Offline-First (Zero Cloud Dependency)</span>
        </div>
      </div>

      {/* Center: Low stock warnings */}
      {lowStockCount > 0 ? (
        <button
          onClick={() => setActivePage('products')}
          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{lowStockCount} variant(s) low on stock</span>
        </button>
      ) : (
        <span className="text-slate-500">All product stock levels healthy</span>
      )}

      {/* Right: Keyboard navigation reminders */}
      <div className="flex items-center gap-3 text-slate-500">
        <span>
          <strong className="text-slate-300 font-mono">F1</strong> POS
        </span>
        <span>
          <strong className="text-slate-300 font-mono">F2</strong> Stock
        </span>
        <span>
          <strong className="text-slate-300 font-mono">F3</strong> Reports
        </span>
        <span>
          <strong className="text-slate-300 font-mono">Esc</strong> Cancel
        </span>
      </div>
    </footer>
  );
};
