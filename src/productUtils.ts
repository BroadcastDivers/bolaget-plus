export function getProductName(): string | null {
  const headerChildren = document.querySelector('main h1')?.children

  if (!headerChildren || headerChildren.length === 0) {
    return null
  }

  const firstLine = (headerChildren[0] as HTMLElement)?.innerText.trim() ?? ''
  if (headerChildren.length === 1) {
    return firstLine
  }

  const secondLine = (headerChildren[1] as HTMLElement)?.innerText.trim() ?? ''
  const secondLineWithoutComma = secondLine.includes(',')
    ? secondLine.slice(0, secondLine.lastIndexOf(',')).trim()
    : secondLine

  return `${firstLine} ${secondLineWithoutComma}`.trim()
}

export function isBottle(): boolean {
  const productContainer =
    document.querySelector('main h1')?.parentElement?.parentElement
  if (productContainer == null) {
    return false
  }

  const BOTTLE_STRING = 'flaska'
  let isBottle =
    Array.from(productContainer.querySelectorAll('p')).find((p) =>
      p.textContent?.toLowerCase().includes(BOTTLE_STRING)
    ) !== undefined

  if (isBottle === false) {
    isBottle =
      Array.from(productContainer.querySelectorAll('option'))
        .map((i) => i.innerText.toLowerCase())
        .find((i) => i.includes(BOTTLE_STRING)) !== undefined
  }

  return isBottle
}