// console.log('renderer.js cargado correctamente')

document.addEventListener('DOMContentLoaded', async () => {
  const productsContainer = document.querySelector('.products-list')
  const selectedProductsTableBody = document.querySelector('.selected-products-table tbody')
  const amountPaidInput = document.getElementById('amount-paid')
  const changeReturn = document.getElementById('change-return')
  const calculateReturnButton = document.querySelector('.calculate-return-button')
  const payButton = document.querySelector('.pay-button')
  const radioButton = document.querySelectorAll('input[name="payment"]')
  const multipagoContainer = document.querySelector('.multipago-container')
  const multiefectivo = document.getElementById('amount-paid-efectivo')
  const multiother = document.getElementById('amount-paid-other')
  const validationMessageInput = document.getElementById('validation-message-input')
  const validationMessageValue = document.getElementById('validation-message-value')
  const validationMessageTotal = document.getElementById('validation-message-total')
  const confirmationModal = document.getElementById('confirmation-modal')
  const confirmButton = document.getElementById('confirm-payment')
  const cancelButton = document.getElementById('cancel-payment')
  const syncButton = document.getElementById('sync-button')
  const addProductButton = document.getElementById('add-product-button')
  const Productsform = document.getElementById('product-form')
  const productModal = document.getElementById('add-product-modal')
  const formCloseButton = document.getElementById('close-form-modal')
  const selectedProducts = {}

  try {
    const { products } = await window.paletteAPI.Products.getProducts() // Extrae 'products'
    if (!products || products.length === 0) {
      // console.log('No se encontraron productos en el archivo config.json.')
      return
    }

    function getNextId () {
      try {
        if (!Array.isArray(products)) {
          throw new Error('La variable "products" no es un arreglo.')
        }

        // Crear un Set con todos los IDs existentes válidos (números positivos enteros)
        const existingIds = new Set(
          products
            .map(p => p.id)
            .filter(id => Number.isInteger(id) && id >= 0)
        )

        let nextId = 1
        while (existingIds.has(nextId)) {
          nextId++
        }

        return nextId
      } catch (error) {
        console.error('Error al obtener el siguiente ID:', error)
        return 1
      }
    }

    function updateProductList (filteredProducts) {
      productsContainer.innerHTML = ''

      filteredProducts.forEach(product => {
        const productBlock = document.createElement('div')
        productBlock.classList.add('product-item')

        productBlock.innerHTML = `
          <h3>${product.name}</h3>
          <p class="price">$${product.price}</p>
          <button class="add-to-cart" data-product-id="${product.name}">+</button>
        `
        productBlock.querySelector('.add-to-cart').addEventListener('click', () => addProductToSelection(product))
        productsContainer.appendChild(productBlock)
      })
    }

    updateProductList(products)

    function addProductToSelection (product) {
      const productId = product.id
      if (selectedProducts[productId]) {
        selectedProducts[productId].quantity += 1
      } else {
        selectedProducts[productId] = {
          ...product,
          quantity: 1,
          discount: 0
        }
      }
      updateSelectedProductsTable()
    }

    // Actualizar tabla de productos seleccionados
    async function updateSelectedProductsTable () {
      const fragment = document.createDocumentFragment()
      const selectedProductsContainer = document.querySelector('.selected-products-container')
      // Ocultar contenedor durante la actualización
      selectedProductsContainer.classList.add('hidden')

      // Eliminar filas sin usar innerHTML
      while (selectedProductsTableBody.firstChild) {
        selectedProductsTableBody.removeChild(selectedProductsTableBody.firstChild)
      }

      for (const product of Object.values(selectedProducts)) {
        const productTotal = await window.paletteAPI.Operations.calcTotal(product)

        // Crear la fila
        const productRow = document.createElement('tr')
        productRow.classList.add('adding') // Clase de animación inicial

        productRow.innerHTML = `
          <td>${product.name}</td>
          <td>
            <input type="number" value="${product.quantity}" class="quantity-input" min="1" data-product-id="${product.id}">
          </td>
          <td>$${product.price.toLocaleString('es-CO')}</td>
          <td>
            <input type="number" value="${product.discount}" class="discount-input" min="0" max="100" data-product-id="${product.id}">
          </td>
          <td class="total-cell">$${productTotal.toLocaleString('es-CO')}</td>
          <td><button class="delete-product" data-product-id="${product.id}">Eliminar</button></td>
        `

        // Agregar eventos
        productRow.querySelector('.discount-input').addEventListener('input', handleDiscountChange)
        productRow.querySelector('.quantity-input').addEventListener('input', handleQuantityChange)
        productRow.querySelector('.delete-product').addEventListener('click', handleDeleteProduct)

        // Agregar la fila al fragmento
        fragment.appendChild(productRow)

        setTimeout(() => {
          productRow.classList.remove('adding')
          productRow.classList.add('added')
        }, 50)
      }

      // Agregar todo el fragmento al DOM de una sola vez
      selectedProductsTableBody.appendChild(fragment)
      // Actualizar el total
      updateTotal()
    }

    function handleQuantityChange (event) {
      const input = event.target
      const productId = input.getAttribute('data-product-id')
      const quantity = parseInt(input.value) || 0

      selectedProducts[productId].quantity = quantity
      updateSelectedProductsTable()
    }

    function handleDiscountChange (event) {
      const input = event.target
      const productId = input.getAttribute('data-product-id')
      const discount = Math.min(Math.max(parseFloat(input.value) || 0, 0), 100)

      selectedProducts[productId].discount = discount
      updateSelectedProductsTable()
    }

    function handleDeleteProduct (event) {
      const button = event.currentTarget
      const productId = button.getAttribute('data-product-id')

      delete selectedProducts[productId]

      updateSelectedProductsTable()
    }

    function updateReturn (total) {
      calculateReturnButton.addEventListener('click', () => {
        const amountPaid = parseFloat(amountPaidInput.value) || 0
        const change = amountPaid - total
        if (change >= 0) {
          changeReturn.textContent = `Vuelto: $${change.toLocaleString('es-CO')}`
        } else {
          changeReturn.textContent = 'La cantidad dada por el cliente es menor que el total a pagar!'
        }
      })
    }

    function updateTotal () {
      let total = 0

      document.querySelectorAll('.total-cell').forEach(cell => {
        const numericValue = parseFloat(cell.textContent.replace(/\$|,/g, '').replace(/\./g, ''))
        total += numericValue || 0
      })

      const totalDisplay = document.querySelector('#total-display')
      if (totalDisplay) {
        totalDisplay.textContent = `Total: $${total.toLocaleString('es-CO')}`
      }
      updateReturn(total)
    }

    async function filterProducts () {
      const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(input => input.value)
      const result = await window.paletteAPI.Products.getProducts()
      const updateProducts = result.products
      // console.log('Productos filtrados:', updateProducts)
      const filteredProducts = updateProducts.filter(product => {
        return selectedCategories.length === 0 || selectedCategories.includes(product.type)
      })

      updateProductList(filteredProducts)
    }

    document.querySelectorAll('input[name="category"]').forEach(checkbox => {
      checkbox.addEventListener('change', filterProducts)
    })

    async function saveInvoice (invoice) {
      try {
        await window.paletteAPI.Invoice.addInvoice(invoice)
      } catch (error) {
        console.error('Error al guardar la factura:', error)
      }
    }

    function calculateTotalFromProducts (selectedProducts) {
      return Object.values(selectedProducts).reduce((acc, product) => {
        return acc + (product.quantity * product.price * ((100 - product.discount) / 100))
      }, 0)
    }

    function showSuccess () {
      const successModal = document.getElementById('success-modal')
      const closeButton = document.getElementById('close-success-modal')
      successModal.style.display = 'block'

      closeButton.addEventListener('click', () => {
        successModal.style.display = 'none'
      })
      setTimeout(() => {
        successModal.style.display = 'none'
      }, 5000)
    }

    function showAddSuccess () {
      const successAdd = document.getElementById('success-add-modal')
      const closeAdd = document.getElementById('close-add-success-modal')
      successAdd.style.display = 'block'

      closeAdd.addEventListener('click', () => {
        successAdd.style.display = 'none'
      })
      setTimeout(() => {
        successAdd.style.display = 'none'
      }, 5000)
    }

    function showSyncSuccess () {
      const successSync = document.getElementById('success-sync')
      const closeSync = document.getElementById('close-success-sync')
      successSync.style.display = 'block'

      closeSync.addEventListener('click', () => {
        successSync.style.display = 'none'
      })
      setTimeout(() => {
        successSync.style.display = 'none'
      }, 5000)
    }

    function showSyncError () {
      const errorSync = document.getElementById('error-sync')
      const closeErrorSync = document.getElementById('close-error-sync')
      errorSync.style.display = 'block'

      closeErrorSync.addEventListener('click', () => {
        errorSync.style.display = 'none'
      })
      setTimeout(() => {
        errorSync.style.display = 'none'
      }, 5000)
    }

    radioButton.forEach((rbutton) => {
      rbutton.addEventListener('change', (event) => {
        const selectedPayment = event.target.value
        if (selectedPayment === 'multipagoNequi' || selectedPayment === 'multipagoBancolombia') {
          // Mostrar campos de multipago
          multipagoContainer.style.display = 'block' // Mostrar
        } else {
          multipagoContainer.style.display = 'none' // Ocultar
        }
      })
    })

    confirmButton.addEventListener('click', async () => {
      const total = calculateTotalFromProducts(selectedProducts)
      console.log(total)

      const paymentMethods = document.querySelector('input[name="payment"]:checked')
      console.log(paymentMethods)
      let paymentType = paymentMethods ? paymentMethods.value : 'efectivo'
      console.log(paymentType)

      const amountPaidEfectivo = parseFloat(multiefectivo.value)
      const amountPaidOther = parseFloat(multiother.value)

      const pagos = [amountPaidEfectivo, amountPaidOther]

      if (!['efectivo', 'tarjeta', 'transferencia', 'nequi', 'multipagoNequi', 'multipagoBancolombia'].includes(paymentType)) {
        paymentType = 'efectivo' // Valor por defecto
      }

      // Implementar base de datos
      const invoice = {
        productos: Object.values(selectedProducts).map(product => ({
          nombre: product.name,
          tipo: product.type,
          cantidad: product.quantity,
          precio: product.price,
          descuento: product.discount,
          total: product.quantity * product.price * ((100 - product.discount) / 100)
        })),
        total: calculateTotalFromProducts(selectedProducts),
        tipoPago: paymentType,
        multipagos: paymentType === 'multipagoNequi' || paymentType === 'multipagoBancolombia'
          ? pagos
          : null
      }
      console.log('Factura a guardar:', invoice)

      try {
        await saveInvoice(invoice)

        confirmationModal.style.display = 'none'

        showSuccess()
        // Reiniciar interfaz y objetos
        selectedProductsTableBody.innerHTML = ''
        amountPaidInput.value = ''
        multiefectivo.value = ''
        multiother.value = ''
        changeReturn.textContent = 'Vuelto: $0.00'
        document.querySelector('#total-display').textContent = 'Total: $0.00'
        Object.keys(selectedProducts).forEach(key => delete selectedProducts[key])
      } catch (error) {
        console.error('Error al procesar el pago:', error)
      }
    })

    cancelButton.addEventListener('click', () => {
      confirmationModal.style.display = 'none'
    })

    payButton.addEventListener('click', async () => {
      const total = calculateTotalFromProducts(selectedProducts)
      const paymentMethods = document.querySelector('input[name="payment"]:checked')
      console.log(paymentMethods)
      const paymentType = paymentMethods ? paymentMethods.value : 'efectivo'

      if (total === 0) {
        validationMessageTotal.style.display = 'block'
        // console.log('No hay productos seleccionados')
        setTimeout(() => {
          validationMessageTotal.style.display = 'none'
        }, 5000)
        return
      } else {
        validationMessageTotal.style.display = 'none'
      }

      const amountPaid = parseFloat(amountPaidInput.value) || 0

      if (amountPaid < total) {
        changeReturn.textContent = 'La cantidad dada por el cliente es menor que el total a pagar.'
      }

      const multiefectivoValue = parseFloat(multiefectivo.value.trim())
      const multiotherValue = parseFloat(multiother.value.trim())

      // Verificar si los valores son números válidos y si los campos están vacíos
      if ((isNaN(multiefectivoValue) || isNaN(multiotherValue)) && paymentType === 'multipago') {
        validationMessageInput.style.display = 'block'
        setTimeout(() => {
          validationMessageInput.style.display = 'none'
        }, 5000)
        return
      } else {
        validationMessageInput.style.display = 'none'
      }

      if (multiefectivoValue + multiotherValue < total) {
        validationMessageValue.style.display = 'block'
        setTimeout(() => {
          validationMessageValue.style.display = 'none'
        }, 5000)
        return
      } else {
        validationMessageValue.style.display = 'none'
      }

      confirmationModal.style.display = 'block'
    })

    addProductButton.addEventListener('click', () => {
      productModal.style.display = 'block'
    })

    formCloseButton.addEventListener('click', () => {
      productModal.style.display = 'none'
      Productsform.reset()
    })

    Productsform.addEventListener('submit', async (e) => {
      e.preventDefault()

      const priceValue = document.getElementById('price').value

      if (isNaN(priceValue) || priceValue <= 0) {
        // console.log('Por favor, ingrese un precio válido mayor que 0.')
        return
      }

      const nextID = getNextId()
      // console.log('Siguiente ID:', nextID)
      const product = {
        name: document.getElementById('name').value,
        price: parseInt(document.getElementById('price').value),
        cost: 0,
        type: document.getElementById('typeSelector').value,
        id: nextID
      }

      try {
        await window.paletteAPI.Products.addProduct(product)
        const updatedProducts = await window.paletteAPI.Products.getProducts()
        updateProductList(updatedProducts.products) // Actualizar la lista de productos con los nuevos datos
        // Agregar el nuevo producto a la lista de productos
        productModal.style.display = 'none'

        showAddSuccess()
        // limpiar el formulario
        Productsform.reset()
      } catch (error) {
        console.error('Error al agregar el producto:', error)
      }
    })

    syncButton.addEventListener('click', async () => {
      try {
        await window.paletteAPI.Invoice.downloadInvoices()
        showSyncSuccess()
        // console.log('Archivos descargados correctamente.')
      } catch (error) {
        showSyncError()
        console.error('Error al descargar los archivos:', error)
      }
    })
  } catch (error) {
    console.error('Error al cargar productos:', error)
  }
})
