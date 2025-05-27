/**
 * Translation keys for use in i18n functions
 * Generated from en.yml
 */
export const TranslationKeys = {
  brewery: 'brewery',
  linkToUntapped: 'linkToUntapped',
  linkToVivino: 'linkToVivino',
  loading: 'loading',
  noMatch: 'noMatch',
  notOnBottle: 'notOnBottle',
  of: 'of',
  rating: 'rating',
  searchAtUntapped: 'searchAtUntapped',
  searchAtVivino: 'searchAtVivino',
  uncertainMatch: 'uncertainMatch',
  votes: 'votes'
} as const

/**
 * Type representing all valid translation keys
 */
export type TranslationKey = keyof typeof TranslationKeys
