import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  products: {
    getAll: (filters?: { search?: string; category?: string }) => ipcRenderer.invoke('products:getAll', filters),
    getBySku: (sku: string) => ipcRenderer.invoke('products:getBySku', sku),
    getById: (id: number) => ipcRenderer.invoke('products:getById', id),
    create: (input: any) => ipcRenderer.invoke('products:create', input),
    update: (input: any) => ipcRenderer.invoke('products:update', input),
    delete: (id: number) => ipcRenderer.invoke('products:delete', id),
    getCategories: () => ipcRenderer.invoke('products:getCategories')
  },
  inventory: {
    fastStockIn: (input: any) => ipcRenderer.invoke('inventory:fastStockIn', input),
    getLowStock: (threshold?: number) => ipcRenderer.invoke('inventory:getLowStock', threshold),
    getTransactions: (filter?: { variantId?: number; sku?: string }) => ipcRenderer.invoke('inventory:getTransactions', filter)
  },
  sales: {
    getNextInvoiceNo: () => ipcRenderer.invoke('sales:getNextInvoiceNo'),
    create: (input: any) => ipcRenderer.invoke('sales:create', input),
    getAll: (filters?: { fromDate?: string; toDate?: string; search?: string }) => ipcRenderer.invoke('sales:getAll', filters),
    getByInvoiceNo: (invoiceNo: string) => ipcRenderer.invoke('sales:getByInvoiceNo', invoiceNo)
  },
  purchases: {
    create: (input: any) => ipcRenderer.invoke('purchases:create', input),
    getAll: (filters?: { fromDate?: string; toDate?: string; supplier?: string }) => ipcRenderer.invoke('purchases:getAll', filters),
    delete: (id: number) => ipcRenderer.invoke('purchases:delete', id)
  },
  returns: {
    lookupInvoice: (invoiceNo: string) => ipcRenderer.invoke('returns:lookupInvoice', invoiceNo),
    create: (input: any) => ipcRenderer.invoke('returns:create', input),
    getAll: (filters?: { fromDate?: string; toDate?: string }) => ipcRenderer.invoke('returns:getAll', filters),
    void: (id: number) => ipcRenderer.invoke('returns:void', id)
  },
  customers: {
    getAll: (search?: string) => ipcRenderer.invoke('customers:getAll', search),
    findByMobile: (mobile: string) => ipcRenderer.invoke('customers:findByMobile', mobile),
    create: (input: any) => ipcRenderer.invoke('customers:create', input),
    update: (id: number, data: any) => ipcRenderer.invoke('customers:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('customers:delete', id)
  },
  analytics: {
    getMetrics: (filters: { fromDate?: string; toDate?: string }) => ipcRenderer.invoke('analytics:getMetrics', filters),
    getActiveShift: () => ipcRenderer.invoke('analytics:getActiveShift'),
    openShift: (data: { openingFloat: number; notes?: string }) => ipcRenderer.invoke('analytics:openShift', data),
    closeShift: (data: { countedCash: number; notes?: string }) => ipcRenderer.invoke('analytics:closeShift', data),
    getShiftHistory: () => ipcRenderer.invoke('analytics:getShiftHistory')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input: any) => ipcRenderer.invoke('settings:update', input),
    getPrinters: () => ipcRenderer.invoke('settings:getPrinters'),
    autoDetectPrinters: () => ipcRenderer.invoke('settings:autoDetectPrinters')
  },
  backup: {
    exportJson: () => ipcRenderer.invoke('backup:exportJson'),
    importJson: () => ipcRenderer.invoke('backup:importJson'),
    exportSqlite: () => ipcRenderer.invoke('backup:exportSqlite'),
    importSqlite: () => ipcRenderer.invoke('backup:importSqlite')
  },
  export: {
    sales: (filters?: { fromDate?: string; toDate?: string }) => ipcRenderer.invoke('export:sales', filters),
    products: () => ipcRenderer.invoke('export:products'),
    purchases: (filters?: { fromDate?: string; toDate?: string }) => ipcRenderer.invoke('export:purchases', filters),
    customers: () => ipcRenderer.invoke('export:customers')
  },
  print: {
    receipt: (sale: any, options?: { silent?: boolean; deviceName?: string; format?: string }) => ipcRenderer.invoke('print:receipt', { sale, options }),
    labels: (html: string, options?: { silent?: boolean; deviceName?: string; format?: string }) => ipcRenderer.invoke('print:labels', { html, options }),
    testPrint: (printerName?: string, type?: 'receipt' | 'label') => ipcRenderer.invoke('print:testPrint', { printerName, type })
  }
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore
  window.api = api;
}
