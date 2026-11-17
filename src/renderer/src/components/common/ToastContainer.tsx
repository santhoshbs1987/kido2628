import React from 'react';
import { useUiStore } from '../../stores/uiStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          info: <Info className="w-5 h-5 text-sky-500 shrink-0" />
        };

        const borders = {
          success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
          error: 'border-rose-200 bg-rose-50 text-rose-900',
          warning: 'border-amber-200 bg-amber-50 text-amber-900',
          info: 'border-sky-200 bg-sky-50 text-sky-900'
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all animate-in slide-in-from-bottom-5 duration-200 ${borders[toast.type]}`}
          >
            {icons[toast.type]}
            <div className="flex-1 text-sm">
              <p className="font-semibold leading-tight">{toast.title}</p>
              {toast.message && <p className="text-xs opacity-90 mt-1 leading-normal">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
