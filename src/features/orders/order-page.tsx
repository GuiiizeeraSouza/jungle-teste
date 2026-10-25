"use client";

import { useEffect } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, X, XCircle } from "lucide-react";
import { NETWORK_LABEL, WALLET_TYPE_LABEL, type Order } from "@/contracts";
import { shortAddress } from "@/components/shared/misc";
import { NftImage } from "@/components/shared/nft-image";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeStatus } from "@/app-shell/realtime-context";
import { useCurrentUser } from "@/features/session/use-session";
import { ordersApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { formatEth } from "@/lib/eth";
import { qk } from "@/lib/query/keys";
import { checkoutStorage } from "@/lib/session/checkout-storage";
import { cn } from "@/lib/utils";

const EXPLORER_NAME: Record<Order["network"], string> = { ethereum: "Etherscan", polygon: "Polygonscan", solana: "Solscan" };
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** Formato do layout: "29 Jul, 2026". */
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
};

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 26 32 42l24-16v28H8z" />
      <path d="m8 54 18-14M56 54 38 40" />
      <rect x="16" y="8" width="32" height="30" rx="2" fill="var(--card)" />
      <path d="M26 8a6 6 0 0 1 12 0" />
      <text x="32" y="21" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
        THANK
      </text>
      <text x="32" y="30" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
        YOU
      </text>
    </svg>
  );
}

function Shell({ children, onClose, testId }: { children: React.ReactNode; onClose: () => void; testId?: string }) {
  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-10 md:py-28">
      <section
        aria-labelledby="pedido-title"
        data-testid={testId}
        className="relative w-full max-w-[25.75rem] border-b-8 border-b-primary bg-card shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar e voltar ao início"
          className="absolute top-3 right-3 grid size-8 place-items-center text-primary hover:opacity-80"
        >
          <X className="size-4" aria-hidden />
        </button>
        {children}
      </section>
    </div>
  );
}

