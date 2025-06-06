const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const userConfigPath = path.join(app.getPath('userData'), 'config.json')
const isPackaged = app.isPackaged

const defaultConfigPath = isPackaged
  ? path.join(process.resourcesPath, 'assets', 'config.json') // producción
  : path.join(__dirname, '..', 'assets', 'config.json') // desarrollo (ajustado)

console.log('Ruta defaultConfigPath:', defaultConfigPath)
console.log('Existe defaultConfigPath?', fs.existsSync(defaultConfigPath))

function asegurarConfig () {
  if (!fs.existsSync(userConfigPath)) {
    try {
      fs.copyFileSync(defaultConfigPath, userConfigPath)
      console.log('config.json copiado desde los valores por defecto.')
    } catch (err) {
      console.error('Error al copiar config.json:', err)
    }
  } else {
    console.log('config.json ya existe, no se sobrescribe.')
  }
}

function getLocalizedTimestampForFilename () {
  const now = new Date()

  const localeString = now.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  return localeString
    .replace(/[/:]/g, '-')
    .replace(', ', '_')
}

// Configuración de la base de datos sqlite
const dbPath = path.join(app.getPath('userData'), 'Invoices.db')
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    // console.log('Error al conectar con la base de datos:', err)
  } else {
    // console.log('Base de datos conectada correctamente.')

    // Crear tabla de facturas
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS Invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,       -- ID único de la factura
          payment_type TEXT NOT NULL,                 -- Tipo de pago (efectivo, tarjeta, etc.)
          total REAL NOT NULL,                        -- Total de la factura
          total_efectivo REAL NULL,
          total_tarjeta REAL NULL,
          created_at TEXT DEFAULT (datetime('now', 'localtime')), -- Fecha y hora de creación
          synced INTEGER DEFAULT 0                    -- Indica si la factura ha sido sincronizada con Firebase
        )
      `, (err) => {
        if (err) {
          // console.log('Error al crear la tabla Invoices:', err)
        } else {
          // console.log('Tabla "Invoices" creada o ya existe.')
        }
      })

      // Crear tabla de productos de la factura
      db.run(`
        CREATE TABLE IF NOT EXISTS InvoiceItems (
          id INTEGER PRIMARY KEY AUTOINCREMENT,       -- ID único de los productos en la factura
          invoice_id INTEGER NOT NULL,                -- ID de la factura a la que pertenece este producto
          product_name TEXT NOT NULL,                 -- Nombre del producto
          quantity INTEGER NOT NULL,                  -- Cantidad del producto
          price REAL NOT NULL,                        -- Precio unitario del producto
          discount REAL NOT NULL DEFAULT 0,           -- Descuento aplicado al producto
          total REAL NOT NULL,                        -- Total para este producto (cantidad * precio * descuento)
          type TEXT NOT NULL,                         -- Tipo de producto 
          FOREIGN KEY (invoice_id) REFERENCES Invoices (id) -- Relación con la tabla Invoices
        )
      `, (err) => {
        if (err) {
          // console.log('Error al crear la tabla InvoiceItems:', err)
        } else {
          // console.log('Tabla "InvoiceItems" creada o ya existe.')
        }
      })
    })
  }
})

// Función para agregar una factura y sus productos
ipcMain.handle('db:add-invoice', (event, invoice) => {
  // Insertar la factura en la tabla Invoices
  const { productos, total, tipoPago, multipagos } = invoice
  let efectivo = null
  let tarjeta = null

  if (multipagos && Array.isArray(multipagos) && multipagos.length === 2) {
    efectivo = multipagos[0]
    tarjeta = multipagos[1]
  }

  db.serialize(() => {
    // Insertar la factura
    db.run(`
      INSERT INTO Invoices (payment_type, total, total_efectivo, total_tarjeta)
      VALUES (?, ?, ?, ?)
    `, [tipoPago, total, efectivo, tarjeta], function (err) {
      if (err) {
        console.error('Error al insertar factura:', err)
        return
      }

      const invoiceId = this.lastID // Obtener el ID

      // Insertar los productos de la factura en la tabla InvoiceItems
      const stmt = db.prepare(`
        INSERT INTO InvoiceItems (invoice_id, product_name, quantity, price, discount, total, type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      productos.forEach(product => {
        stmt.run(
          invoiceId,
          product.nombre,
          product.cantidad,
          product.precio,
          product.descuento,
          product.total,
          product.tipo
        )
      })

      stmt.finalize()

      // console.log('Factura insertada correctamente con ID:', invoiceId)
    })
  })
})

