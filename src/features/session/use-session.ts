"use client";

import { useSyncExternalStore } from "react";
import { sessionStore, type SessionState } from "@/lib/session/session-store";

const subscribe = (callback: () => void) => sessionStore.subscribe(() => callback());

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, sessionStore.get, sessionStore.get);
}

export function useCurrentUser() {
  const session = useSession();
  return session.status === "authenticated" ? session.user : null;
}

/** Dono do carrinho no cache: usuário autenticado ou visitante. */
export function cartOwnerOf(session: SessionState) {
  return session.status === "authenticated" ? `user:${session.user.id}` : "guest";
}
