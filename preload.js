// console.log('preload cargado correctamente')

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('paletteAPI', {
  Products: {
    getProducts: async () => {
      return await ipcRenderer.invoke('get-products')
    },
    addProduct: async (product) => {
      return await ipcRenderer.invoke('add-product', product)
    },
    saveProducts: async (product) => {
      return await ipcRenderer.invoke('save-product', product)
    },
    deleteProduct: async (productId) => {
      return await ipcRenderer.invoke('delete-product', productId)
    }
  },
  Invoice: {
    addInvoice: async (invoice) => {
      return await ipcRenderer.invoke('db:add-invoice', invoice)
    },
    getInvoice: async () => {
      return await ipcRenderer.invoke('db:get-invoices')
    },
    downloadInvoices: async (invoiceId) => {
      return await ipcRenderer.invoke('db:download-invoices', invoiceId)
    }
  },
  Operations: {
    calcTotal: async (product) => {
      return await ipcRenderer.invoke('calc-total', product)
    },
    filterByDate: async (date) => {
      return await ipcRenderer.invoke('filter-by-date', date)
    },
    filterByDay: async (day) => {
      return await ipcRenderer.invoke('daily-balance', day)
    }
  },

  Calls: {
    historyButton: async () => {
      return await ipcRenderer.invoke('history-button')
    },

    detailButton: async (invoiceId) => {
      return await ipcRenderer.invoke('get-invoiceDetail', invoiceId)
    }
  },

  Printer: {
    printTicket: async (invoice) => {
      return await ipcRenderer.invoke('print-ticket', invoice)
    }
  }
})
