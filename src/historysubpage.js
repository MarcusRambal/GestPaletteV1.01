document.addEventListener('DOMContentLoaded', async () => {
  const historyButton = document.querySelector('.get-facturasButton')
  const calendarButton = document.querySelector('.calendarButton')
  const dateInput = document.querySelector('#start')
  const invoicesList = document.querySelector('.invoices-list')

  // Función para renderizar facturas en un contenedor
  function renderInvoices (invoices, container) {
    container.innerHTML = ''

    if (!invoices || invoices.length === 0) {
      container.innerHTML = '<p>No se encontraron facturas.</p>'
      return
    }

    invoices.forEach(invoice => {
      const invoiceDiv = document.createElement('div')
      invoiceDiv.className = 'invoice'
      invoiceDiv.innerHTML = `
        <p><strong>ID:</strong> ${invoice.id}</p>
        <p><strong>Tipo de Pago:</strong> ${invoice.payment_type}</p>
        <p><strong>Total:</strong> $${invoice.total.toFixed(2)}</p>
        <p><strong>Efectivo:</strong> $${invoice.total_efectivo?.toFixed(2) || 'N/A'}</p>
        <p><strong>Tarjeta:</strong> $${invoice.total_tarjeta?.toFixed(2) || 'N/A'}</p>
        <p><strong>Fecha:</strong> ${invoice.created_at}</p>
        <button class="view-details" data-id="${invoice.id}">Ver Detalles</button>
      `
      container.appendChild(invoiceDiv)
    })

    // Agregar evento a los botones de "Ver Detalles"
    container.querySelectorAll('.view-details').forEach(button => {
      button.addEventListener('click', async (event) => {
        const invoiceId = event.target.dataset.id
        // console.log('Mostrar detalles de la factura con ID:', invoiceId)
        const invoiceDetails = await window.paletteAPI.Calls.detailButton(invoiceId)
        // console.log('Detalles de la factura:', invoiceDetails)
        showInvoiceDetails(invoiceDetails)
      })
    })
  }

  // Función para mostrar los detalles de la factura
  function showInvoiceDetails (details) {
    const detailsContainer = document.querySelector('.invoice-details-container')
    detailsContainer.innerHTML = ''

    if (!details || details.length === 0) {
      detailsContainer.innerHTML = '<p>No hay detalles para mostrar.</p>'
      return
    }

    details.forEach(item => {
      const itemDiv = document.createElement('div')
      itemDiv.className = 'invoice-item'
      itemDiv.innerHTML = `
        <p class="Factura-title"><strong>Factura con ID:</strong> ${item.invoice_id}</p>
        <p class="Product-title"><strong>Producto:</strong> ${item.product_name}</p>
        <p class="Product-type-title"><strong>Tipo:</strong> ${item.type}</p>
        <p><strong>Cantidad:</strong> ${item.quantity}</p>
        <p><strong>Precio:</strong> $${item.price.toFixed(2)}</p>
        <p><strong>Descuento:</strong> ${item.discount}%</p>
        <p class="Total-title"><strong>Total:</strong> $${item.total.toFixed(2)}</p>
      `
      detailsContainer.appendChild(itemDiv)
    })
  }

  calendarButton.addEventListener('click', async () => {
    try {
      const selectedDate = dateInput.value
      // console.log('Fecha seleccionada:', selectedDate)

      if (!selectedDate) {
        console.error('Por favor, selecciona una fecha.')
        return
      }

      const filteredInvoices = await window.paletteAPI.Operations.filterByDate(selectedDate)
      renderInvoices(filteredInvoices, invoicesList)
    } catch (error) {
      // console.error('Error al obtener las facturas:', error)
    }
  })

  historyButton.addEventListener('click', async () => {
    try {
      const invoices = await window.paletteAPI.Calls.historyButton()
      // console.log('Facturas obtenidas:', invoices)
      renderInvoices(invoices, invoicesList)
    } catch (error) {
      // console.error('Error al obtener las facturas:', error)
    }
  })
})
