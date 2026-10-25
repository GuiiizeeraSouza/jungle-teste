import { MutationCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

/**
 * Política de cache/retry (documentada em docs/ESTADO-E-CACHE.md):
 * - consultas: staleTime 30 s; retry automático só para falhas transitórias
 *   (rede, timeout, 5xx) com backoff exponencial, no máximo 2 novas tentativas;
 * - mutations: nunca repetem sozinhas (evita efeitos duplicados). O pedido usa
 *   chave de idempotência e repetição explícita pelo usuário;
 * - dados privados são removidos do cache ao trocar de sessão.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => error instanceof ApiError && error.retryable && failureCount < 2,
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4_000),
      },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache(),
  });
}
