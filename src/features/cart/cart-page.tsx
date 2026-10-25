"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Cart, CartItem, CartNotice } from "@/contracts";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { NftImage } from "@/components/shared/nft-image";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { BackgroundRefresh, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNftList } from "@/features/catalog/queries";
import { NftStrip } from "@/features/nft/more-from-collection";
import { useSession } from "@/features/session/use-session";
import { toApiError } from "@/lib/api/errors";
import { formatEth } from "@/lib/eth";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { CouponForm, SummaryRows, SummarySkeleton } from "./price-summary";
import { useAcknowledgeCart, useCart, useRemoveCartItem, useUpdateCartItem } from "./use-cart";

function noticeText(notice: CartNotice) {
  if (notice.type === "price_changed") return `Preço alterado de ${formatEth(notice.previousPrice)} para ${formatEth(notice.currentPrice)}`;
  if (notice.type === "insufficient_availability") return `Restam apenas ${notice.available} — reduza a quantidade`;
  return "Edição esgotada — remova o item";
}

function ItemNotices({ item }: { item: CartItem }) {
  if (!item.notices.length) return null;
  return (
    <ul className="flex flex-col gap-0.5" data-testid="cart-item-notice">
      {item.notices.map((notice) => (
        <li
          key={notice.type}
          className={cn(
            "flex items-center gap-1 text-[0.7rem] font-medium",
            notice.type === "price_changed" ? "text-warning" : "text-destructive",
          )}
        >
          <AlertTriangle className="size-3 shrink-0" aria-hidden />
          {noticeText(notice)}
        </li>
      ))}
    </ul>
  );
}

function useItemActions(item: CartItem) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const limit = Math.max(1, Math.min(item.available, item.maxPerOrder));
  const pending = update.isPending || remove.isPending;
  return {
    pending,
    // Permite reduzir até 1 mesmo com quantidade acima do disponível.
    max: Math.max(limit, Math.min(item.quantity, limit)),
    setQuantity: (quantity: number) =>
      update.mutate(
        { itemId: item.id, quantity },
        { onError: (e) => toast.error("Não foi possível alterar a quantidade", { description: toApiError(e).message }) },
      ),
    remove: () =>
      remove.mutate(
        { itemId: item.id, name: item.name },
        { onError: (e) => toast.error("Não foi possível remover o item", { description: toApiError(e).message }) },
      ),
  };
}

