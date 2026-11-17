import React, { useState, useRef } from 'react';
import { useCartStore } from '../../stores/cartStore';
import { User, Phone, X } from 'lucide-react';

export const CustomerLookup: React.FC = () => {
  const { customerName, customerMobile, setCustomer } = useCartStore();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceTimerRef = useRef<any>(null);

  const handleMobileChange = (mobileVal: string) => {
    setCustomer({ name: customerName, mobile: mobileVal });

    clearTimeout(debounceTimerRef.current);
    if (mobileVal.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await window.api.customers.getAll(mobileVal.trim());
          if (res.success && res.data) {
            setSuggestions(res.data);
            const exact = res.data.find((c: any) => c.mobile === mobileVal.trim());
            if (exact) {
              setCustomer({ id: exact.id, name: exact.name, mobile: exact.mobile });
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 150);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (c: any) => {
    setCustomer({ id: c.id, name: c.name, mobile: c.mobile });
    setSuggestions([]);
  };

  const clearCustomer = () => {
    setCustomer({ id: null, name: '', mobile: '' });
    setSuggestions([]);
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <User className="w-3.5 h-3.5 text-blue-600" />
          <span>Customer Information</span>
        </div>
        {(customerMobile || customerName) && (
          <button
            onClick={clearCustomer}
            className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 font-medium transition-colors"
          >
            <X className="w-3 h-3" /> Walk-in
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Mobile Input */}
        <div className="relative">
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Mobile Number
          </label>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={customerMobile}
              onChange={(e) => handleMobileChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
              {suggestions.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectSuggestion(c)}
                  className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-800">{c.name}</span>
                    <span className="text-slate-400 ml-2 font-mono">{c.mobile}</span>
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium">Select</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Name Input */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Customer Name
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Walk-in Customer"
              value={customerName}
              onChange={(e) => setCustomer({ mobile: customerMobile, name: e.target.value })}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
