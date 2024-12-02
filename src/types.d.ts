export interface VivinoMessage {
  query: 'getRating'
  productName: string
}
export interface VivinoResponse {
  found: boolean
  name: string | null
  rating: number | null
  votes: number | null
  link: string | null
}
