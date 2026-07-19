import { i18n } from '#i18n'

import { BeerResponse, ProductType, RatingResponse } from '@/@types/types'

const RATING_CONTAINER_ID = 'rating-container'
const RATING_CONTAINER_BODY_ID = 'rating-container-body'
const STYLE_ID = 'bolaget-plus-css'

const STYLES = `
  #${RATING_CONTAINER_ID} {
    margin-top: 12px;
    border: 1px solid #e3e3e3;
    border-left: 4px solid #095741;
    border-radius: 8px;
    background: #ffffff;
    font-family: inherit;
    font-size: 14px;
    color: #1a1a1a;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  #${RATING_CONTAINER_ID} .bp-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.2px;
    color: #095741;
    border-bottom: 1px solid #f0f0f0;
  }
  #${RATING_CONTAINER_ID} .bp-logo {
    width: 12px;
    height: 12px;
    transform: rotate(45deg);
    border-radius: 2px;
    background: #095741;
  }
  #${RATING_CONTAINER_BODY_ID} {
    padding: 10px 12px;
  }
  #${RATING_CONTAINER_ID} .bp-rating-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #${RATING_CONTAINER_ID} .bp-score {
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
  }
  #${RATING_CONTAINER_ID} .bp-scale {
    color: #888;
    font-size: 13px;
  }
  #${RATING_CONTAINER_ID} .bp-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  #${RATING_CONTAINER_ID} .bp-meta {
    color: #666;
    font-size: 12px;
    line-height: 1.4;
  }
  #${RATING_CONTAINER_ID} .bp-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #095741;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
  }
  #${RATING_CONTAINER_ID} .bp-link:hover {
    text-decoration: underline;
  }
  #${RATING_CONTAINER_ID} .bp-message {
    color: #666;
    text-align: center;
    padding: 2px 0;
  }
  #${RATING_CONTAINER_ID} .bp-spinner-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 48px;
    gap: 10px;
  }
  #${RATING_CONTAINER_ID} .bp-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e8e8e8;
    border-top-color: #095741;
    border-radius: 50%;
    animation: bp-spin 0.8s linear infinite;
  }
  @keyframes bp-spin {
    to { transform: rotate(360deg); }
  }
`