function Receipt({ order }: { order: Order }) {
  const explorer = EXPLORER_NAME[order.network];
  return (
    <>
      <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-5" data-testid="order-confirmed">
        <ThankYouIcon />
        <h1 id="pedido-title" className="text-sm font-bold text-[#e9cfae]">
          Seus NFTs agora estão na sua carteira
        </h1>
      </div>
      <dl className="grid grid-cols-2 gap-y-2 border-y border-primary px-6 py-2.5 text-[0.7rem] whitespace-nowrap sm:grid-cols-[auto_auto_auto_auto] sm:justify-between sm:divide-x sm:divide-primary [&>div]:px-2.5 [&>div:first-child]:pl-0 [&>div:last-child]:pr-0">
        <div>
          <dt className="font-bold text-[#e9cfae]">ID da transação</dt>
          <dd title={order.txHash ?? undefined} data-testid="order-tx">
            {order.txHash ? shortAddress(order.txHash) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Data</dt>
          <dd>
            <time dateTime={order.confirmedAt ?? order.createdAt}>{formatDate(order.confirmedAt ?? order.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total</dt>
          <dd>{formatEth(order.total)}</dd>
        </div>
        <div>
          <dt className="font-bold text-[#e9cfae]">Carteira</dt>
          <dd>{WALLET_TYPE_LABEL[order.wallet.type]}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3 px-8 pt-5 pb-8">
        <h2 className="text-xs font-bold">Detalhes da transação</h2>
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="pb-1.5 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-1.5 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-1.5 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={`${line.nftId}-${line.editionId}`} data-testid="receipt-line">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <NftImage image={line.image} sizes="48px" decorative className="size-11 shrink-0 rounded-[4px]" />
                    <div>
                      <p className="font-bold">{line.name}</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        ID do token: {line.tokenId} · {line.editionLabel}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-[0.65rem] text-muted-foreground">(x {line.quantity})</td>
                <td className="text-right font-bold whitespace-nowrap text-price">{formatEth(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto grid w-[70%] grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border pb-2 text-xs">
          {order.coupon && (
            <>
              <dt>Desconto ({order.coupon.code})</dt>
              <dd className="text-right">(-) {formatEth(order.discount)}</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right text-sm">{formatEth(order.networkFee)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right text-sm font-bold text-price" data-testid="receipt-total">
            {formatEth(order.total)}
          </dd>
        </dl>
        <p className="text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          Transação confirmada na {NETWORK_LABEL[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na
          rede.
        </p>
        {order.explorerUrl && (
          <div className="flex flex-col items-center gap-1">
            <Button asChild className="h-8 px-3 text-xs">
              <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no {explorer}
                <span className="sr-only"> (link simulado, abre em nova aba)</span>
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
            <span className="text-[0.6rem] text-muted-foreground">Referência simulada para demonstração</span>
          </div>
        )}
        <Link to="/" hash="catalogo" className="text-center text-xs text-primary hover:underline">
          Continuar explorando
        </Link>
      </div>
    </>
  );
}

function Pending({ order }: { order: Order }) {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-10 text-center" data-testid="order-pending">
      <Loader2 className="size-10 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
      <h1 id="pedido-title" className="text-base font-bold">
        Processando pagamento
      </h1>
      <p role="status" className="text-xs leading-relaxed text-muted-foreground">
        Aguardando a confirmação da rede {NETWORK_LABEL[order.network]} para o pedido {order.id}. Você pode recarregar ou fechar esta
        página: o pedido continua sendo processado e não será cobrado novamente.
      </p>
      <p className="text-sm font-bold text-price">{formatEth(order.total)}</p>
    </div>
  );
}

function Rejected({ order }: { order: Order }) {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-10 text-center" data-testid="order-rejected">
      <XCircle className="size-10 text-destructive" aria-hidden />
      <h1 id="pedido-title" className="text-base font-bold">
        Pagamento recusado
      </h1>
      <p role="alert" className="text-xs leading-relaxed text-muted-foreground">
        {order.failureReason ?? "A rede recusou o pagamento."} Nenhum valor foi debitado e seus itens continuam no carrinho.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/pagamento">Tentar novamente</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
      </div>
    </div>
  );
}

export function OrderPage() {
  const { orderId } = useParams({ from: "/authed/pedidos/$orderId" });
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const realtime = useRealtimeStatus();

  const query = useQuery({
    queryKey: qk.order(user.id, orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, { signal }),
    // Fallback: sem Socket.IO conectado, consulta o estado até o pedido terminar.
    refetchInterval: (q) => (q.state.data?.status === "pending" && realtime !== "connected" ? 4_000 : false),
  });
  const order = query.data;

  // Estados terminais encerram a tentativa de checkout (nova compra = nova chave).
  useEffect(() => {
    if (!order || order.status === "pending") return;
    checkoutStorage.clearAttempt(user.id);
    if (order.status === "confirmed") checkoutStorage.clearDraft(user.id);
    void queryClient.invalidateQueries({ queryKey: qk.carts });
  }, [order?.status, order, user.id, queryClient]);

  useEffect(() => {
    document.title = order?.status === "confirmed" ? "Pedido confirmado · Kurio" : "Pedido · Kurio";
  }, [order?.status]);

  const close = () => void navigate({ to: "/" });

  if (query.isPending) {
    return (
      <Shell onClose={close}>
        <div className="flex flex-col gap-3 p-8" aria-busy="true" aria-label="Carregando pedido">
          <Skeleton className="mx-auto size-14" />
          <Skeleton className="h-4" />
          <Skeleton className="h-24" />
        </div>
      </Shell>
    );
  }

  if (query.error && !order) {
    const apiError = toApiError(query.error);
    return (
      <Shell onClose={close}>
        <div className="p-6">
          <h1 id="pedido-title" className="sr-only">
            Pedido indisponível
          </h1>
          <ErrorState
            error={query.error}
            title={apiError.isNotFound ? "Pedido não encontrado" : apiError.code === "FORBIDDEN" ? "Acesso negado" : undefined}
            onRetry={apiError.retryable ? () => void query.refetch() : undefined}
            retrying={query.isRefetching}
            className={cn("border-0")}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={close} testId="order-card">
      {order!.status === "confirmed" ? (
        <Receipt order={order!} />
      ) : order!.status === "rejected" ? (
        <Rejected order={order!} />
      ) : (
        <Pending order={order!} />
      )}
    </Shell>
  );
}
