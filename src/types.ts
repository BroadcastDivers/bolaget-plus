export interface VivinoMessage {
  query: 'getRating'
  productName: string
}

export enum VivinoResultStatus {
  NotFound = 'not_found',
  Uncertain = 'uncertain',
  Found = 'found'
}

export interface VivinoResponse {
  status: VivinoResultStatus
  name: string | null
  rating: number
  votes: number
  link: string | null
}