export function getAndClearContainer(): HTMLElement {
  let container = document.getElementById(RATING_CONTAINER_BODY_ID)
  if (!container) {
    injectRatingContainer()
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  container = document.getElementById(RATING_CONTAINER_BODY_ID)!
  container.innerHTML = ''
  return container
}

export function injectRatingContainer() {
  if (document.getElementById(RATING_CONTAINER_BODY_ID)) {
    return
  }
  const ratingContainer = document.createElement('div')
  ratingContainer.id = RATING_CONTAINER_ID

  const header = document.createElement('div')
  header.className = 'bp-header'
  header.innerHTML = `<span class="bp-logo"></span><span>Bolaget+</span>`
  ratingContainer.appendChild(header)

  const bodyDiv = document.createElement('div')
  bodyDiv.id = RATING_CONTAINER_BODY_ID
  ratingContainer.appendChild(bodyDiv)

  const productHeader = document.querySelector('main h1')
  if (productHeader?.parentNode) {
    productHeader.parentNode.insertBefore(
      ratingContainer,
      productHeader.nextSibling
    )
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLES
    document.head.appendChild(style)
  }
}

export function setMessage(message: string) {
  const ratingContainer = document.getElementById(RATING_CONTAINER_BODY_ID)
  if (!ratingContainer) {
    return
  }
  ratingContainer.innerHTML = `<div class="bp-message">${message}</div>`
}

export function setRating(
  productType: ProductType,
  rating: RatingResponse,
  link: null | string
) {
  const ratingContainer = getAndClearContainer()

  const svg =
    productType === ProductType.Wine
      ? generateStarsSvg(rating.rating)
      : generateCapSvg(rating.rating)

  // A score of 0 means the source has too few ratings to compute one yet.
  const scoreHtml =
    rating.rating > 0
      ? `<span class="bp-score">${rating.rating.toString()}</span>
        <span class="bp-scale">/ 5</span>`
      : `<span class="bp-score" title="${i18n.t('noRatingYet')}">N/A</span>`

  const ratingRow = document.createElement('div')
  ratingRow.className = 'bp-rating-row'
  ratingRow.innerHTML = `
        ${svg}
        ${scoreHtml}
      `

  const meta = document.createElement('div')
  meta.className = 'bp-meta'
  meta.innerText = `${rating.votes.toString()} ${i18n.t('votes')}`
  if (productType === ProductType.Beer) {
    const beerRating = rating as BeerResponse
    if (beerRating.brewery) {
      meta.innerText += ` · ${beerRating.brewery}`
    }
  }

  const linkLabel =
    productType === ProductType.Beer
      ? i18n.t('linkToUntappd')
      : i18n.t('linkToVivino')

  const footer = document.createElement('div')
  footer.className = 'bp-footer'
  footer.appendChild(meta)
  footer.appendChild(createSourceLink(link, linkLabel))

  ratingContainer.appendChild(ratingRow)
  ratingContainer.appendChild(footer)
}

export function setUncertain(productType: ProductType, link: null | string) {
  const ratingContainer = getAndClearContainer()

  const message = document.createElement('div')
  message.className = 'bp-message'
  message.innerText = i18n.t('uncertainMatch')

  const linkLabel =
    productType === ProductType.Beer
      ? i18n.t('searchAtUntappd')
      : i18n.t('searchAtVivino')

  const footer = document.createElement('div')
  footer.className = 'bp-footer'
  footer.style.justifyContent = 'center'
  footer.style.marginTop = '6px'
  footer.appendChild(createSourceLink(link, linkLabel))

  ratingContainer.appendChild(message)
  ratingContainer.appendChild(footer)
}

export function showLoadingSpinner() {
  const ratingContainer = getAndClearContainer()
  const spinner = document.createElement('div')
  spinner.className = 'bp-spinner-wrap'
  spinner.innerHTML = `
      <div class="bp-spinner"></div>
      <span class="bp-message">${i18n.t('loading')}</span>
    `

  ratingContainer.appendChild(spinner)
}

function createSourceLink(
  link: null | string,
  label: string
): HTMLAnchorElement {
  const linkElement = document.createElement('a')
  linkElement.className = 'bp-link'
  if (link) {
    linkElement.href = link
  }
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.append(label)
  linkElement.insertAdjacentHTML(
    'beforeend',
    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>`
  )
  return linkElement
}

function generateCapSvg(rating: number): string {
  const maxCaps = 5
  const yellowColor = '#ffc000'
  const grayColor = '#d8d8d8'
  const heightAndWidth = '28px'
  const capSvg = (fill: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${heightAndWidth}" height="${heightAndWidth}" viewBox="0 0 50 50" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g><path style="opacity:0.954" fill="${fill}" d="M 20.5,-0.5 C 22.1667,-0.5 23.8333,-0.5 25.5,-0.5C 25.8656,0.694594 26.699,1.36126 28,1.5C 31.7073,-0.156277 34.2073,1.01039 35.5,5C 39.7905,4.43599 41.9571,6.26933 42,10.5C 45.7611,11.7146 46.9277,14.048 45.5,17.5C 45.4534,19.0377 46.1201,20.0377 47.5,20.5C 47.5,21.8333 47.5,23.1667 47.5,24.5C 46.4749,25.3739 45.8082,26.5405 45.5,28C 47.1563,31.7073 45.9896,34.2073 42,35.5C 42.564,39.7905 40.7307,41.9571 36.5,42C 35.3336,45.5714 33.1669,46.7381 30,45.5C 28.3009,45.3866 27.1342,46.0532 26.5,47.5C 25.1667,47.5 23.8333,47.5 22.5,47.5C 21.6261,46.4749 20.4595,45.8082 19,45.5C 15.2927,47.1563 12.7927,45.9896 11.5,42C 7.20953,42.564 5.04286,40.7307 5,36.5C 1.42855,35.3336 0.261888,33.1669 1.5,30C 1.61345,28.3009 0.94678,27.1342 -0.5,26.5C -0.5,25.1667 -0.5,23.8333 -0.5,22.5C 0.525111,21.6261 1.19178,20.4595 1.5,19C -0.156277,15.2927 1.01039,12.7927 5,11.5C 4.43599,7.20953 6.26933,5.04286 10.5,5C 11.6664,1.42855 13.8331,0.261888 17,1.5C 18.6991,1.61345 19.8658,0.94678 20.5,-0.5 Z"/></g>
  </svg>
  `

  let capsHtml = ''
  for (let i = 0; i < maxCaps; i++) {
    if (rating >= i + 1) {
      capsHtml += capSvg(yellowColor)
    } else if (rating >= i + 0.5) {
      const gradientId = `bp-half-cap-${i.toString()}`
      capsHtml += `
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${heightAndWidth}" height="${heightAndWidth}" viewBox="0 0 50 50" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <linearGradient id="${gradientId}">
            <stop offset="50%" stop-color="${yellowColor}" />
            <stop offset="50%" stop-color="${grayColor}" />
          </linearGradient>
        </defs>
        <g><path style="opacity:0.954" fill="url(#${gradientId})" d="M 20.5,-0.5 C 22.1667,-0.5 23.8333,-0.5 25.5,-0.5C 25.8656,0.694594 26.699,1.36126 28,1.5C 31.7073,-0.156277 34.2073,1.01039 35.5,5C 39.7905,4.43599 41.9571,6.26933 42,10.5C 45.7611,11.7146 46.9277,14.048 45.5,17.5C 45.4534,19.0377 46.1201,20.0377 47.5,20.5C 47.5,21.8333 47.5,23.1667 47.5,24.5C 46.4749,25.3739 45.8082,26.5405 45.5,28C 47.1563,31.7073 45.9896,34.2073 42,35.5C 42.564,39.7905 40.7307,41.9571 36.5,42C 35.3336,45.5714 33.1669,46.7381 30,45.5C 28.3009,45.3866 27.1342,46.0532 26.5,47.5C 25.1667,47.5 23.8333,47.5 22.5,47.5C 21.6261,46.4749 20.4595,45.8082 19,45.5C 15.2927,47.1563 12.7927,45.9896 11.5,42C 7.20953,42.564 5.04286,40.7307 5,36.5C 1.42855,35.3336 0.261888,33.1669 1.5,30C 1.61345,28.3009 0.94678,27.1342 -0.5,26.5C -0.5,25.1667 -0.5,23.8333 -0.5,22.5C 0.525111,21.6261 1.19178,20.4595 1.5,19C -0.156277,15.2927 1.01039,12.7927 5,11.5C 4.43599,7.20953 6.26933,5.04286 10.5,5C 11.6664,1.42855 13.8331,0.261888 17,1.5C 18.6991,1.61345 19.8658,0.94678 20.5,-0.5 Z"/></g>
      </svg>`
    } else {
      capsHtml += capSvg(grayColor)
    }
  }

  return `<div style="display: flex">${capsHtml}</div>`
}

function generateStarsSvg(rating: number): string {
  const maxStars = 5
  const redColor = '#dc3545' // Red color for the stars
  const grayColor = '#e4e5e9' // Gray color for empty stars

  // Function to create an SVG star with a given fill color
  const starSvg = (fill: string) => `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 .587l3.668 7.568L24 9.423l-6 5.832 1.416 8.25L12 18.897 4.584 23.505 6 15.255l-6-5.832 8.332-1.268L12 .587z"/>
      </svg>`

  let starsHtml = ''
  for (let i = 0; i < maxStars; i++) {
    if (rating >= i + 1) {
      // Full red star
      starsHtml += starSvg(redColor)
    } else if (rating >= i + 0.5) {
      // Half red star using linear gradient
      const gradientId = `bp-half-star-${i.toString()}`
      starsHtml += `
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="${gradientId}">
                <stop offset="50%" stop-color="${redColor}" />
                <stop offset="50%" stop-color="${grayColor}" />
              </linearGradient>
            </defs>
            <path d="M12 .587l3.668 7.568L24 9.423l-6 5.832 1.416 8.25L12 18.897 4.584 23.505 6 15.255l-6-5.832 8.332-1.268L12 .587z" fill="url(#${gradientId})"/>
          </svg>`
    } else {
      // Empty gray star
      starsHtml += starSvg(grayColor)
    }
  }

  return `<div style="display: flex">${starsHtml}</div>`
}
