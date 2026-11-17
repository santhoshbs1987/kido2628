import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { useUiStore } from '../stores/uiStore';
import { Modal } from '../components/common/Modal';
import { Users, Plus, Search, Download, Trash2, Edit2 } from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const addToast = useUiStore((state) => state.addToast);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [name, setName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await window.api.customers.getAll(search || undefined);
      if (res.success) setCustomers(res.data);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Load Error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const handleOpenAdd = () => {
    setCustomerToEdit(null);
    setName('');
    setMobile('');
    setShowModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setCustomerToEdit(c);
    setName(c.name);
    setMobile(c.mobile);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !name.trim()) return;

    try {
      setSubmitting(true);
      if (customerToEdit) {
        const res = await window.api.customers.update(customerToEdit.id, {
          name: name.trim(),
          mobile: mobile.trim()
        });
        if (res.success) {
          addToast({ type: 'success', title: 'Customer Updated', message: `Saved ${name}.` });
          setShowModal(false);
          loadCustomers();
        } else {
          addToast({ type: 'error', title: 'Update Failed', message: res.error });
        }
      } else {
        const res = await window.api.customers.create({
          name: name.trim(),
          mobile: mobile.trim()
        });
        if (res.success) {
          addToast({ type: 'success', title: 'Customer Added', message: `Added ${name}.` });
          setShowModal(false);
          loadCustomers();
        } else {
          addToast({ type: 'error', title: 'Add Failed', message: res.error });
        }
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Customer Error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (
      !window.confirm(
        `Are you sure you want to delete customer "${c.name}"? Deleting a customer leaves historical sales records intact.`
      )
    ) {
      return;
    }

    try {
      const res = await window.api.customers.delete(c.id);
      if (res.success) {
        addToast({ type: 'success', title: 'Customer Deleted', message: res.data.message });
        loadCustomers();
      } else {
        addToast({ type: 'error', title: 'Delete Failed', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Error', message: err.message });
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await window.api.export.customers();
      if (res.success && res.data) {
        addToast({
          type: 'success',
          title: 'CSV Export Complete',
          message: `Saved customer list to ${res.data.filePath}`
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Export Failed', message: err.message });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100 gap-4">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name or mobile number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Mobile Number</th>
                <th className="px-4 py-3 text-center">Total Invoices</th>
                <th className="px-4 py-3 text-right">Total Spent (₹)</th>
                <th className="px-4 py-3">Date Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No customer records found.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-600">
                      {c.mobile}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.totalBills ?? 0} bills
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ₹{(c.totalSpent ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.createdAt ? c.createdAt.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={customerToEdit ? `Edit Customer: ${customerToEdit.name}` : 'New Customer'}
        subtitle="Customer will be available for instant autocomplete during POS billing"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : customerToEdit ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
