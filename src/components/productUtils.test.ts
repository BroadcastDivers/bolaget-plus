// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'

import { getCardName, isCardBottle } from '@/components/productUtils'

// A list card as Systembolaget renders it: category line, name, subtitle,
// the "Nr {productNumber}" line, then the format/price details.
function renderCard(options: {
  category?: string
  details?: string[]
  productId?: string
  subtitle?: string
  title?: string
}): Element {
  const {
    category = 'Rött vin, Fylligt & Smakrikt',
    details = ['Flaska, 750 ml', '129:00', '172:00 kr/l'],
    productId = '203701',
    subtitle = '2021',
    title = 'Amadio'
  } = options

  const lines = [category, title, subtitle, `Nr ${productId}`, ...details]
  document.body.innerHTML = `
    <a id="tile:${productId}" href="/produkt/vin/amadio-${productId}/">
      ${lines.map((line) => `<p>${line}</p>`).join('')}
    </a>`

  const card = document.querySelector('a')
  if (!card) throw new Error('card not rendered')
  return card
}

function renderPageData(products: object[]): void {
  const script = document.createElement('script')
  script.id = '__NEXT_DATA__'
  script.textContent = JSON.stringify({
    props: { pageProps: { fallback: { '/api/search': { products } } } }
  })
  document.head.appendChild(script)
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('isCardBottle', () => {
  it('accepts a card whose details say nothing about the packaging', () => {
    const card = renderCard({ details: ['750 ml', '129:00'] })

    expect(isCardBottle(card, '203701')).toBe(true)
  })

  it('rejects a bag-in-box card', () => {
    const card = renderCard({ details: ['Bag-in-Box, 3000 ml', '249:00'] })

    expect(isCardBottle(card, '203701')).toBe(false)
  })

  it.each(['Box, 3000 ml', 'Burk, 250 ml', 'PET-flaska, 750 ml', 'Fat, 20 l'])(
    'rejects a card packaged as %s',
    (packaging) => {
      const card = renderCard({ details: [packaging, '249:00'] })

      expect(isCardBottle(card, '203701')).toBe(false)
    }
  )

  it('ignores a format word that is part of the product name', () => {
    const card = renderCard({ title: 'Boxwood Petit Verdot' })

    expect(isCardBottle(card, '203701')).toBe(true)
  })

  it('ignores a format word that is only part of a longer word', () => {
    const card = renderCard({ details: ['Flaska, 750 ml', 'Fatlagrat'] })

    expect(isCardBottle(card, '203701')).toBe(true)
  })

  it('reads the packaging from the embedded page data when present', () => {
    renderPageData([{ packagingLevel1: 'Box', productNumber: '203701' }])
    // Details deliberately look like a bottle — the page data is authoritative.
    const card = renderCard({ details: ['3000 ml', '249:00'] })

    expect(isCardBottle(card, '203701')).toBe(false)
  })

  it('does not apply another product’s packaging to this card', () => {
    renderPageData([{ packagingLevel1: 'Box', productNumber: '999999' }])
    const card = renderCard({})

    expect(isCardBottle(card, '203701')).toBe(true)
  })

  it('falls back to the card text when the page data is unparseable', () => {
    const script = document.createElement('script')
    script.id = '__NEXT_DATA__'
    script.textContent = '{ not json'
    document.head.appendChild(script)
    const card = renderCard({ details: ['Box, 3000 ml'] })

    expect(isCardBottle(card, '203701')).toBe(false)
  })

  it('assumes bottle when the product-number line is missing', () => {
    const card = renderCard({ details: ['Box, 3000 ml'], productId: '203701' })
    card.innerHTML = '<p>Amadio</p><p>Box, 3000 ml</p>'

    expect(isCardBottle(card, '203701')).toBe(true)
  })
})

describe('getCardName', () => {
  it('joins the name and vintage above the product-number line', () => {
    const card = renderCard({})

    expect(getCardName(card)).toBe('Amadio 2021')
  })

  it('drops the category line', () => {
    const card = renderCard({ subtitle: '' })

    expect(getCardName(card)).toBe('Amadio')
  })
})
