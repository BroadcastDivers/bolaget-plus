import stringSimilarity from 'string-similarity'

import {
  BeerResponse,
  RatingAlternative,
  RatingResponse,
  RatingResultStatus,
  UntappdHit,
  UntappdSearchJSON,
  VivinoHit,
  VivinoSearchJSON
} from '@/@types/types'

// Untappd's search page renders results client-side via Algolia; these are the
// public search-only credentials it ships to anonymous visitors.
const UNTAPPD_ALGOLIA_APP_ID = '9WBO4RQ3HO'
const UNTAPPD_ALGOLIA_SEARCH_KEY = '1d347324d67ec472bb7132c66aead485'

// Vivino's search box is also Algolia-backed with public search-only
// credentials shipped to anonymous visitors. The WINES_prod index has far
// better text relevance than the /api/explore/explore endpoint (a marketplace
// browser that misses even top-selling wines and non-marketplace producers),
// and each hit carries the winery as a separate field, so the producer check
// no longer has to guess which query token is the brand.
const VIVINO_ALGOLIA_APP_ID = '9TAKGWJUXL'
const VIVINO_ALGOLIA_SEARCH_KEY = '60c11b2f1068885161d95ca068d3a6ae'

// How many ranked candidates to surface as "did you mean" alternatives when
// no match is confident enough to auto-select.
const MAX_ALTERNATIVES = 3

// A hung image download must not hold up the rating itself.
const IMAGE_FETCH_TIMEOUT_MS = 4000

// Style/format words that are shared across thousands of unrelated wines. On
// their own they must never be enough to accept a match: "Blanc de Noirs Brut"
// or "Prosecco Extra Dry" can push the name-similarity over the accept
// threshold even when the producer is completely different. The distinguishing
// signal is the producer — enforced by the winery check below.
const GENERIC_WINE_WORDS = new Set([
  'blanc',
  'blancs',
  'brut',
  'cava',
  'champagne',
  'classico',
  'cremant',
  'crémant',
  'demi',
  'doc',
  'docg',
  'doux',
  'dry',
  'extra',
  'gran',
  'grande',
  'noir',
  'noirs',
  'nv',
  'organic',
  'prosecco',
  'reserva',
  'reserve',
  'riserva',
  'rose',
  'rosé',
  'rouge',
  'sec',
  'sparkling',
  'spumante',
  'superiore',
  'vintage',
  'wine'
])

// How close two brand-like tokens must be to count as the same producer;
// tolerates minor spelling/plural differences without matching unrelated words.
const BRAND_TOKEN_MATCH_THRESHOLD = 0.8

// An exact name only identifies a wine when that name is rare in the index.
// Distinctive titles ("Contacto Loureiro", "Barbera d'Alba Busije") match a
// handful of wines; appellation-and-grape titles ("Piemonte Barbera") match
// hundreds under many producers, so an exact hit proves nothing there.
// Audited values: correct exact matches sat at 1–12 total hits, wrong ones at
// 49 and 1714.
const MAX_HITS_FOR_EXACT_NAME_MATCH = 20

// Corporate-form words in winery names ("Weingut X", "Bodegas Y", "X Family
// Estate") that Systembolaget titles routinely drop. They are excluded from
// the winery check so "Saint Clair Family Estate" is confirmed by a title
// that only says "Saint Clair" — but every remaining winery token must appear
// in the query: any-token overlap would let "Knight Black Horse" pass for
// "Black Knight".
const WINERY_COMPANY_WORDS = new Set([
  'agricola',
  'azienda',
  'bodega',
  'bodegas',
  'cantina',
  'cantine',
  'casa',
  'cave',
  'caves',
  'cellars',
  'chateau',
  'château',
  'domaine',
  'domaines',
  'estate',
  'estates',
  'famiglia',
  'familia',
  'familie',
  'famille',
  'family',
  'fratelli',
  'frères',
  'hermanos',
  'maison',
  'tenuta',
  'tenute',
  'vigne',
  'vigneron',
  'vignerons',
  'vignobles',
  'vina',
  'viña',
  'vineyard',
  'vineyards',
  'vinos',
  'vinya',
  'weingut',
  'winery',
  'winzer'
])

