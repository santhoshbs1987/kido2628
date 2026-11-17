import React, { useState, useEffect } from 'react';
import { RegisterShift } from '../types';
import { useUiStore } from '../stores/uiStore';
import { Modal } from '../components/common/Modal';
import { Coins, Circle, Lock, Unlock, AlertCircle, CheckCircle2, History } from 'lucide-react';

interface ShiftsPageProps {
  activeShift: RegisterShift | null;
  onShiftChanged: () => void;
}

export const ShiftsPage: React.FC<ShiftsPageProps> = ({ activeShift, onShiftChanged }) => {
  const addToast = useUiStore((state) => state.addToast);

  const [shiftsHistory, setShiftsHistory] = useState<RegisterShift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Open Shift Modal
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<number>(1000);
  const [openNotes, setOpenNotes] = useState<string>('');

  // Close Shift Modal
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [countedCash, setCountedCash] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await window.api.analytics.getShiftHistory();
      if (res.success) setShiftsHistory(res.data);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Load Error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [activeShift]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessing(true);
      const res = await window.api.analytics.openShift({
        openingFloat: Number(openingFloat) || 0,
        notes: openNotes || undefined
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Shift Opened',
          message: `Till opened with initial float of ₹${Number(openingFloat).toFixed(2)}.`
        });
        setShowOpenModal(false);
        onShiftChanged();
        loadHistory();
      } else {
        addToast({ type: 'error', title: 'Open Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Shift Error', message: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProcessing(true);
      const res = await window.api.analytics.closeShift({
        countedCash: Number(countedCash) || 0,
        notes: closeNotes || undefined
      });

      if (res.success) {
        const diff = res.data.cashDifference || 0;
        const diffMsg = diff === 0 ? 'Till balanced perfectly.' : diff > 0 ? `Cash Over by ₹${diff.toFixed(2)}.` : `Cash Short by ₹${Math.abs(diff).toFixed(2)}.`;
        addToast({
          type: 'success',
          title: 'Shift Closed & Reconciled',
          message: diffMsg
        });
        setShowCloseModal(false);
        onShiftChanged();
        loadHistory();
      } else {
        addToast({ type: 'error', title: 'Close Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Shift Error', message: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const discrepancy = activeShift ? (countedCash - activeShift.expectedCash) : 0;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100 gap-4">
      {/* Active Shift Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Current Register Till Status</h2>
                {activeShift ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                    Shift Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <Circle className="w-2 h-2 fill-amber-500 text-amber-500" />
                    Shift Closed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeShift
                  ? `Shift started on ${new Date(activeShift.openedAt).toLocaleDateString()} at ${new Date(
                      activeShift.openedAt
                    ).toLocaleTimeString()}`
                  : 'No active shift is currently open. Please open a shift to begin sales tracking.'}
              </p>
            </div>
          </div>

          <div>
            {activeShift ? (
              <button
                onClick={() => {
                  setCountedCash(activeShift.expectedCash);
                  setShowCloseModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Close Shift & Reconcile Till</span>
              </button>
            ) : (
              <button
                onClick={() => setShowOpenModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
              >
                <Unlock className="w-4 h-4" />
                <span>Open New Register Shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Counters */}
        {activeShift && (
          <div className="grid grid-cols-5 gap-4 pt-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Opening Float</span>
              <span className="text-lg font-black text-slate-800 font-mono mt-0.5 block">
                ₹{activeShift.openingFloat.toFixed(2)}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <span className="text-[11px] text-emerald-800 font-medium block">Cash Sales (+)</span>
              <span className="text-lg font-black text-emerald-700 font-mono mt-0.5 block">
                ₹{activeShift.totalCashSales.toFixed(2)}
              </span>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="text-[11px] text-blue-800 font-medium block">UPI Sales</span>
              <span className="text-lg font-black text-blue-700 font-mono mt-0.5 block">
                ₹{activeShift.totalUpiSales.toFixed(2)}
              </span>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
              <span className="text-[11px] text-purple-800 font-medium block">Card Sales</span>
              <span className="text-lg font-black text-purple-700 font-mono mt-0.5 block">
                ₹{activeShift.totalCardSales.toFixed(2)}
              </span>
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium block">Expected Cash in Till</span>
              <span className="text-xl font-black text-white font-mono mt-0.5 block">
                ₹{activeShift.expectedCash.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Shifts History Log */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Shift Closing & Reconciliation History
            </h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Shift ID</th>
                <th className="px-4 py-3">Opened At</th>
                <th className="px-4 py-3">Closed At</th>
                <th className="px-4 py-3 text-right">Opening Float (₹)</th>
                <th className="px-4 py-3 text-right">Expected Cash (₹)</th>
                <th className="px-4 py-3 text-right">Counted Cash (₹)</th>
                <th className="px-4 py-3 text-right">Difference (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Loading shift history...
                  </td>
                </tr>
              ) : shiftsHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No previous shifts recorded yet.
                  </td>
                </tr>
              ) : (
                shiftsHistory.map((s) => {
                  const diff = s.cashDifference ?? 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">
                        Shift #{s.id}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(s.openedAt).toLocaleDateString()} {new Date(s.openedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.closedAt
                          ? `${new Date(s.closedAt).toLocaleDateString()} ${new Date(s.closedAt).toLocaleTimeString()}`
                          : 'Currently Active'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        ₹{s.openingFloat.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        ₹{s.expectedCash.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {s.countedCash !== null && s.countedCash !== undefined
                          ? `₹${s.countedCash.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {s.status === 'CLOSED' ? (
                          <span
                            className={
                              diff === 0
                                ? 'text-emerald-600'
                                : diff > 0
                                ? 'text-blue-600'
                                : 'text-rose-600'
                            }
                          >
                            {diff === 0 ? 'Balanced' : diff > 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Shift Modal */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Open Register Shift"
        subtitle="Count initial physical cash float in drawer to start the day"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleOpenShift} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Opening Float Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              required
              value={openingFloat}
              onChange={(e) => setOpeningFloat(Number(e.target.value))}
              placeholder="1000"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Shift Notes / Cashier Name
            </label>
            <input
              type="text"
              placeholder="e.g. Morning counter start"
              value={openNotes}
              onChange={(e) => setOpenNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowOpenModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {processing ? 'Opening...' : 'Confirm & Open Shift'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Close Shift Modal */}
      {activeShift && (
        <Modal
          isOpen={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          title="Cash Till Reconciliation"
          subtitle="Count all physical cash currently in the drawer and reconcile against expected total"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCloseShift} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Opening Float:</span>
                <span className="font-mono font-bold">₹{activeShift.openingFloat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Cash Sales:</span>
                <span className="font-mono font-bold text-emerald-600">+₹{activeShift.totalCashSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Cash Refunds:</span>
                <span className="font-mono font-bold text-rose-600">-₹{activeShift.totalReturnsRefunded.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>System Expected Cash:</span>
                <span className="font-mono">₹{activeShift.expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Actual Cash Counted (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={countedCash}
                onChange={(e) => setCountedCash(Number(e.target.value))}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-lg font-black font-mono text-blue-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Discrepancy indicator */}
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              discrepancy === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : discrepancy > 0
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                {discrepancy === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>
                  {discrepancy === 0 ? 'Till Balanced' : discrepancy > 0 ? 'Cash Surplus (Over)' : 'Cash Deficit (Short)'}
                </span>
              </div>
              <span className="font-black font-mono text-sm">
                {discrepancy === 0 ? '₹0.00' : discrepancy > 0 ? `+₹${discrepancy.toFixed(2)}` : `-₹${Math.abs(discrepancy).toFixed(2)}`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Closing Remarks (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. End of day reconciliation by Santhosh"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {processing ? 'Closing...' : 'Close & Lock Shift'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
