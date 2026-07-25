import { ProductType } from '@/@types/types'

export function getCardName(card: Element): null | string {
  const spans = [...card.querySelectorAll('.monopol-250')] as HTMLElement[]
  if (spans.length === 0) return null
  const parts = spans.map((s) => s.innerText.trim()).filter(Boolean)
  // Normalize ", 2025" → " 2025" so vintage year is included without comma
  return (
    parts
      .join(' ')
      .replace(/,\s*(\d{4})/, ' $1')
      .trim() || null
  )
}

export function getCardProductId(card: Element): null | string {
  return extractProductId(card.getAttribute('href') ?? '')
}

export function getCardProductType(card: Element): ProductType {
  const href = card.getAttribute('href') ?? ''
  if (href.includes('/produkt/vin/')) return ProductType.Wine
  if (href.includes('/produkt/ol/')) return ProductType.Beer
  if (href.includes('/produkt/cider-blanddrycker/')) return ProductType.Cider
  return ProductType.Uncertain
}

export function getProductId(): null | string {
  return extractProductId(window.location.href)
}

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

  if (url.includes('/produkt/cider-blanddrycker/')) {
    return ProductType.Cider
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

  const productId = getProductId()
  const descriptor =
    (productId ? getPackagingFromPageData(productId) : null) ??
    getSelectedPackaging(main) ??
    getPackagingDescriptor(main)
  // If we can't read the packaging, assume bottle rather than block the rating.
  if (!descriptor) {
    return true
  }

  return !NON_BOTTLE_FORMATS.some((format) => descriptor.includes(format))
}

export function isListPage(): boolean {
  return window.location.pathname.includes('/sortiment/')
}

function extractProductId(url: string): null | string {
  return /-(\d+)\/?$/.exec(url)?.[1] ?? null
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

  let formatLine: HTMLElement | null = null
  let node: HTMLElement | null = volumeLeaf as HTMLElement
  for (let i = 0; i < 4 && node; i++) {
    const text = node.textContent
    if (/[·•]/.test(text) && /\d/.test(text) && text.length < 80) {
      formatLine = node
      break
    }
    node = node.parentElement
  }
  // No compact format line near the alcohol content (products with a packaging
  // dropdown only render "{alcohol} % vol."). Never fall back to a larger
  // container — its text can contain words like "fatkaraktär" that
  // false-match the non-bottle list.
  if (!formatLine) {
    return null
  }

  const firstSegment = formatLine.textContent
    .split(/[·•]/)[0]
    .trim()
    .toLowerCase()
  return firstSegment ? firstSegment : null
}

// Systembolaget embeds the product data of the initially loaded page in
// Next.js' __NEXT_DATA__ script; "packagingLevel1" is the packaging name
// ("Flaska", "Box", …). Only trust it when an entry matches the current
// product id — SPA navigations don't refresh the script.
function getPackagingFromPageData(productId: string): null | string {
  const raw = document.getElementById('__NEXT_DATA__')?.textContent
  if (!raw) {
    return null
  }

  let fallback: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw) as {
      props?: { pageProps?: { fallback?: Record<string, unknown> } }
    }
    fallback = parsed.props?.pageProps?.fallback ?? {}
  } catch {
    return null
  }

  for (const entry of Object.values(fallback)) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const product = entry as {
      packagingLevel1?: null | string
      productNumber?: null | string
    }
    if (product.productNumber !== productId) {
      continue
    }
    const packaging = product.packagingLevel1
    return typeof packaging === 'string' && packaging
      ? packaging.toLowerCase()
      : null
  }
  return null
}

// Products sold in several packagings replace the static format line with a
// dropdown whose selected value reads "{packaging}, {volume} ml". Read the
// current selection; requiring a volume keeps unrelated dropdowns (store
// picker, quantity, …) from being mistaken for it.
function getSelectedPackaging(main: HTMLElement): null | string {
  for (const el of main.querySelectorAll('select, [role="combobox"]')) {
    // The dropdown's hidden <select> has no options until the app hydrates,
    // so the selected option can be undefined despite its non-nullish type.
    const source = el instanceof HTMLSelectElement ? el.selectedOptions[0] : el
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const text = source?.textContent.trim().toLowerCase() ?? ''
    if (/\d\s*(cl|l|ml)\b/.test(text)) {
      return text
    }
  }
  return null
}
