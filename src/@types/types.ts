export enum ProductType {
  Uncertain = 'uncertain',
  Wine = 'wine',
  Beer = 'beer'
}

export enum RatingResultStatus {
  NotFound = 'not_found',
  Uncertain = 'uncertain',
  Found = 'found'
}

export type RatingRequest = {
  query: ProductType
  productName: string
}

export type RatingResponse = {
  status: RatingResultStatus
  name: string | null
  rating: number
  votes: number
  link: string | null
}

export type BeerResponse = RatingResponse & {
  brewery: string | null
}
