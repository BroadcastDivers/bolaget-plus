import { translations } from './translations'

const RATING_CONTAINER_ID = 'rating-container'
const RATING_CONTAINER_BODY_ID = 'rating-container-body'

export function injectRatingContainer() {
  if (document.getElementById(RATING_CONTAINER_BODY_ID)) {
    return
  }
  const ratingContainer = document.createElement('div')
  ratingContainer.id = RATING_CONTAINER_ID
  ratingContainer.style.cssText = `background-color: #fff3cd; padding: 10px; margin-top: 10px; border: 1px solid #ffeeba; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px;`

  const header =
    '<h3 style="color: #856404; text-align: center;">Systembolaget ratings</h3>'

  ratingContainer.innerHTML = `${header}`

  const bodyDiv = document.createElement('div')
  bodyDiv.id = RATING_CONTAINER_BODY_ID
  ratingContainer.appendChild(bodyDiv)

  const productHeader = document.querySelector('main h1')
  if (productHeader && productHeader.parentNode) {
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

export function setMessage(message: string) {
  const ratingContainer = document.getElementById(RATING_CONTAINER_BODY_ID)
  if (!ratingContainer) {
    return
  }
  ratingContainer.innerHTML = `<div style="color: #856404; text-align: center;">${message}</div>`
}

export function setWineRating(
  rating: number,
  votes: number,
  link: string | null
) {
  const ratingContainer = getAndClearContainer()

  const ratingElement = document.createElement('div')
  ratingElement.style.cssText = `display: flex; align-items: center; gap: 5px;`
  ratingElement.innerHTML = `
      <strong>${translations.rating}:</strong>
      ${generateStarsSvg(rating)}  (${rating} ${translations.of} ${votes} ${translations.votes})
    `

  const linkElement = document.createElement('a')
  if (link) {
    linkElement.href = link
  }
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.style.cssText = `color: #155724; text-decoration: underline;`
  linkElement.innerText = translations.linkToVivino

  ratingContainer.appendChild(ratingElement)
  ratingContainer.appendChild(linkElement)
}

export function setUncertain(link: string | null) {
  const ratingContainer = getAndClearContainer()

  const ratingElement = document.createElement('div')
  ratingElement.style.cssText = `display: flex; align-items: center; gap: 5px;`
  ratingContainer.innerHTML = `<div style="color: #856404; text-align: center;">${translations.uncertainMatch}</div>`

  const linkElement = document.createElement('a')
  if (link) {
    linkElement.href = link
  }
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.style.cssText = `color: #155724; text-decoration: underline;`
  linkElement.innerText = translations.searchAtVivino

  ratingContainer.appendChild(ratingElement)
  ratingContainer.appendChild(linkElement)
}

export function getAndClearContainer(): HTMLElement {
  let container = document.getElementById(RATING_CONTAINER_BODY_ID)
  if (!container) {
    injectRatingContainer()
  }
  container = document.getElementById(RATING_CONTAINER_BODY_ID) as HTMLElement
  container.innerHTML = ''
  return container
}

export function showLoadingSpinner() {
  const ratingContainer = getAndClearContainer()
  const spinner = document.createElement('div')
  spinner.style.cssText = `display: flex; justify-content: center; align-items: center; height: 50px; gap: 10px;`
  spinner.innerHTML = `
      <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #095741; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite;"></div>
      <span style="font-size: 14px; color: #856404;">${translations.loading}..</span>
    `

  ratingContainer.appendChild(spinner)
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
