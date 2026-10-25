"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { RealtimeClient } from "@/lib/realtime/realtime-client";

export const RealtimeContext = createContext<RealtimeClient | null>(null);

export function useRealtimeStatus() {
  const client = useContext(RealtimeContext);
  return useSyncExternalStore(
    client?.subscribeStatus ?? (() => () => {}),
    client?.getStatus ?? (() => "idle" as const),
    () => "idle" as const,
  );
}
