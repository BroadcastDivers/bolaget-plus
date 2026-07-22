export enum ProductType {
  Beer = 'beer',
  Cider = 'cider',
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

export interface RatingAlternative {
  link: string
  name: string
  rating: number
  votes: number
}

export interface RatingRequest {
  productId: string
  productName: string
  query: ProductType
}

export interface RatingResponse {
  alternatives?: RatingAlternative[]
  link: null | string
  name: null | string
  rating: number
  status: RatingResultStatus
  votes: number
}

export interface UntappdHit {
  beer_name: string
  beer_slug: string
  bid: number
  brewery_beer_name: string
  brewery_name: null | string
  rating_count: null | number
  rating_score: null | number
}

export interface UntappdSearchJSON {
  hits?: UntappdHit[]
}

export interface VivinoMatch {
  vintage: {
    id: number
    name: string
    statistics: {
      ratings_average: null | number
      ratings_count: null | number
    }
    wine: {
      id: number
      seo_name: string
    }
  }
}

export interface VivinoResponseJSON {
  explore_vintage?: { matches: VivinoMatch[] }
}
