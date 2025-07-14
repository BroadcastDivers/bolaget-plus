import { storage } from '#imports'

const TASTED_STORAGE_KEY = 'local:tastedproducts'

async function loadTastedProducts(): Promise<void> {
  const container = document.getElementById('tasted-products-container')
  if (!container) return

  // const tastedProducts: string[] =
  //   (await storage.getItem<string[]>(TASTED_STORAGE_KEY)) ?? []
  const tastedProducts: null | string[] =
    await storage.getItem<string[]>(TASTED_STORAGE_KEY)
  if (tastedProducts === null) {
    await storage.setItem(TASTED_STORAGE_KEY, [])
  }

  if (tastedProducts?.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        You haven't marked any products as tasted yet.
      </div>
    `
    return
  }

  container.innerHTML = ''

  tastedProducts?.forEach((product) => {
    const productItem = document.createElement('div')
    productItem.className = 'product-item'

    const productName = document.createElement('span')
    productName.textContent = product

    const removeButton = document.createElement('button')
    removeButton.className = 'remove-button'
    removeButton.textContent = 'Remove'
    removeButton.addEventListener('click', () => {
      void removeProduct(product)
    })

    productItem.appendChild(productName)
    productItem.appendChild(removeButton)
    container.appendChild(productItem)
  })
}

async function removeProduct(productName: string) {
  const tastedProducts =
    (await storage.getItem<string[]>(TASTED_STORAGE_KEY)) ?? []
  const updatedList = tastedProducts.filter((name) => name !== productName)
  await storage.setItem(TASTED_STORAGE_KEY, updatedList)
  await loadTastedProducts()
}

document.addEventListener('DOMContentLoaded', () => {
  void loadTastedProducts()
})
