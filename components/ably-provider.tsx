"use client";

import * as Ably from "ably";
import { AblyProvider } from "ably/react";

const realtimeClient = new Ably.Realtime({
  authUrl: "/api/ably/token",
});

export function AblyProviderWrapper({ children }: { children: React.ReactNode }) {
  return <AblyProvider client={realtimeClient}>{children}</AblyProvider>;
}
