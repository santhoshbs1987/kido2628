import React, { useState, useEffect } from 'react';
import { ShopSettings } from '../types';
import { useUiStore } from '../stores/uiStore';
import {
  Store,
  Printer,
  Database,
  Download,
  Upload,
  Save,
  RefreshCw
} from 'lucide-react';

interface SettingsPageProps {
  settings: ShopSettings | null;
  onSettingsUpdated: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsUpdated }) => {
  const addToast = useUiStore((state) => state.addToast);

  // Form states
  const [shopName, setShopName] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone1, setPhone1] = useState<string>('');
  const [phone2, setPhone2] = useState<string>('');
  const [upiVpa, setUpiVpa] = useState<string>('');
  const [upiName, setUpiName] = useState<string>('');
  const [receiptPrinter, setReceiptPrinter] = useState<string>('');
  const [labelPrinter, setLabelPrinter] = useState<string>('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(true);
  const [backupPath, setBackupPath] = useState<string>('');
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(3);

  const [printers, setPrinters] = useState<Array<{ name: string; isDefault: boolean }>>([]);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName || '');
      setSubtitle(settings.subtitle || '');
      setAddress(settings.address || '');
      setPhone1(settings.phone1 || '');
      setPhone2(settings.phone2 || '');
      setUpiVpa(settings.upiVpa || '');
      setUpiName(settings.upiName || '');
      setReceiptPrinter(settings.receiptPrinter || '');
      setLabelPrinter(settings.labelPrinter || '');
      setAutoBackupEnabled(settings.autoBackupEnabled);
      setBackupPath(settings.backupPath || '');
      setLowStockThreshold(settings.lowStockThreshold || 3);
    }
  }, [settings]);

  const loadPrinters = async () => {
    try {
      const res = await window.api.settings.getPrinters();
      if (res.success && res.data) {
        setPrinters(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await window.api.settings.update({
        shopName,
        subtitle,
        address,
        phone1,
        phone2,
        upiVpa,
        upiName,
        receiptPrinter,
        labelPrinter,
        autoBackupEnabled,
        backupPath,
        lowStockThreshold: Number(lowStockThreshold) || 3
      });

      if (res.success) {
        addToast({ type: 'success', title: 'Settings Saved', message: 'Shop details and hardware configuration updated.' });
        onSettingsUpdated();
      } else {
        addToast({ type: 'error', title: 'Save Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Settings Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const res = await window.api.backup.exportJson();
      if (res.success && res.data) {
        addToast({ type: 'success', title: 'JSON Backup Downloaded', message: `Saved to ${res.data.filePath}` });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Export Failed', message: e.message });
    }
  };

  const handleImportJson = async () => {
    if (!window.confirm('Restoring a backup will replace current database records with the backup snapshot. Continue?')) {
      return;
    }
    try {
      const res = await window.api.backup.importJson();
      if (res.success && res.data) {
        addToast({ type: 'success', title: 'Restore Complete', message: res.data.message });
        onSettingsUpdated();
      } else if (res.error !== 'Cancelled by user.') {
        addToast({ type: 'error', title: 'Restore Failed', message: res.error });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Restore Error', message: e.message });
    }
  };

  const handleExportSqlite = async () => {
    try {
      const res = await window.api.backup.exportSqlite();
      if (res.success && res.data) {
        addToast({ type: 'success', title: 'SQLite Database Exported', message: `Saved to ${res.data.filePath}` });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Export Failed', message: e.message });
    }
  };

  const handleImportSqlite = async () => {
    if (!window.confirm('Restoring a SQLite file will overwrite current database records. Continue?')) {
      return;
    }
    try {
      const res = await window.api.backup.importSqlite();
      if (res.success) {
        addToast({ type: 'success', title: 'Database Restored', message: 'SQLite database successfully reloaded.' });
        onSettingsUpdated();
      } else if (res.error !== 'Cancelled by user.') {
        addToast({ type: 'error', title: 'Restore Failed', message: res.error });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Restore Error', message: e.message });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-100 gap-6">
      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Store Profile Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Store className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Store Profile & Heading</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Store Name
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Store Subtitle
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Shop Address (Printed on Receipts)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Contact Phone 1
              </label>
              <input
                type="text"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Contact Phone 2
              </label>
              <input
                type="text"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                UPI VPA (Virtual Payment Address)
              </label>
              <input
                type="text"
                placeholder="e.g. 8147464651@upi"
                value={upiVpa}
                onChange={(e) => setUpiVpa(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                UPI Payee Name
              </label>
              <input
                type="text"
                value={upiName}
                onChange={(e) => setUpiName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Hardware & Printers Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800">Hardware & Thermal Printers</h3>
            </div>
            <button
              type="button"
              onClick={loadPrinters}
              className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Printers
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                POS Receipt Printer (72mm / 80mm Silent Print)
              </label>
              <select
                value={receiptPrinter}
                onChange={(e) => setReceiptPrinter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">(None - Show Print Dialog)</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Barcode Sticker Printer (63mm × 34mm)
              </label>
              <select
                value={labelPrinter}
                onChange={(e) => setLabelPrinter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">(None - Show Print Dialog)</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Low Stock Threshold (Units)
              </label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Database & Backups Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Database Snapshots & Data Portability</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Enable Automated Daily SQLite Snapshot to Documents/Kido2628_Backups/</span>
            </label>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Custom Backup Directory (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank for default (Documents/Kido2628_Backups/)"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Backup / Restore Action Buttons */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Full JSON Backup</span>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Compatible with legacy v1.40 JSON backups as well as modern v2.0 snapshots.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleImportJson}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Restore JSON
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Raw SQLite Database File</span>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Direct online binary snapshot (.sqlite) for 100% full-fidelity cross-machine backup.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportSqlite}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export .sqlite
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSqlite}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Restore .sqlite
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
