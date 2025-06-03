document.addEventListener('DOMContentLoaded', async () => {
  const typeOptions = [
    'Helados', 'Especiales', 'Deluxe', 'Rellenas', 'Frappe',
    'Topping', 'Agua', 'Leche', 'Yogurt', 'Sodas',
    'Licor', 'Malteadas9onz', 'Malteadas12onz', 'Bebidas', 'Obleas', 'Ensaladas'
  ]
  const saveButton = document.getElementById('saveButton')
  const tableBody = document.querySelector('#product-table tbody')

  try {
    const result = await window.paletteAPI.Products.getProducts()
    // eslint-disable-next-line prefer-const
    let products = result.products

    function showSuccessMessage () {
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

    function showErrorMessage () {
      const errorModal = document.getElementById('error-message')
      const closeErrorButton = document.getElementById('close-error-message')
      errorModal.style.display = 'block'

      closeErrorButton.addEventListener('click', () => {
        errorModal.style.display = 'none'
      })
      setTimeout(() => {
        errorModal.style.display = 'none'
      }, 5000)
    }

    function renderProducts (newProducts) {
      tableBody.innerHTML = ''
      products = newProducts
      products.forEach((product, index) => {
        const row = document.createElement('tr')

        const options = typeOptions.map(option => {
          const selected = option === product.type ? 'selected' : ''
          return `<option value="${option}" ${selected}>${option}</option>`
        }).join('')

        row.innerHTML = `
      <td contenteditable="true"  spellcheck = "false" data-field="name" data-index="${index}">${product.name}</td>
       <td>
        <input type="number" step="0.01" min="0" data-field="price" data-index="${index}" value="${product.price}">
      </td>
        <select data-field="type" data-index="${index}">
          ${options}
        </select>
      </td>
        <td>
            <button class="delete-button" data-index="${index}">🗑️</button>
        </td>
    `
        tableBody.appendChild(row)
      })

      let currentProductToDelete = null

      document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(button.getAttribute('data-index'))
          currentProductToDelete = products[index]

          document.getElementById('modalText').innerText = `¿Eliminar "${currentProductToDelete.name}"?`
          document.getElementById('deleteModal').style.display = 'block'
        })
      })

      // Botón "Cancelar"
      document.getElementById('cancelDelete').addEventListener('click', () => {
        document.getElementById('deleteModal').style.display = 'none'
        currentProductToDelete = null
      })

      // Botón "Eliminar"
      document.getElementById('confirmDelete').addEventListener('click', async () => {
        if (currentProductToDelete) {
          try {
            console.log('Eliminando producto:', currentProductToDelete.id)
            await window.paletteAPI.Products.deleteProduct(currentProductToDelete.id)
            const result = await window.paletteAPI.Products.getProducts()
            products = result.products
            renderProducts(result.products)
          } catch (err) {
            console.error('Error al eliminar producto:', err)
          } finally {
            document.getElementById('deleteModal').style.display = 'none'
            currentProductToDelete = null
          }
        }
      })
    }

    saveButton.addEventListener('click', async () => {
      const updatedProducts = [...products]

      let valid = true

      document.querySelectorAll('[contenteditable]').forEach(cell => {
        const index = parseInt(cell.getAttribute('data-index'))
        const field = cell.getAttribute('data-field')
        const value = cell.innerText
        updatedProducts[index][field] = field === 'price' ? Number(value) : value
      })

      document.querySelectorAll('input[type="number"][data-field="price"]').forEach(input => {
        const index = parseInt(input.getAttribute('data-index'))
        const price = parseFloat(input.value)

        if (isNaN(price) || price < 0) {
          valid = false
        } else {
          updatedProducts[index].price = price
        }
      })

      document.querySelectorAll('select[data-field="type"]').forEach(select => {
        const index = parseInt(select.getAttribute('data-index'))
        updatedProducts[index].type = select.value
      })

      if (!valid) {
        showErrorMessage()
        return
      }

      try {
        console.log('Productos actualizados:', updatedProducts)
        await window.paletteAPI.Products.saveProducts(updatedProducts)
        const result = await window.paletteAPI.Products.getProducts()
        products = result.products
        renderProducts(products)
        showSuccessMessage()
        console.log('Productos guardados correctamente.')
      } catch (error) {
        console.error('Error al guardar los productos:', error)
        console.log('Hubo un error al guardar los productos.')
      }
    })

    renderProducts(products)
  } catch (error) {
    console.error('Error fetching products:', error)
  }
})
