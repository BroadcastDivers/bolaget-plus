import { i18n } from '#i18n'
import { storage } from '#imports'

import { BeerResponse, ProductType, RatingResponse } from '@/@types/types'

const RATING_CONTAINER_ID = 'rating-container'
const RATING_CONTAINER_BODY_ID = 'rating-container-body'
const TASTED_STORAGE_KEY = 'local:tastedproducts'

export async function addTastedButton(
  productName: string,
  container: HTMLElement
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Adding tasted button for:', productName)
  let isTasted = await checkIfProductTasted(productName)
  // eslint-disable-next-line no-console
  console.log('Is product tasted:', isTasted)

  const buttonContainer = document.createElement('div')
  buttonContainer.style.cssText = 'margin-top: 10px; text-align: center;'

  const tastedButton = document.createElement('button')
  tastedButton.style.cssText = `
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid;
    transition: background-color 0.3s;
    ${
      isTasted
        ? 'background-color: #28a745; color: white; border-color: #28a745;'
        : 'background-color: white; color: #6c757d; border-color: #6c757d;'
    }
  `

  tastedButton.textContent = isTasted
    ? i18n.t('markedAsTasted')
    : i18n.t('markAsTasted')

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  tastedButton.addEventListener('click', async () => {
    if (isTasted) {
      await unmarkProductAsTasted(productName)
      isTasted = false
      tastedButton.textContent = i18n.t('markAsTasted')
      tastedButton.style.backgroundColor = 'white'
      tastedButton.style.color = '#6c757d'
      tastedButton.style.borderColor = '#6c757d'
    } else {
      await markProductAsTasted(productName)
      isTasted = true
      tastedButton.textContent = i18n.t('markedAsTasted')
      tastedButton.style.backgroundColor = '#28a745'
      tastedButton.style.color = 'white'
      tastedButton.style.borderColor = '#28a745'
    }
  })

  buttonContainer.appendChild(tastedButton)
  container.appendChild(buttonContainer)
}

