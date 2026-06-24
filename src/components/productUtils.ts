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
  // Replace ", " separator with a space so "Cabernet Sauvignon, 2025" → "Cabernet Sauvignon 2025".
  // The vintage year is important for Vivino's per-vintage search index.
  const secondLineNormalized = secondLine.replace(/,\s*/, ' ').trim()

  return `${firstLine} ${secondLineNormalized}`.trim()
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

// Wine formats that are not a bottle and have no comparable Vivino rating.
// We exclude these rather than allow-list bottle types, so bottle variants
// (Flaska, Magnum, Halvflaska, …) all pass without enumerating them.
const NON_BOTTLE_FORMATS = [
  'box',
  'bag-in-box',
  'burk',
  'pet',
  'tetra',
  'påse',
  'pappförpackning',
  'fat',
  'pouch'
]

export function isBottle(): boolean {
  const main = document.querySelector('main')
  if (main == null) {
    return true
  }

  const descriptor = getPackagingDescriptor(main)
  // If we can't read the format line, assume bottle rather than block the rating.
  if (!descriptor) {
    return true
  }

  return !NON_BOTTLE_FORMATS.some((format) => descriptor.includes(format))
}

// Reads the packaging type from the format line under the product title, which
// reads "{packaging} · {volume} · {alcohol} % vol." — e.g. "Flaska", "Magnum",
// "Bag-in-Box". Anchored on the alcohol content, which is always present.
function getPackagingDescriptor(main: HTMLElement): null | string {
  const volumeLeaf = Array.from(main.querySelectorAll('*')).find(
    (el) => el.children.length === 0 && /%\s*vol\.?/i.test(el.textContent)
  )
  if (!volumeLeaf) {
    return null
  }

  let node: HTMLElement | null = volumeLeaf as HTMLElement
  for (let i = 0; i < 4 && node; i++) {
    const text = node.textContent
    if (/[·•]/.test(text) && /\d/.test(text) && text.length < 80) {
      break
    }
    node = node.parentElement
  }
  if (!node) {
    return null
  }

  const firstSegment = node.textContent.split(/[·•]/)[0].trim().toLowerCase()
  return firstSegment ? firstSegment : null
}
