export interface VivinoMessage {
  query: 'getRating'
  productName: string
}
export interface VivinoResponse {
  found: boolean
  name: string | null
  rating: number
  votes: number
  link: string | null
}