export async function checkIfProductTasted(
  productName: string
): Promise<boolean> {
  const tastedProducts = await getTastedProducts()
  return tastedProducts.includes(productName)
}

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
  ratingContainer.style.cssText =
    'background-color: #fff3cd; padding: 10px; margin-top: 10px; border: 1px solid #ffeeba; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px;'

  ratingContainer.innerHTML =
    '<h3 style="color: #856404; text-align: center;">Bolaget+</h3>'

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

  if (!document.getElementById('spinner-css')) {
    const style = document.createElement('style')
    style.id = 'spinner-css'
    style.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `
    document.head.appendChild(style)
  }
}

export async function markProductAsTasted(productName: string): Promise<void> {
  const tastedProducts = await getTastedProducts()
  if (!tastedProducts.includes(productName)) {
    tastedProducts.push(productName)
    await storage.setItem(TASTED_STORAGE_KEY, tastedProducts)
  }
}

export function setMessage(message: string) {
  const ratingContainer = document.getElementById(RATING_CONTAINER_BODY_ID)
  if (!ratingContainer) {
    return
  }
  ratingContainer.innerHTML = `<div style="color: #856404; text-align: center;">${message}</div>`
}

export async function setRating(
  productType: ProductType,
  rating: RatingResponse,
  link: null | string
  // productName?: string
) {
  const ratingContainer = getAndClearContainer()

  const svg =
    productType === ProductType.Wine
      ? generateStarsSvg(rating.rating)
      : generateCapSvg(rating.rating)

  const ratingElement = document.createElement('div')
  ratingElement.style.cssText = 'display: flex; align-items: center; gap: 5px;'
  ratingElement.innerHTML = `
        <strong>${i18n.t('rating')}:</strong>
        ${svg}  (${rating.rating.toString()} ${i18n.t('of')} ${rating.votes.toString()} ${i18n.t('votes')})
      `

  const breweryElement = document.createElement('p')
  if (productType === ProductType.Beer) {
    const beerRating = rating as BeerResponse
    breweryElement.innerText = `${i18n.t('brewery')}: ${beerRating.brewery ?? ''}`
    breweryElement.style.cssText =
      'color: #155724; margin: 0; line-height: 1.5;'
  }

  const linkElement = document.createElement('a')
  if (link) {
    linkElement.href = link
  }
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.style.cssText =
    'color: #155724; text-decoration: underline; margin: 0; line-height: 1.5;'

  switch (productType) {
    case ProductType.Beer:
      linkElement.innerText = i18n.t('linkToUntapped')
      break
    case ProductType.Wine:
      linkElement.innerText = i18n.t('linkToVivino')
      break
  }

  const flexContainer = document.createElement('div')
  flexContainer.style.cssText =
    'display: flex; justify-content: space-between; align-items: center;'

  const leftContainer = document.createElement('div')
  leftContainer.appendChild(linkElement)

  const rightContainer = document.createElement('div')
  rightContainer.appendChild(breweryElement)

  flexContainer.appendChild(leftContainer)
  flexContainer.appendChild(rightContainer)

  ratingContainer.appendChild(ratingElement)
  ratingContainer.appendChild(flexContainer)

  switch (productType) {
    case ProductType.Beer: {
      const beerRating = rating as BeerResponse
      await addTastedButton(beerRating.name ?? '', ratingContainer)
      break
    }
    case ProductType.Wine: {
      await addTastedButton(rating.name ?? '', ratingContainer)
      break
    }
  }
}

export function setUncertain(productType: ProductType, link: null | string) {
  const ratingContainer = getAndClearContainer()

  const ratingElement = document.createElement('div')
  ratingElement.style.cssText = 'display: flex; align-items: center; gap: 5px;'
  ratingContainer.innerHTML = `<div style="color: #856404; text-align: center;">${i18n.t('uncertainMatch')}</div>`

  const linkElement = document.createElement('a')
  if (link) {
    linkElement.href = link
  }
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.style.cssText = 'color: #155724; text-decoration: underline;'

  switch (productType) {
    case ProductType.Beer:
      linkElement.innerText = i18n.t('searchAtUntapped')
      break
    case ProductType.Wine:
      linkElement.innerText = i18n.t('searchAtVivino')
      break
  }

  ratingContainer.appendChild(ratingElement)
  ratingContainer.appendChild(linkElement)
}

export function showLoadingSpinner() {
  const ratingContainer = getAndClearContainer()
  const spinner = document.createElement('div')
  spinner.style.cssText =
    'display: flex; justify-content: center; align-items: center; height: 50px; gap: 10px;'
  spinner.innerHTML = `
      <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #095741; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite;"></div>
      <span style="font-size: 14px; color: #856404;">${i18n.t('loading')}..</span>
    `

  ratingContainer.appendChild(spinner)
}

export async function unmarkProductAsTasted(
  productName: string
): Promise<void> {
  const tastedProducts = await getTastedProducts()
  const updatedTastedProducts = tastedProducts.filter(
    (name) => name !== productName
  )
  await storage.setItem(TASTED_STORAGE_KEY, updatedTastedProducts)
}

function generateCapSvg(rating: number): string {
  const maxCaps = 5
  const yellowCollor = '#ffc000'
  const grayColor = '#d8d8d8'
  const heightAndWidth = '28px'
  const capSvg = (fill: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${heightAndWidth}" height="${heightAndWidth}" viewBox="0 0 50 50" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" >
    <g><path style="opacity:0.954" fill="${fill}" d="M 20.5,-0.5 C 22.1667,-0.5 23.8333,-0.5 25.5,-0.5C 25.8656,0.694594 26.699,1.36126 28,1.5C 31.7073,-0.156277 34.2073,1.01039 35.5,5C 39.7905,4.43599 41.9571,6.26933 42,10.5C 45.7611,11.7146 46.9277,14.048 45.5,17.5C 45.4534,19.0377 46.1201,20.0377 47.5,20.5C 47.5,21.8333 47.5,23.1667 47.5,24.5C 46.4749,25.3739 45.8082,26.5405 45.5,28C 47.1563,31.7073 45.9896,34.2073 42,35.5C 42.564,39.7905 40.7307,41.9571 36.5,42C 35.3336,45.5714 33.1669,46.7381 30,45.5C 28.3009,45.3866 27.1342,46.0532 26.5,47.5C 25.1667,47.5 23.8333,47.5 22.5,47.5C 21.6261,46.4749 20.4595,45.8082 19,45.5C 15.2927,47.1563 12.7927,45.9896 11.5,42C 7.20953,42.564 5.04286,40.7307 5,36.5C 1.42855,35.3336 0.261888,33.1669 1.5,30C 1.61345,28.3009 0.94678,27.1342 -0.5,26.5C -0.5,25.1667 -0.5,23.8333 -0.5,22.5C 0.525111,21.6261 1.19178,20.4595 1.5,19C -0.156277,15.2927 1.01039,12.7927 5,11.5C 4.43599,7.20953 6.26933,5.04286 10.5,5C 11.6664,1.42855 13.8331,0.261888 17,1.5C 18.6991,1.61345 19.8658,0.94678 20.5,-0.5 Z"/></g>
  </svg>
  `

  let capsHtml = ''
  for (let i = 0; i < maxCaps; i++) {
    if (rating >= i + 1) {
      capsHtml += capSvg(yellowCollor)
    } else if (rating >= i + 0.5) {
      capsHtml += `
      <svg xmlns="http://www.w3.org/2000/svg" width="${heightAndWidth}" height="${heightAndWidth}" viewBox="0 0 50 50" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" >
        <defs>
          <linearGradient id="halfStarGradient">
            <stop offset="50%" stop-color="${yellowCollor}" />
            <stop offset="50%" stop-color="${grayColor}" />
          </linearGradient>
        </defs>
        <g><path style="opacity:0.954" fill="url(#halfStarGradient)" d="M 20.5,-0.5 C 22.1667,-0.5 23.8333,-0.5 25.5,-0.5C 25.8656,0.694594 26.699,1.36126 28,1.5C 31.7073,-0.156277 34.2073,1.01039 35.5,5C 39.7905,4.43599 41.9571,6.26933 42,10.5C 45.7611,11.7146 46.9277,14.048 45.5,17.5C 45.4534,19.0377 46.1201,20.0377 47.5,20.5C 47.5,21.8333 47.5,23.1667 47.5,24.5C 46.4749,25.3739 45.8082,26.5405 45.5,28C 47.1563,31.7073 45.9896,34.2073 42,35.5C 42.564,39.7905 40.7307,41.9571 36.5,42C 35.3336,45.5714 33.1669,46.7381 30,45.5C 28.3009,45.3866 27.1342,46.0532 26.5,47.5C 25.1667,47.5 23.8333,47.5 22.5,47.5C 21.6261,46.4749 20.4595,45.8082 19,45.5C 15.2927,47.1563 12.7927,45.9896 11.5,42C 7.20953,42.564 5.04286,40.7307 5,36.5C 1.42855,35.3336 0.261888,33.1669 1.5,30C 1.61345,28.3009 0.94678,27.1342 -0.5,26.5C -0.5,25.1667 -0.5,23.8333 -0.5,22.5C 0.525111,21.6261 1.19178,20.4595 1.5,19C -0.156277,15.2927 1.01039,12.7927 5,11.5C 4.43599,7.20953 6.26933,5.04286 10.5,5C 11.6664,1.42855 13.8331,0.261888 17,1.5C 18.6991,1.61345 19.8658,0.94678 20.5,-0.5 Z"/></g>
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
      starsHtml += `
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="halfStarGradient">
                <stop offset="50%" stop-color="${redColor}" />
                <stop offset="50%" stop-color="${grayColor}" />
              </linearGradient>
            </defs>
            <path d="M12 .587l3.668 7.568L24 9.423l-6 5.832 1.416 8.25L12 18.897 4.584 23.505 6 15.255l-6-5.832 8.332-1.268L12 .587z" fill="url(#halfStarGradient)"/>
          </svg>`
    } else {
      // Empty gray star
      starsHtml += starSvg(grayColor)
    }
  }

  return `<div style="display: flex">${starsHtml}</div>`
}

async function getTastedProducts(): Promise<string[]> {
  const tastedProducts = await storage.getItem<string[]>(TASTED_STORAGE_KEY)
  return tastedProducts ?? []
}
