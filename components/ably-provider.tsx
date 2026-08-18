"use client";

import * as Ably from "ably";
import { AblyProvider } from "ably/react";
import { useEffect, useState } from "react";

let realtimeClient: Ably.RealtimeClient | null = null;

function getRealtimeClient(): Ably.RealtimeClient {
  if (!realtimeClient) {
    realtimeClient = new Ably.Realtime({
      authUrl: "/api/ably/token",
    });
  }
  return realtimeClient;
}

export function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Ably.RealtimeClient | null>(null);

  useEffect(() => {
    setClient(getRealtimeClient());
  }, []);

  if (!client) {
    return null;
  }

  return <AblyProvider client={client}>{children}</AblyProvider>;
}
