import type { QueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import type { RealtimeClient } from "@/lib/realtime/realtime-client";
import { clearCheckoutStorage } from "@/lib/session/checkout-storage";
import { sessionStore, type SessionState } from "./session-store";

const identity = (s: SessionState) => (s.status === "authenticated" ? `${s.user.id}:${s.token}` : "anonymous");

/**
 * Amarra o ciclo de vida da sessão ao cache e ao tempo real:
 * - troca de usuário/logout/expiração → cancela e remove dados privados e
 *   carrinhos do cache, e reconecta o Socket.IO com a nova identidade;
 * - agenda a revalidação no instante da expiração (o servidor decide).
 */
export function bindSession(queryClient: QueryClient, realtime: RealtimeClient) {
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleExpiryCheck = (state: SessionState) => {
    clearTimeout(expiryTimer);
    if (state.status !== "authenticated") return;
    const wait = new Date(state.expiresAt).getTime() - Date.now() + 250;
    if (wait > 2_147_000_000) return;
    expiryTimer = setTimeout(
      () => {
        authApi.session().catch(() => {
          /* 401 → interceptor expira a sessão */
        });
      },
      Math.max(0, wait),
    );
  };

  const initial = sessionStore.get();
  realtime.connect(initial.status === "authenticated" ? initial.token : null);
  scheduleExpiryCheck(initial);

  if (initial.status === "authenticated" && !initial.verified) {
    authApi
      .session()
      .then((res) => sessionStore.verify(res))
      .catch(() => {
        /* erro de sessão já tratado pelo interceptor; falha de rede mantém a sessão local */
      });
  }

  const unsubscribe = sessionStore.subscribe((next, previous) => {
    scheduleExpiryCheck(next);
    if (identity(next) === identity(previous)) return;

    if (previous.status === "authenticated") {
      void queryClient.cancelQueries({ queryKey: qk.private(previous.user.id) });
      queryClient.removeQueries({ queryKey: qk.private(previous.user.id) });
      // Expiração preserva o rascunho do checkout para retomada; logout limpa.
      if (next.status === "anonymous" && next.reason === "logout") clearCheckoutStorage(previous.user.id);
    }
    queryClient.removeQueries({ queryKey: qk.carts });
    queryClient.removeQueries({ queryKey: qk.quotes });
    realtime.connect(next.status === "authenticated" ? next.token : null);
  });

  return () => {
    clearTimeout(expiryTimer);
    unsubscribe();
    realtime.disconnect();
  };
}
