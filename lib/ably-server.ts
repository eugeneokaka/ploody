import * as Ably from "ably";

let restClient: Ably.Rest | null = null;

export function getAblyRest(): Ably.Rest {
  if (!restClient) {
    if (!process.env.ABLY_API_KEY) {
      throw new Error("ABLY_API_KEY is not set");
    }
    restClient = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  }
  return restClient;
}
