export enum ProductType {
  Beer = 'beer',
  Uncertain = 'uncertain',
  Wine = 'wine'
}

export enum RatingResultStatus {
  Found = 'found',
  NotFound = 'not_found',
  Uncertain = 'uncertain'
}

export type BeerResponse = RatingResponse & {
  brewery: null | string
}

export interface RatingRequest {
  productName: string
  query: ProductType
}

export interface RatingResponse {
  link: null | string
  name: null | string
  rating: number
  status: RatingResultStatus
  votes: number
}

export interface VivinoMatch {
  vintage: {
    id: number
    name: string
    region?: {
      name: string
    }
    statistics: {
      ratings_average: null | number
      ratings_count: null | number
    }
  }
}

export interface VivinoReponseJSON {
  search_results?: { matches: VivinoMatch[] }
}
