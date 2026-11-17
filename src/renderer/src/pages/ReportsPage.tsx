import React, { useState, useEffect } from 'react';
import { Sale, ShopSettings } from '../types';
import { useUiStore } from '../stores/uiStore';
import { ReceiptPreviewModal } from '../components/pos/ReceiptPreviewModal';
import {
  TrendingUp,
  DollarSign,
  Download,
  Search,
  Eye,
  ShoppingBag,
  RotateCcw
} from 'lucide-react';

interface ReportsPageProps {
  settings: ShopSettings | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ settings }) => {
  const addToast = useUiStore((state) => state.addToast);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStartStr = todayStr.slice(0, 7) + '-01';

  const [fromDate, setFromDate] = useState<string>(monthStartStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [sales, setSales] = useState<Sale[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Receipt preview
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesRes, metricsRes] = await Promise.all([
        window.api.sales.getAll({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          search: searchQuery || undefined
        }),
        window.api.analytics.getMetrics({ fromDate, toDate })
      ]);

      if (salesRes.success) setSales(salesRes.data);
      if (metricsRes.success) setMetrics(metricsRes.data);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Data Load Failed', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExportSalesExcel = async () => {
    try {
      const res = await window.api.export.sales({ fromDate, toDate });
      if (res.success && res.data) {
        addToast({
          type: 'success',
          title: 'Excel Export Complete',
          message: `Saved Sales Register to ${res.data.filePath}`
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Export Error', message: err.message });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100 gap-4">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        {/* Today's Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Today's Net Sales
            </span>
            <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
              ₹{metrics ? metrics.todaySales.toFixed(2) : '0.00'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">
              Profit: ₹{metrics ? metrics.todayProfit.toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* This Month's Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Month-to-Date Net Sales
            </span>
            <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
              ₹{metrics ? metrics.monthSales.toFixed(2) : '0.00'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">
              Profit: ₹{metrics ? metrics.monthProfit.toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Date Filtered Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Filtered Range Net Sales
            </span>
            <span className="text-xl font-black text-blue-600 font-mono mt-0.5 block">
              ₹{metrics ? metrics.filteredSales.toFixed(2) : '0.00'}
            </span>
            <span className="text-[11px] text-slate-500">
              {metrics ? metrics.filteredBills : 0} Bills · Net Profit: ₹{metrics ? metrics.filteredProfit.toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Returns in Filtered Range */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Returns Refunded
            </span>
            <span className="text-xl font-black text-rose-600 font-mono mt-0.5 block">
              ₹{metrics ? metrics.filteredReturnAmount.toFixed(2) : '0.00'}
            </span>
            <span className="text-[11px] text-slate-500">
              {metrics ? metrics.filteredReturns : 0} return entries deducted
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar & Export */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        {/* Date pickers */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xs relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>

        {/* Export Button */}
        <button
          onClick={handleExportSalesExcel}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Sales Excel (.xlsx)</span>
        </button>
      </div>

      {/* Sales Register Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Items Summary</th>
                <th className="px-4 py-3 text-right">Subtotal (₹)</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    Loading sales records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No sales found for the selected period.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {s.invoiceNo}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {s.createdAt.slice(0, 10)} {s.createdAt.slice(11, 16)}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {s.customerName || 'Walk-in'}
                      {s.customerMobile && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {s.customerMobile}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs text-slate-600 truncate">
                      {(s.items || []).map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      ₹{s.subtotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-500">
                      {s.discountAmount > 0 ? `-₹${s.discountAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                      ₹{s.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedSale(s);
                          setShowReceipt(true);
                        }}
                        title="View / Print Thermal Receipt"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          setSelectedSale(null);
        }}
        sale={selectedSale}
        settings={settings}
      />
    </div>
  );
};
