import { Url } from "url";

interface VivinoMessage {
  query: "getRating";
  productName: string;
}

interface VivinoResponse {
  found: boolean;
  name: string?;
  rating: float?;
  votes: int?;
  link: string?;
}