export async function fetchRatingFromUntappd(
  productName: string
): Promise<RatingResponse> {
  const url = `https://${UNTAPPD_ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/beer/query`
  const searchFallbackUrl = `https://untappd.com/search?q=${encodeURIComponent(
    productName
  )}&type=beer&sort=all`
  const uncertainFallback: RatingResponse = {
    link: searchFallbackUrl,
    name: null,
    rating: 0,
    status: RatingResultStatus.Uncertain,
    votes: 0
  }
  // HTTP errors (429 rate limit, 5xx) and network failures are transient —
  // hand the user a search link instead of a definitive "no match", and mark
  // the response so it never gets cached as a miss for a day.
  const transientFallback: RatingResponse = {
    ...uncertainFallback,
    transient: true
  }

  try {
    const response = await fetch(url, {
      body: JSON.stringify({
        params: new URLSearchParams({
          hitsPerPage: '5',
          query: productName
        }).toString()
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-API-Key': UNTAPPD_ALGOLIA_SEARCH_KEY,
        'X-Algolia-Application-Id': UNTAPPD_ALGOLIA_APP_ID
      },
      method: 'POST'
    })

    if (!response.ok) {
      return transientFallback
    }

    const data = (await response.json()) as UntappdSearchJSON
    const hits = data.hits ?? []

    if (hits.length === 0) {
      return {
        link: null,
        name: null,
        rating: 0,
        status: RatingResultStatus.NotFound,
        votes: 0
      }
    }

    type ScoredBeer = BeerResponse & { similarityRate: number }

    const scored = hits
      .map((hit: UntappdHit): ScoredBeer => {
        const similarityRate = Math.max(
          stringSimilarity.compareTwoStrings(productName, hit.beer_name),
          stringSimilarity.compareTwoStrings(productName, hit.brewery_beer_name)
        )

        return {
          brewery: hit.brewery_name,
          link: `https://untappd.com/b/${hit.beer_slug}/${hit.bid.toString()}`,
          name: hit.beer_name,
          // Untappd reports no score (null or 0) for beers with too few
          // check-ins; normalize to 0 so the UI can render it as "N/A".
          rating: hit.rating_score ?? 0,
          similarityRate,
          status: RatingResultStatus.Found,
          votes: hit.rating_count ?? 0
        }
      })
      .sort((a, b) => b.similarityRate - a.similarityRate)

    const bestMatch = scored[0]

    if (bestMatch.similarityRate < 0.2) {
      return { ...uncertainFallback, alternatives: toAlternatives(scored) }
    }

    // Return only the response contract — similarityRate is internal.
    const result: BeerResponse = {
      brewery: bestMatch.brewery,
      link: bestMatch.link,
      name: bestMatch.name,
      rating: bestMatch.rating,
      status: bestMatch.status,
      votes: bestMatch.votes
    }
    return result
  } catch {
    return transientFallback
  }
}

export async function fetchRatingFromVivino(
  query: string,
  includeImage = true
): Promise<RatingResponse> {
  const url = `https://${VIVINO_ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/WINES_prod/query`
  // Even Algolia misses some wines (obscure producers, new releases). Instead
  // of a dead-end "no rating" message, always hand the user a working Vivino
  // search link.
  const uncertainFallback: RatingResponse = {
    link: `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`,
    name: null,
    rating: 0,
    status: RatingResultStatus.Uncertain,
    votes: 0
  }

  try {
    const response = await fetch(url, {
      body: JSON.stringify({
        params: new URLSearchParams({
          hitsPerPage: '10',
          query
        }).toString()
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-API-Key': VIVINO_ALGOLIA_SEARCH_KEY,
        'X-Algolia-Application-Id': VIVINO_ALGOLIA_APP_ID
      },
      method: 'POST'
    })

    // HTTP errors (429 rate limit, 5xx) are transient — show the search-link
    // fallback but don't let it get cached as a definitive miss.
    if (!response.ok) {
      return { ...uncertainFallback, transient: true }
    }

    const data = (await response.json()) as VivinoSearchJSON
    const hits = (data.hits ?? []).filter((hit) => !hit.hidden)

    if (hits.length === 0) {
      return uncertainFallback
    }

    type ScoredWine = RatingResponse & {
      exactNameMatch: boolean
      imageUrl?: string
      similarityRate: number
      winery?: string
    }

    const scored = hits
      .map((hit: VivinoHit): ScoredWine => {
        const winery = hit.winery?.name ?? undefined
        // Hits name the wine without the producer ("Crianza" under winery
        // "El Coto"), so score against the combined name — unless the wine
        // name already repeats the winery.
        const fullName =
          winery && !normalize(hit.name).startsWith(normalize(winery))
            ? `${winery} ${hit.name}`
            : hit.name
        const rating = hit.statistics?.ratings_average ?? 0
        const votes = hit.statistics?.ratings_count ?? 0
        const imageUrl = normalizeImageUrl(
          hit.image?.variations?.label_medium ?? hit.image?.location
        )

        return {
          exactNameMatch:
            normalize(hit.name) === normalize(query) ||
            normalize(fullName) === normalize(query),
          imageUrl,
          link: wineLink(hit),
          name: fullName,
          rating,
          similarityRate: similarity(query, fullName),
          status: RatingResultStatus.Found,
          votes,
          winery
        }
      })
      .sort((a, b) => b.similarityRate - a.similarityRate)

    // A name-similarity built on shared style words ("Prosecco Extra Dry") is
    // not a real match unless the producer also lines up: the winery must be
    // confirmed by the query. Checked down the ranking, not only on the top
    // candidate — a confirmed producer at rank 3 beats an unconfirmable
    // near-namesake at rank 1. The one exception is an exact-name hit on a
    // distinctive title (few wines in the whole index share the name), which
    // covers products whose Systembolaget title omits the producer. Exact
    // means exact: a similarity threshold cannot replace it, because
    // compareTwoStrings ignores whitespace and scores "Riesling Organic" 0.97
    // against "R Riesling Organic", a different producer's wine.
    const nameIsDistinctive =
      (data.nbHits ?? Infinity) <= MAX_HITS_FOR_EXACT_NAME_MATCH
    const bestMatch = scored.find(
      (wine) =>
        wine.similarityRate >= 0.5 &&
        (queryContainsWinery(query, wine.winery) ||
          (wine.exactNameMatch && nameIsDistinctive))
    )

    if (!bestMatch) {
      const top = scored.slice(0, MAX_ALTERNATIVES)
      if (includeImage) {
        await Promise.all(
          top.map(async (wine) => {
            wine.imageDataUrl = await fetchImageAsDataUrl(wine.imageUrl)
          })
        )
      }
      return { ...uncertainFallback, alternatives: toAlternatives(top) }
    }

    // Return only the response contract — similarityRate/imageUrl are internal.
    return {
      imageDataUrl: includeImage
        ? await fetchImageAsDataUrl(bestMatch.imageUrl)
        : undefined,
      link: bestMatch.link,
      name: bestMatch.name,
      rating: bestMatch.rating,
      status: bestMatch.status,
      votes: bestMatch.votes
    }
  } catch {
    return { ...uncertainFallback, transient: true }
  }
}

// Splits text into lowercased, distinctive tokens: drops short filler ("de",
// "di", "el"), bare vintage years, and the generic style words above, leaving
// the brand/producer words that actually identify a wine.
function distinctiveTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (token) =>
        token.length > 2 &&
        !/^\d+$/.test(token) &&
        !GENERIC_WINE_WORDS.has(token)
    )
}

