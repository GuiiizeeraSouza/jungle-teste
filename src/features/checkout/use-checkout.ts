"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput, Network, Order, Quote, WalletConnectionInput } from "@/contracts";
import { ordersApi, quoteApi, walletConnectionApi, walletsApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import { checkoutStorage } from "@/lib/session/checkout-storage";
import { useCartOwner } from "@/features/cart/use-cart";
import { useCurrentUser } from "@/features/session/use-session";

export function useWallets() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: qk.wallets(user?.id ?? "anonymous"),
    queryFn: ({ signal }) => walletsApi.get({ signal }),
    enabled: Boolean(user),
  });
}

/** Cotação da API para a rede escolhida — referência de valores do checkout. */
export function quoteQueryOptions(owner: string, network: Network) {
  return {
    queryKey: qk.quote(owner, network),
    queryFn: ({ signal }: { signal: AbortSignal }) => quoteApi.create(network, { signal }),
    staleTime: 0,
  };
}

export function useQuote(network: Network | undefined) {
  const owner = useCartOwner();
  return useQuery({
    ...quoteQueryOptions(owner, network ?? "ethereum"),
    enabled: Boolean(network),
  });
}

export function useFetchQuote() {
  const queryClient = useQueryClient();
  const owner = useCartOwner();
  return (network: Network) => queryClient.fetchQuery({ ...quoteQueryOptions(owner, network), staleTime: 0 });
}

export function useConnectWallet() {
  return useMutation({ mutationFn: (input: WalletConnectionInput) => walletConnectionApi.connect(input) });
}

export function useDisconnectWallet() {
  return useMutation({ mutationFn: (id: string) => walletConnectionApi.disconnect(id) });
}

export function usePendingOrders() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: qk.pendingOrders(user?.id ?? "anonymous"),
    queryFn: ({ signal }) => ordersApi.pending({ signal }),
    enabled: Boolean(user),
    staleTime: 10_000,
  });
}

/**
 * Criação idempotente do pedido. A chave é derivada do conteúdo enviado e
 * persistida na sessão do navegador: reenvios após timeout, clique repetido
 * ou refresh reutilizam a mesma chave e recuperam o MESMO pedido.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  return useMutation({
    mutationKey: ["place-order"],
    mutationFn: (input: CreateOrderInput) => {
      const attempt = checkoutStorage.attemptFor(user!.id, JSON.stringify(input));
      return ordersApi.create(input, attempt.idempotencyKey);
    },
    onSuccess: (order: Order) => {
      queryClient.setQueryData(qk.order(user!.id, order.id), order);
      void queryClient.invalidateQueries({ queryKey: qk.pendingOrders(user!.id) });
    },
  });
}

export function quoteFromError(details: unknown): Quote | null {
  if (details && typeof details === "object" && "quote" in details) return (details as { quote: Quote }).quote;
  return null;
}
