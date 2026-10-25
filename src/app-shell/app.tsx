"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createQueryClient } from "@/lib/query/query-client";
import { createRealtimeSync } from "@/lib/realtime/realtime-sync";
import { bindSession } from "@/lib/session/session-sync";
import { createAppRouter } from "./router";
import { RealtimeContext } from "./realtime-context";

// Instâncias únicas por aba.
const queryClient = createQueryClient();
const realtime = createRealtimeSync(queryClient);
const router = createAppRouter(queryClient);

export function App() {
  useEffect(() => bindSession(queryClient, realtime), []);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider value={realtime}>
        <RouterProvider router={router} />
      </RealtimeContext.Provider>
    </QueryClientProvider>
  );
}
