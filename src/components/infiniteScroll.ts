import { clearPendingCardSpinner } from './domUtils'
import { CARD_SELECTOR, isListPage } from './productUtils'
import { featuresEnabled, infiniteScrollEnabled } from './settings'

// Systembolaget paginates /sortiment/ behind a "Till sida N" button: every page
// change replaces the cards that were on screen. This turns that into infinite
// scroll — when the reader nears the pager we press it for them and keep the
// pages they already scrolled through stacked above the new one.
//
// The cards kept around are clones. The page is a React SPA that owns (and
// drops) the originals on every page change, so the only way to hold on to a
// page is to take a copy before it goes. Clones are inert apart from their
// links, which is what a card mostly is; anything else on them still works one
// click away, on the product page itself.

// How close the pager has to get before the next page is loaded.
const TRIGGER_MARGIN_PX = 800
// How long to give the SPA to render the next page before assuming the pager
// no longer works the way we expect.
const PAGE_LOAD_TIMEOUT_MS = 10000
// How long to keep undoing the SPA's scroll-to-top after a page change.
const SCROLL_HOLD_MS = 1500
// How long a page change keeps counting as ours. The SPA renders a page in more
// than one pass, and those follow-ups must not read as the reader searching for
// something else.
const SETTLE_GRACE_MS = 3000
// Below this a result set is a single page and there is nothing to scroll into.
const MIN_GRID_CARDS = 4
// A scroll offset this close to the top counts as "at the top".
const SCROLL_TOP_EPSILON = 2
// Marks the cards we stacked, so they are never mistaken for the SPA's own.
const STACKED_ATTRIBUTE = 'data-bolaget-plus-stacked'
const NEXT_PAGE_LABEL = /^till sida\s+\d+$/i

// The cards of the pages already scrolled past, in display order.
let stacked: Element[] = []
let advancing = false
// Set when pressing the pager didn't produce a new page. The site has changed
// shape, so stop clicking at it until the reader searches for something else.
let advanceFailed = false
let grid: Element | null = null
let gridObserver: MutationObserver | null = null
let settlingUntil = 0
let pendingPage: null | {
  before: Set<string>
  resolve: (rendered: boolean) => void
} = null

export function startInfiniteScroll(): void {
  let scheduled = false
  const onScroll = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      void tryAdvance()
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
}

async function advance(
  currentGrid: Element,
  control: HTMLElement
): Promise<void> {
  // Scrolling fires again while the settings are read, so the caller can reach
  // this twice; only ever load one page at a time.
  if (advancing) return

  const items = liveItems(currentGrid)
  if (items.length === 0) return

  advancing = true
  const batch = items.map(cloneCard)
  stacked.push(...batch)
  holdScroll(window.scrollY)

  try {
    const rendered = new Promise<boolean>((resolve) => {
      pendingPage = { before: cardIds(items), resolve }
      window.setTimeout(() => {
        resolve(false)
      }, PAGE_LOAD_TIMEOUT_MS)
    })
    control.click()

    if (!(await rendered)) {
      advanceFailed = true
      drop(batch)
    }
  } finally {
    pendingPage = null
    settlingUntil = Date.now() + SETTLE_GRACE_MS
    advancing = false
  }
}

function cardIds(items: Element[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    for (const card of item.querySelectorAll(CARD_SELECTOR)) {
      ids.add(card.id)
    }
    if (item.matches(CARD_SELECTOR)) ids.add(item.id)
  }
  return ids
}

function cloneCard(item: Element): Element {
  const clone = item.cloneNode(true) as Element
  clone.setAttribute(STACKED_ATTRIBUTE, '')
  // A rating request may still have been in flight for the original card; its
  // result lands on the node the SPA is about to drop. Clear the orphaned
  // spinner so the clone is picked up and rated like any freshly seen card —
  // the second lookup is served from the cache.
  clearPendingCardSpinner(clone)
  return clone
}

function containsCard(element: Element): boolean {
  return (
    element.matches(CARD_SELECTOR) ||
    element.querySelector(CARD_SELECTOR) !== null
  )
}

function countCards(element: Element): number {
  return element.querySelectorAll(CARD_SELECTOR).length
}

function drop(cards: Element[]): void {
  for (const card of cards) {
    card.remove()
  }
  stacked = stacked.filter((card) => !cards.includes(card))
}

// Systembolaget's class names are hashed build artifacts that reshuffle between
// deploys, so the cards themselves are the only stable way to find the list they
// live in: descend while a single element still holds most of the page's cards.
// Stopping at "most" rather than "all" keeps a promo rail of a few products
// elsewhere on the page from widening the grid to half the document.
function findGrid(): Element | null {
  // The lookup walks a good part of the page, and this runs on scroll.
  if (grid?.isConnected && grid.querySelector(CARD_SELECTOR)) return grid

  const total = countCards(document.body)
  if (total < MIN_GRID_CARDS) return null

  let candidate: Element = document.body
  for (;;) {
    const inner = Array.from(candidate.children).find(
      (child) => countCards(child) * 2 >= total
    )
    if (!inner) break
    candidate = inner
  }
  return candidate === document.body ? null : candidate
}