function DesktopRow({ item }: { item: CartItem }) {
  const actions = useItemActions(item);
  return (
    <tr className="bg-card" data-testid="cart-item">
      <td className="py-2 pl-0">
        <div className="flex items-center gap-3">
          <NftImage image={item.image} sizes="48px" decorative className="size-12 shrink-0 rounded-[4px]" />
          <div className="min-w-0">
            <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="block truncate text-xs font-bold hover:text-primary">
              {item.name}
            </Link>
            <p className="text-[0.7rem] text-muted-foreground">
              ID do token: {item.tokenId} · Edição {item.editionLabel}
            </p>
            <ItemNotices item={item} />
          </div>
        </div>
      </td>
      <td className="text-xs font-bold text-price tabular-nums">{formatEth(item.unitPrice)}</td>
      <td>
        <QuantityStepper
          value={item.quantity}
          max={actions.max}
          onChange={actions.setQuantity}
          disabled={actions.pending || item.available === 0}
          label={`Quantidade de ${item.name}`}
        />
      </td>
      <td className="text-xs font-bold text-price tabular-nums">{formatEth(item.lineTotal)}</td>
      <td className="pr-3 text-right">
        <button
          type="button"
          onClick={actions.remove}
          disabled={actions.pending}
          aria-label={`Remover ${item.name} do carrinho`}
          className="grid size-8 place-items-center rounded-full text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}

function MobileItem({ item }: { item: CartItem }) {
  const actions = useItemActions(item);
  return (
    <li className="relative flex overflow-hidden rounded-xl bg-card" data-testid="cart-item">
      <NftImage image={item.image} sizes="88px" decorative className="w-[5.5rem] shrink-0 self-stretch rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="truncate text-base font-bold hover:text-primary">
            {item.name}
          </Link>
          <button
            type="button"
            onClick={actions.remove}
            disabled={actions.pending}
            aria-label={`Remover ${item.name} do carrinho`}
            className="-mt-1 grid size-8 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Edição: {item.editionLabel}</p>
        <ItemNotices item={item} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-price tabular-nums">{formatEth(item.lineTotal)}</p>
          <QuantityStepper
            value={item.quantity}
            max={actions.max}
            onChange={actions.setQuantity}
            disabled={actions.pending || item.available === 0}
            label={`Quantidade de ${item.name}`}
            variant="ghost"
            size="md"
            className="[&_button]:size-7"
          />
        </div>
      </div>
    </li>
  );
}

function PriceChangeBanner({ cart }: { cart: Cart }) {
  const acknowledge = useAcknowledgeCart();
  const changed = cart.items.filter((i) => i.notices.some((n) => n.type === "price_changed"));
  const blocking = cart.items.filter((i) => i.notices.some((n) => n.type !== "price_changed"));
  if (!changed.length && !blocking.length) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[4px] border border-warning/50 bg-warning/10 p-3 text-xs"
      data-testid="cart-changes-banner"
    >
      <p className="flex items-center gap-2 font-bold text-warning">
        <AlertTriangle className="size-4" aria-hidden />
        Seu carrinho foi atualizado
      </p>
      {changed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            {changed.length === 1 ? "O preço de 1 item mudou" : `Os preços de ${changed.length} itens mudaram`}. O resumo já reflete os
            novos valores.
          </p>
          <Button size="sm" variant="outline" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending} className="h-7">
            Entendi
          </Button>
        </div>
      )}
      {blocking.length > 0 && <p>Ajuste as quantidades ou remova os itens indisponíveis para continuar.</p>}
    </div>
  );
}

function CheckoutActions({ cart, mobile }: { cart: Cart; mobile?: boolean }) {
  const navigate = useNavigate();
  const session = useSession();
  const blocked = cart.hasBlockingIssues || cart.items.length === 0;
  const go = () => {
    if (session.status !== "authenticated") {
      toast.info("Entre para finalizar a compra", { description: "Seus itens continuam no carrinho." });
      void navigate({ to: "/entrar", search: { redirect: "/pagamento" } });
      return;
    }
    void navigate({ to: "/pagamento" });
  };
  if (mobile) {
    return (
      <Button
        variant="pill"
        size="xl"
        className="w-full"
        onClick={go}
        disabled={blocked}
        aria-describedby={blocked ? "checkout-blocked" : undefined}
      >
        Conectar e finalizar
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <Button className="h-9 w-full text-xs" onClick={go} disabled={blocked} aria-describedby={blocked ? "checkout-blocked" : undefined}>
        Conectar e finalizar
      </Button>
      <Link to="/" hash="catalogo" className="text-xs text-primary hover:underline">
        Continuar explorando
      </Link>
    </div>
  );
}

function CartSkeleton({ desktop }: { desktop: boolean }) {
  return (
    <div aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton" className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className={desktop ? "h-12" : "h-24 rounded-xl"} />
      ))}
    </div>
  );
}

function AlsoViewed() {
  const { data, isPending } = useNftList({ sort: "rating", pageSize: 8 });
  return <NftStrip title="Colecionadores também viram" items={data?.items} loading={isPending} />;
}

