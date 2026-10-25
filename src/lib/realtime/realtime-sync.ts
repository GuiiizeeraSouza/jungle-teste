import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Cart,
  CartNotice,
  FeaturedResponse,
  NftDetail,
  NftListResponse,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  RealtimeEvent,
} from "@/contracts";
import { announce } from "@/lib/announce";
import { formatEth } from "@/lib/eth";
import { qk } from "@/lib/query/keys";
import { sessionStore } from "@/lib/session/session-store";
import { RealtimeClient } from "./realtime-client";

function knownNftVersion(queryClient: QueryClient, nftId: string) {
  let version = queryClient.getQueryData<NftDetail>(qk.nft(nftId))?.version ?? 0;
  for (const [, list] of queryClient.getQueriesData<NftListResponse>({ queryKey: qk.nftLists })) {
    const item = list?.items.find((i) => i.id === nftId);
    if (item) version = Math.max(version, item.version);
  }
  return version;
}

function patchSummary<T extends NftSummary>(item: T, event: NftUpdatedEvent): T {
  if (item.id !== event.data.nftId || item.version >= event.version) return item;
  return {
    ...item,
    price: event.data.price,
    compareAtPrice: event.data.compareAtPrice,
    available: event.data.available,
    version: event.version,
  };
}

function noticeKey(itemId: string, notice: CartNotice) {
  if (notice.type === "price_changed") return `${itemId}:price:${notice.currentPrice}`;
  if (notice.type === "insufficient_availability") return `${itemId}:qty:${notice.available}`;
  return `${itemId}:sold_out`;
}

function noticeMessage(item: Cart["items"][number], notice: CartNotice) {
  const name = `${item.name} (${item.editionLabel})`;
  if (notice.type === "price_changed") {
    return `O preço de ${name} mudou de ${formatEth(notice.previousPrice)} para ${formatEth(notice.currentPrice)}. O resumo foi atualizado.`;
  }
  if (notice.type === "insufficient_availability") {
    return `Restam apenas ${notice.available} unidade(s) de ${name}. Ajuste a quantidade para continuar.`;
  }
  return `${name} esgotou. Remova o item para continuar.`;
}

async function syncCartAfterNftChange(queryClient: QueryClient, nftId: string) {
  const carts = queryClient.getQueriesData<Cart>({ queryKey: qk.carts });
  const affected = carts.filter(([, cart]) => cart?.items.some((i) => i.nftId === nftId));
  if (!affected.length) return;

  const before = new Set<string>();
  for (const [, cart] of affected) for (const item of cart!.items) for (const n of item.notices) before.add(noticeKey(item.id, n));

  // Cotações em aberto ficam desatualizadas — o checkout exige nova confirmação.
  await Promise.all([queryClient.invalidateQueries({ queryKey: qk.carts }), queryClient.invalidateQueries({ queryKey: qk.quotes })]);

  for (const [key] of affected) {
    const cart = queryClient.getQueryData<Cart>(key);
    for (const item of cart?.items ?? []) {
      if (item.nftId !== nftId) continue;
      for (const notice of item.notices) {
        if (before.has(noticeKey(item.id, notice))) continue;
        const message = noticeMessage(item, notice);
        toast.warning("Seu carrinho foi atualizado", { id: noticeKey(item.id, notice), description: message });
        announce(message);
      }
    }
  }
}

function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  const { data } = event;
  queryClient.setQueryData<NftDetail>(qk.nft(data.nftId), (old) => {
    if (!old || old.version >= event.version) return old;
    return {
      ...patchSummary(old, event),
      editions: old.editions.map((edition) => {
        const update = data.editions.find((e) => e.id === edition.id);
        return update ? { ...edition, price: update.price, available: update.available } : edition;
      }),
    };
  });
  queryClient.setQueriesData<NftListResponse>({ queryKey: qk.nftLists }, (old) =>
    old ? { ...old, items: old.items.map((i) => patchSummary(i, event)) } : old,
  );
  queryClient.setQueryData<FeaturedResponse>(qk.featured, (old) =>
    old ? { spotlight: patchSummary(old.spotlight, event), hero: old.hero.map((i) => patchSummary(i, event)) } : old,
  );
  void syncCartAfterNftChange(queryClient, data.nftId);
}

function applyOrderUpdated(queryClient: QueryClient, event: OrderUpdatedEvent) {
  const userId = sessionStore.userId();
  // Eventos privados de outra sessão/usuário nunca tocam o cache atual.
  if (!userId || event.userId !== userId) return;
  const { data } = event;
  queryClient.setQueryData<Order>(qk.order(userId, data.orderId), (old) => {
    if (!old || old.version >= event.version || old.status !== "pending") return old;
    return {
      ...old,
      status: data.status,
      txHash: data.txHash,
      explorerUrl: data.explorerUrl,
      failureReason: data.failureReason,
      version: event.version,
    };
  });
  void queryClient.invalidateQueries({ queryKey: qk.orders(userId) });

  if (data.status === "confirmed") {
    void queryClient.invalidateQueries({ queryKey: qk.carts });
    void queryClient.invalidateQueries({ queryKey: qk.nfts });
    announce("Pedido confirmado. Seus NFTs agora estão na sua carteira.");
    toast.success("Pedido confirmado", { id: `order-${data.orderId}`, description: "Seus NFTs agora estão na sua carteira." });
  } else if (data.status === "rejected") {
    announce("Pagamento recusado. Seus itens continuam no carrinho.", "assertive");
    toast.error("Pagamento recusado", { id: `order-${data.orderId}`, description: "Seus itens continuam no carrinho." });
  }
}

export function createRealtimeSync(queryClient: QueryClient) {
  return new RealtimeClient({
    knownVersion(event: RealtimeEvent) {
      if (event.type === "nft.updated") return knownNftVersion(queryClient, event.resource.id);
      const userId = sessionStore.userId();
      if (!userId) return 0;
      return queryClient.getQueryData<Order>(qk.order(userId, event.resource.id))?.version ?? 0;
    },
    onEvent(event) {
      if (event.type === "nft.updated") applyNftUpdated(queryClient, event);
      else applyOrderUpdated(queryClient, event);
    },
    onReconnect() {
      // Eventos perdidos durante a queda: reconcilia os recursos ativos via REST.
      void queryClient.invalidateQueries({ queryKey: qk.nfts });
      void queryClient.invalidateQueries({ queryKey: qk.carts });
      void queryClient.invalidateQueries({ queryKey: qk.quotes });
      const userId = sessionStore.userId();
      if (userId) void queryClient.invalidateQueries({ queryKey: qk.orders(userId) });
    },
  });
}
