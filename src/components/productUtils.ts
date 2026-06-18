import { ProductType } from '@/@types/types'

export function getProductName(): null | string {
  const headerChildren = document.querySelector('main h1')?.children

  if (!headerChildren || headerChildren.length === 0) {
    return null
  }

  //eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const firstLine = (headerChildren[0] as HTMLElement).innerText.trim() ?? ''
  if (headerChildren.length === 1) {
    return firstLine
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const secondLine = (headerChildren[1] as HTMLElement).innerText.trim() ?? ''
  const secondLineWithoutComma = secondLine.includes(',')
    ? secondLine.slice(0, secondLine.lastIndexOf(',')).trim()
    : secondLine

  return `${firstLine} ${secondLineWithoutComma}`.trim()
}

export function getProductType(): ProductType {
  const url = window.location.href
  if (url.includes('/produkt/vin/')) {
    return ProductType.Wine
  }

  if (url.includes('/produkt/ol/')) {
    return ProductType.Beer
  }

  return ProductType.Uncertain
}

export function isBottle(): boolean {
  const main = document.querySelector('main')
  if (main == null) {
    return false
  }

  const BOTTLE_STRING = 'flaska'
  return Array.from(main.querySelectorAll('span, option')).some((el) =>
    el.textContent.toLowerCase().includes(BOTTLE_STRING)
  )
}