// Fetched by the background script because the systembolaget.se page CSP
// (img-src) blocks hotlinking Vivino's image hosts; a data: URL is allowed.
async function fetchImageAsDataUrl(
  url: string | undefined
): Promise<string | undefined> {
  if (!url) {
    return undefined
  }
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) {
      return undefined
    }
    const contentType = response.headers.get('content-type') ?? 'image/png'
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return `data:${contentType};base64,${btoa(binary)}`
  } catch {
    return undefined
  }
}

// Lowercases and folds diacritics and punctuation so cosmetic spelling
// differences between the two catalogues don't break comparisons: Vivino
// writes "Barbera d’Alba" and "Bobal - Syrah" where Systembolaget writes
// "Barbera d'Alba" and "Bobal Syrah", and accents drift both ways
// ("Aszù"/"Aszú").
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function normalizeImageUrl(url: null | string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  return url.startsWith('//') ? `https:${url}` : url
}

// True when every distinctive token of the winery name appears in the query
// (fuzzily, to tolerate spelling drift). Corporate-form words are skipped —
// Systembolaget writes "Saint Clair", Vivino "Saint Clair Family Estate" —
// but the remaining tokens must ALL be present: any-token overlap would let
// "Knight Black Horse" pass for "Black Knight". An unknown winery cannot be
// confirmed and never passes.
function queryContainsWinery(
  query: string,
  winery: string | undefined
): boolean {
  if (!winery) {
    return false
  }
  const wineryTokens = distinctiveTokens(winery).filter(
    (token) => !WINERY_COMPANY_WORDS.has(token)
  )
  if (wineryTokens.length === 0) {
    return false
  }
  const queryTokens = distinctiveTokens(query)
  return wineryTokens.every((wineryToken) =>
    queryTokens.some(
      (queryToken) =>
        queryToken === wineryToken ||
        stringSimilarity.compareTwoStrings(wineryToken, queryToken) >=
          BRAND_TOKEN_MATCH_THRESHOLD
    )
  )
}

function similarity(a: string, b: string): number {
  return stringSimilarity.compareTwoStrings(normalize(a), normalize(b))
}

function toAlternatives(
  scored: {
    imageDataUrl?: string
    link: null | string
    name: null | string
    rating: number
    votes: number
  }[]
): RatingAlternative[] {
  return scored
    .slice(0, MAX_ALTERNATIVES)
    .flatMap(({ imageDataUrl, link, name, rating, votes }) =>
      link !== null && name !== null
        ? [{ imageDataUrl, link, name, rating, votes }]
        : []
    )
}

// vivino.com/wines/{id} resolves by vintage id, not wine id (see the
// regression note in the tests). The displayed rating is the wine-level
// pooled one, so link the most-rated vintage — the "all vintages" entry when
// Vivino has one. Wines without vintage data fall back to the /w/{wine id}
// page.
function wineLink(hit: VivinoHit): string {
  const bestVintage = (hit.vintages ?? []).reduce<
    NonNullable<VivinoHit['vintages']>[number] | null
  >(
    (best, vintage) =>
      (vintage.statistics?.ratings_count ?? 0) >
      (best?.statistics?.ratings_count ?? -1)
        ? vintage
        : best,
    null
  )
  return bestVintage
    ? `https://www.vivino.com/wines/${bestVintage.id.toString()}`
    : `https://www.vivino.com/w/${hit.id.toString()}`
}
