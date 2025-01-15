export interface FetchMessage {
  query: MessageType
  productName: string
}

export enum MessageType {
  Vivino = 'vivino',
  Untappd = 'untappd'
}

export enum RatingResultStatus {
  NotFound = 'not_found',
  Uncertain = 'uncertain',
  Found = 'found'
}
// export interface RatingResponse {
//   status: RatingResultStatus;
//   name: string | null;
//   rating: number;
//   votes: number;
//   link: string | null;
// }

// export interface BeerResponse extends RatingResponse {
//   brewery: string | null;
// }

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
