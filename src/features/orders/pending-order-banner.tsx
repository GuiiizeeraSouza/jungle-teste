"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { usePendingOrders } from "@/features/checkout/use-checkout";
import { useCurrentUser } from "@/features/session/use-session";

/** Recupera um pedido pendente após refresh/reconexão em qualquer tela. */
export function PendingOrderBanner() {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = usePendingOrders();
  const order = data?.items[0];
  if (!user || !order || pathname.startsWith("/pedidos/")) return null;
  return (
    <div role="status" className="bg-band" data-testid="pending-order-banner">
      <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
        <span className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
          Você tem um pedido em processamento.
        </span>
        <Link to="/pedidos/$orderId" params={{ orderId: order.id }} className="font-bold text-primary hover:underline">
          Acompanhar pedido
        </Link>
      </div>
    </div>
  );
}
