document.addEventListener('DOMContentLoaded', () => {
  const calendarButton = document.querySelector('.calendarButton')
  const dateInput = document.querySelector('#start')

  const balanceList = document.querySelector('.balance-list')

  try {
    function renderBalance (balanceData, container, selectedDate) {
      container.innerHTML = ''

      if (!balanceData || !balanceData.desglose || balanceData.desglose.length === 0) {
        container.innerHTML = '<p>No se encontraron facturas para el día seleccionado.</p>'
        return
      }

      // Crear elementos para mostrar el resumen
      const dateDiv = document.createElement('div')
      dateDiv.className = 'date-balance'
      dateDiv.innerHTML = `<h2>Balance con fecha: ${selectedDate}</h2>`
      const totalDiv = document.createElement('div')
      totalDiv.className = 'total-balance'
      totalDiv.innerHTML = `<h3>Total del día: ${balanceData.total_general.toLocaleString()}</h3>`
      container.appendChild(dateDiv)
      container.appendChild(totalDiv)

      // Iterar sobre el desglose para mostrar cada tipo de pago
      balanceData.desglose.forEach(item => {
        const paymentDiv = document.createElement('div')
        paymentDiv.className = `balance-${item.tipo_pago}`
        paymentDiv.innerHTML = `
                    <h4>Tipo de pago: ${item.tipo_pago}</h4>
                    <p>Total: ${item.total.toLocaleString()}</p>
                    ${
                        item.efectivo !== null
                            ? `<p>Por efectivo: ${item.efectivo.toLocaleString()}</p>`
                            : ''
                    }
                    ${
                        item.tarjeta !== null
                            ? `<p>Por tarjeta: ${item.tarjeta.toLocaleString()}</p>`
                            : ''
                    }
                `
        container.appendChild(paymentDiv)
      })
    }

    calendarButton.addEventListener('click', async () => {
      try {
        const selectedDate = dateInput.value
        console.log('Fecha seleccionada:', selectedDate)

        if (!selectedDate) {
          console.error('Por favor, selecciona una fecha.')
          return
        }

        const balance = await window.paletteAPI.Operations.filterByDay(selectedDate)
        console.log('Facturas filtradas:', balance)
        console.log(typeof balance)
        renderBalance(balance, balanceList, selectedDate)
      } catch (error) {
        console.error('Error al obtener las facturas:', error)
      }
    })
  } catch (error) {
    console.error('Error al manejar la base', error)
    throw error
  }
})