export function CartPage() {
  const desktop = useIsDesktop();
  const { data: cart, isPending, error, refetch, isRefetching, isFetching } = useCart();
  const empty = cart && cart.items.length === 0;

  const blockedNote = cart?.hasBlockingIssues ? (
    <p id="checkout-blocked" className="text-center text-xs text-destructive">
      Resolva os itens indisponíveis para continuar.
    </p>
  ) : null;

  if (!desktop) {
    return (
      <div className="flex min-h-dvh flex-col">
        <MobileTopBar title="Carrinho de NFTs" asHeading fallback="/" />
        <div className="flex flex-1 flex-col gap-3 px-6 pt-2 pb-6">
          {isPending ? (
            <CartSkeleton desktop={false} />
          ) : error && !cart ? (
            <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
          ) : empty ? (
            <EmptyState
              title="Seu carrinho está vazio"
              description="Explore o mercado e adicione NFTs para começar sua coleção."
              action={
                <Button asChild>
                  <Link to="/" hash="catalogo">
                    Explorar o mercado
                  </Link>
                </Button>
              }
            />
          ) : cart ? (
            <>
              <PriceChangeBanner cart={cart} />
              <ul className="flex flex-col gap-4" aria-label="Itens do carrinho">
                {cart.items.map((item) => (
                  <MobileItem key={item.id} item={item} />
                ))}
              </ul>
            </>
          ) : null}
        </div>
        {!empty && !(error && !cart) && (
          <section
            aria-label="Resumo do pedido"
            className="sticky bottom-0 z-20 flex flex-col gap-4 rounded-t-[2rem] bg-card px-6 pt-5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
          >
            {cart ? (
              <>
                <CouponForm coupon={cart.coupon} variant="mobile" />
                <SummaryRows summary={cart.summary} size="lg" />
                {blockedNote}
                <CheckoutActions cart={cart} mobile />
              </>
            ) : (
              <SummarySkeleton />
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="container-page flex flex-col gap-16 pt-4">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,14.5rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,15.5rem)] xl:gap-14">
        <section aria-labelledby="carrinho-title" className="flex min-w-0 flex-col gap-3">
          <Breadcrumbs items={[{ label: "Início", to: "/" }, { label: "Mercado", to: "/", hash: "catalogo" }, { label: "Carrinho" }]} />
          <div className="flex items-center justify-between">
            <h1 id="carrinho-title" className="sr-only">
              Carrinho de NFTs
            </h1>
            <BackgroundRefresh active={isFetching && !isPending} />
          </div>
          {isPending ? (
            <CartSkeleton desktop />
          ) : error && !cart ? (
            <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
          ) : empty ? (
            <EmptyState
              title="Seu carrinho está vazio"
              description="Explore o mercado e adicione NFTs para começar sua coleção."
              action={
                <Button asChild>
                  <Link to="/" hash="catalogo">
                    Explorar o mercado
                  </Link>
                </Button>
              }
            />
          ) : cart ? (
            <>
              <PriceChangeBanner cart={cart} />
              <table className="w-full border-separate border-spacing-y-1.5 text-left">
                <caption className="sr-only">Itens do carrinho</caption>
                <thead>
                  <tr className="text-xs font-bold">
                    <th scope="col" className="w-[44%] pb-1 font-bold">
                      NFTs
                    </th>
                    <th scope="col" className="pb-1 font-bold">
                      Preço
                    </th>
                    <th scope="col" className="pb-1 font-bold">
                      Edições
                    </th>
                    <th scope="col" className="pb-1 font-bold">
                      Total
                    </th>
                    <th scope="col" className="pb-1">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_td:first-child]:pl-1">
                  {cart.items.map((item) => (
                    <DesktopRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>

        <aside aria-labelledby="resumo-title" className="flex flex-col gap-4 lg:pt-5">
          <h2 id="resumo-title" className="border-b border-border pb-1.5 text-sm font-bold">
            Resumo da carteira
          </h2>
          {cart && !empty ? (
            <>
              <CouponForm coupon={cart.coupon} />
              <SummaryRows summary={cart.summary} />
              {blockedNote}
              <CheckoutActions cart={cart} />
            </>
          ) : isPending ? (
            <SummarySkeleton />
          ) : (
            <p className="text-xs text-muted-foreground">Adicione itens para ver o resumo.</p>
          )}
        </aside>
      </div>
      <AlsoViewed />
    </div>
  );
}
