import React from 'react';
import { useUiStore, NavPage } from '../../stores/uiStore';
import {
  ShoppingCart,
  Package,
  BarChart3,
  Truck,
  RotateCcw,
  Users,
  Coins,
  Settings,
  Circle
} from 'lucide-react';
import { RegisterShift } from '../../types';

interface SidebarProps {
  activeShift: RegisterShift | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeShift }) => {
  const { activePage, setActivePage } = useUiStore();

  const navItems: Array<{ id: NavPage; label: string; icon: any; shortcut: string }> = [
    { id: 'pos', label: 'POS Billing', icon: ShoppingCart, shortcut: 'F1' },
    { id: 'products', label: 'Products & Stock', icon: Package, shortcut: 'F2' },
    { id: 'reports', label: 'Sales & Analytics', icon: BarChart3, shortcut: 'F3' },
    { id: 'purchases', label: 'Supplier Purchases', icon: Truck, shortcut: 'F4' },
    { id: 'returns', label: 'Returns & Exchange', icon: RotateCcw, shortcut: 'F5' },
    { id: 'customers', label: 'Customer CRM', icon: Users, shortcut: 'F8' },
    { id: 'shifts', label: 'Till & Shifts', icon: Coins, shortcut: 'F6' },
    { id: 'settings', label: 'Settings & Backup', icon: Settings, shortcut: 'F7' }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl">
              K
            </div>
            <div>
              <div className="text-xl font-black tracking-wide leading-none">
                <span className="text-blue-400">KI</span>
                <span className="text-pink-400">DO</span>{' '}
                <span className="text-sky-300">26</span>
                <span className="text-purple-400">28</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-tight mt-1">
                Imported Korean Kids wear
              </div>
            </div>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.shortcut}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Till / Shift Status footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div
          onClick={() => setActivePage('shifts')}
          className="cursor-pointer p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Cash Drawer</span>
            {activeShift ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400" />
                Shift Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Circle className="w-1.5 h-1.5 fill-amber-400 text-amber-400" />
                Shift Closed
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Till Cash:</span>
            <span className="text-sm font-bold text-white font-mono">
              ₹{activeShift ? Number(activeShift.expectedCash || 0).toFixed(2) : '0.00'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
