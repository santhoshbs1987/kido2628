import React, { useState, useEffect } from 'react';
import { useUiStore } from './stores/uiStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { StatusBar } from './components/layout/StatusBar';
import { ToastContainer } from './components/common/ToastContainer';
import { PosPage } from './pages/PosPage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { ShiftsPage } from './pages/ShiftsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShopSettings, RegisterShift } from './types';

export const App: React.FC = () => {
  const activePage = useUiStore((state) => state.activePage);
  useKeyboardShortcuts();

  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [activeShift, setActiveShift] = useState<RegisterShift | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  const loadAppSettings = async () => {
    try {
      const [sRes, shiftRes, lowRes] = await Promise.all([
        window.api.settings.get(),
        window.api.analytics.getActiveShift(),
        window.api.inventory.getLowStock()
      ]);

      if (sRes.success) setSettings(sRes.data);
      if (shiftRes.success) setActiveShift(shiftRes.data);
      if (lowRes.success) setLowStockCount(lowRes.data.length);
    } catch (e) {
      console.error('App init error:', e);
    }
  };

  useEffect(() => {
    loadAppSettings();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar activeShift={activeShift} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activePage === 'pos' && <PosPage settings={settings} activeShift={activeShift} />}
          {activePage === 'products' && <ProductsPage settings={settings} />}
          {activePage === 'purchases' && <PurchasesPage />}
          {activePage === 'returns' && <ReturnsPage />}
          {activePage === 'customers' && <CustomersPage />}
          {activePage === 'reports' && <ReportsPage settings={settings} />}
          {activePage === 'shifts' && (
            <ShiftsPage
              activeShift={activeShift}
              onShiftChanged={loadAppSettings}
            />
          )}
          {activePage === 'settings' && (
            <SettingsPage
              settings={settings}
              onSettingsUpdated={loadAppSettings}
            />
          )}
        </main>

        <StatusBar lowStockCount={lowStockCount} />
      </div>

      {/* Toasts */}
      <ToastContainer />
    </div>
  );
};