ipcMain.handle('db:get-invoices', (event) => {
  // Obtener todas las facturas
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Invoices ORDER BY created_at DESC', [], (err, rows) => {
      if (err) {
        console.error('Error al obtener facturas:', err)
        reject(err)
        return
      }
      resolve(rows)
    })
  })
})

ipcMain.handle('db:download-invoices', async () => {
  try {
    const desktopDir = app.getPath('desktop')
    const folderPath = path.join(desktopDir, 'FacturasDescargadas')

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true })
    }

    const timestamp = getLocalizedTimestampForFilename()
    const filePath = path.join(folderPath, `facturas_${timestamp}.csv`)

    const getAllInvoicesWithItems = () => {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            i.id AS invoice_id,
            i.payment_type,
            i.total,
            i.total_efectivo,
            i.total_tarjeta,
            i.created_at,
            ii.product_name,
            ii.quantity,
            ii.price,
            ii.discount,
            ii.total AS item_total,
            ii.type
          FROM Invoices i
          LEFT JOIN InvoiceItems ii ON i.id = ii.invoice_id
          ORDER BY i.id ASC
        `, (err, rows) => {
          if (err) return reject(err)
          resolve(rows)
        })
      })
    }

    const rows = await getAllInvoicesWithItems()

    const header = [
      'Factura ID', 'Tipo de Pago', 'Total', 'Total Efectivo', 'Total Tarjeta', 'Fecha',
      'Producto', 'Cantidad', 'Precio', 'Descuento', 'Total Producto', 'Tipo de Producto'
    ]

    const csvContent = [header.join(',')]

    for (const row of rows) {
      const line = [
        row.invoice_id,
        row.payment_type,
        row.total,
        row.total_efectivo,
        row.total_tarjeta,
        row.created_at,
        row.product_name,
        row.quantity,
        row.price,
        row.discount,
        row.item_total,
        row.type
      ].map(v => (v !== null ? `"${v}"` : '')).join(',')
      csvContent.push(line)
    }

    fs.writeFileSync(filePath, csvContent.join('\n'), 'utf8')

    // OPCIONAL: abrir la carpeta
    shell.openPath(folderPath)

    return { success: true, message: 'Archivo CSV generado correctamente.', path: filePath }
  } catch (err) {
    console.error('Error al generar el CSV:', err)
    return { success: false, message: err.message }
  }
})

const loadProducts = () => {
  // Cargar productos al inicio
  try {
    const data = fs.readFileSync(userConfigPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error al leer config.json:', error)
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 800,

    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.loadFile('./src/index.html')
}

app.whenReady().then(() => {
  createWindow()
  asegurarConfig()
  // Enviar productos al renderer
  ipcMain.handle('get-products', () => {
    return loadProducts()
  })

  // Manejar la adición de productos
  ipcMain.handle('add-product', (event, product) => {
    try {
      const data = fs.readFileSync(userConfigPath, 'utf-8')
      const config = JSON.parse(data)

      if (!Array.isArray(config.products)) {
        config.products = []
      }

      config.products.push(product)
      fs.writeFileSync(userConfigPath, JSON.stringify(config, null, 2))

      return { success: true, message: 'Producto agregado correctamente' }
    } catch (error) {
      console.error('Error al agregar producto:', error)
      throw new Error('Error al agregar producto')
    }
  })

  // Guardar productos (editar varios)
  ipcMain.handle('save-product', (event, product) => {
    // console.log('Guardando productos:', product)
    try {
      const products = Object.values(product)
      fs.writeFileSync(userConfigPath, JSON.stringify({ products }, null, 2))
      return { success: true, message: 'Productos guardados correctamente' }
    } catch (error) {
      console.error('Error al guardar productos:', error)
      return { success: false, message: 'Error al guardar productos' }
    }
  })

  // Eliminar un producto
  ipcMain.handle('delete-product', async (event, productId) => {
    try {
      const data = fs.readFileSync(userConfigPath, 'utf-8')
      const config = JSON.parse(data)

      if (!Array.isArray(config.products)) {
        throw new Error('El archivo no contiene una lista de productos válida.')
      }

      const updatedProducts = config.products.filter(product => product.id !== productId)
      const newConfig = { ...config, products: updatedProducts }

      fs.writeFileSync(userConfigPath, JSON.stringify(newConfig, null, 2), 'utf-8')

      return { success: true, message: 'Producto eliminado correctamente' }
    } catch (error) {
      console.error('Error al eliminar el producto:', error)
      return { success: false, message: 'Error al eliminar el producto' }
    }
  })

  ipcMain.handle('calc-total', (event, product) => {
    const { quantity, price, discount } = product

    if (typeof quantity !== 'number' || typeof price !== 'number' || typeof discount !== 'number') {
      throw new Error('Los valores enviados son inválidos')
    }
    const total = quantity * price * ((100 - discount) / 100)
    return total
  })

  ipcMain.handle('history-button', async () => {
    try {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM Invoices  ORDER BY created_at DESC', [], (err, rows) => {
          if (err) {
            console.error('Error al obtener facturas:', err)
            reject(err)
            return
          }
          resolve(rows)
        })
      })
    } catch (error) {
      console.error('Error al manejar el history-button:', error)
      throw error
    }
  })
  // Obtener los productos de una factura
  ipcMain.handle('get-invoiceDetail', async (event, invoiceId) => {
    try {
      return new Promise((resolve, reject) => {
        // Obtener los productos asociados a la factura por su ID
        db.all('SELECT * FROM InvoiceItems WHERE invoice_id = ?', [invoiceId], (err, rows) => {
          if (err) {
            console.error('Error al obtener productos de la factura:', err)
            reject(err)
            return
          }
          resolve(rows) // Enviar los productos de la factura
        })
      })
    } catch (error) {
      console.error('Error al manejar el get-invoice-details:', error)
      throw error
    }
  })
  // Filtrar facturas por fecha
  ipcMain.handle('filter-by-date', async (event, date) => {
    try {
      if (!date) {
        throw new Error('Debe proporcionar una fecha para filtrar.')
      }

      return new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM Invoices WHERE DATE(created_at) = DATE(?) ORDER BY created_at DESC',
          [date],
          (err, rows) => {
            if (err) {
              console.error('Error al filtrar facturas por fecha:', err)
              reject(err)
              return
            }
            if (rows.length === 0) {
              // console.log('No se encontraron facturas para la fecha:', date)
            }
            resolve(rows)
          }
        )
      })
    } catch (error) { console.error('Error al manejar el history-button:', error) }
  })
  // Obtener el balance diario o de una fecha especifica
  ipcMain.handle('daily-balance', async (event, date) => {
    try {
      if (!date) {
        throw new Error('Debe proporcionar un día para filtrar.')
      }

      return new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            payment_type,
            SUM(total) AS total_ganado,
            SUM(total_efectivo) AS total_efectivo,
            SUM(total_tarjeta) AS total_tarjeta
          FROM Invoices
          WHERE DATE(created_at) = DATE(?)
          GROUP BY payment_type
          ORDER BY payment_type ASC
          `,
          [date],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener el balance diario:', err)
              reject(err)
              return
            }
            if (rows.length === 0) {
              // console.log('No se encontraron ventas para la fecha:', date)
              resolve([]) // Devolver un arreglo vacío si no hay ventas
            } else {
              const balance = {
                total_general: rows.reduce((sum, row) => sum + row.total_ganado, 0),
                desglose: rows.map(row => ({
                  tipo_pago: row.payment_type,
                  total: row.total_ganado,
                  efectivo: row.total_efectivo,
                  tarjeta: row.total_tarjeta
                }))
              }
              resolve(balance)
            }
          }
        )
      })
    } catch (error) {
      console.error('Error al manejar el history-button:', error)
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
})