// The pager renders a "Till sida N" button above a list of page links. Cards are
// links too, and there can be thousands of them stacked up by now, so the list
// itself is skipped rather than read.
function findNextPageControl(list: Element): HTMLElement | null {
  const main = document.querySelector('main')
  if (!main) return null

  for (const element of main.querySelectorAll<HTMLElement>('a[href], button')) {
    if (list.contains(element)) continue
    const label = element.textContent.replace(/\s+/g, ' ').trim()
    if (NEXT_PAGE_LABEL.test(label)) return element
  }
  return findNextPageLink(main)
}

// Fallback for when the button is renamed or dropped: the page links all point
// at the current path with the page number in the query. Pick the one a single
// page ahead, without assuming what the parameter is called.
function findNextPageLink(main: Element): HTMLElement | null {
  const current = new URL(window.location.href)

  for (const link of main.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const target = new URL(link.href, window.location.href)
    if (target.pathname !== current.pathname) continue

    for (const [parameter, value] of target.searchParams) {
      const page = Number(value)
      const currentPage = Number(current.searchParams.get(parameter) ?? '1')
      if (
        Number.isInteger(page) &&
        Number.isInteger(currentPage) &&
        page === currentPage + 1
      ) {
        return link
      }
    }
  }
  return null
}

function hasNewCards(target: Element, before: Set<string>): boolean {
  for (const id of cardIds(liveItems(target))) {
    if (!before.has(id)) return true
  }
  return false
}

// Changing page scrolls the SPA back to the top. The stacked pages keep the
// reader's offset meaningful, so undo the jump — but only an actual jump to the
// top, never a scroll the reader made themselves.
function holdScroll(offset: number): void {
  if (offset <= SCROLL_TOP_EPSILON) return

  const restore = () => {
    if (window.scrollY <= SCROLL_TOP_EPSILON) {
      window.scrollTo(0, offset)
    }
  }
  window.addEventListener('scroll', restore, { passive: true })
  window.setTimeout(() => {
    window.removeEventListener('scroll', restore)
  }, SCROLL_HOLD_MS)
}

function isNearViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  return rect.height > 0 && rect.top < window.innerHeight + TRIGGER_MARGIN_PX
}

function isStacked(node: Node): boolean {
  return node instanceof Element && node.hasAttribute(STACKED_ATTRIBUTE)
}

function isStackedOnly(record: MutationRecord): boolean {
  return [...record.addedNodes, ...record.removedNodes].every(isStacked)
}

// The cards the SPA currently renders — everything in the grid we didn't stack.
function liveItems(target: Element): Element[] {
  return Array.from(
    target.querySelectorAll(`:scope > :not([${STACKED_ATTRIBUTE}])`)
  ).filter(containsCard)
}

function observeGrid(next: Element): void {
  if (grid === next) return

  gridObserver?.disconnect()
  grid = next
  gridObserver = new MutationObserver((records) => {
    // Ignore the stacking we do ourselves; only the SPA swapping cards in and
    // out of the grid says anything about what the reader is looking at.
    if (records.every(isStackedOnly)) return
    onGridChanged()
  })
  gridObserver.observe(next, { childList: true })
}

function onGridChanged(): void {
  if (!grid) return
  if (!advancing && Date.now() > settlingUntil) {
    // A page change we didn't ask for: the reader filtered, sorted or picked a
    // page themselves, so the stacked pages are no longer part of the result.
    reset()
    return
  }

  // Runs before the browser paints, so the new page slots in under the old
  // ones instead of the list flickering down to a single page first.
  stackPending(grid)
  if (pendingPage && hasNewCards(grid, pendingPage.before)) {
    pendingPage.resolve(true)
    pendingPage = null
  }
}

function reset(): void {
  for (const card of stacked) {
    card.remove()
  }
  stacked = []
  advanceFailed = false
}

// Puts the pages held back into the grid, above whatever the SPA just rendered.
// Re-runs from scratch when the SPA rebuilds the grid and drops them.
function stackPending(target: Element): void {
  const pending = stacked.filter((card) => card.parentElement !== target)
  if (pending.length === 0) return

  const fragment = document.createDocumentFragment()
  fragment.append(...pending)
  const live = liveItems(target)
  target.insertBefore(fragment, live.length > 0 ? live[0] : null)
}

async function tryAdvance(): Promise<void> {
  if (advancing) return
  if (!isListPage()) {
    reset()
    return
  }
  const currentGrid = findGrid()
  if (!currentGrid) return
  observeGrid(currentGrid)
  if (advanceFailed) return

  // Everything below reads the page or the settings; only pay for it once the
  // reader has actually reached the end of the list.
  const end = currentGrid.lastElementChild
  if (!end || !isNearViewport(end)) return
  if (
    !(await featuresEnabled.getValue()) ||
    !(await infiniteScrollEnabled.getValue())
  ) {
    return
  }

  const control = findNextPageControl(currentGrid)
  if (!control || !isNearViewport(control)) return

  await advance(currentGrid, control)
}
