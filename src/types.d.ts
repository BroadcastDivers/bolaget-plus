import { Url } from "url";

interface VivinoMessage {
  query: "getRating";
  productName: string;
}

interface VivinoResponse {
  name: string;
  rating: string;
  votes: int
  link: URL
}
