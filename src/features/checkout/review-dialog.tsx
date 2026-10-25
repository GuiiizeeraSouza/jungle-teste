"use client";

import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { NETWORK_LABEL, WALLET_TYPE_LABEL, type Quote, type WalletConnection } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shortAddress } from "@/components/shared/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDiscount, formatEth } from "@/lib/eth";
import { SummaryRows } from "@/features/cart/price-summary";
import type { BuyerInfo } from "@/contracts";

export interface ReviewState {
  /** Cotação que o colecionador viu e aceitou. */
  acknowledgedQuote: Quote;
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acknowledged: Quote | null;
  latest: Quote | undefined;
  refreshing: boolean;
  onAcceptLatest: () => void;
  onConfirm: () => void;
  placing: boolean;
  error: string | null;
  timedOut: boolean;
  connection: WalletConnection | null;
  buyer: BuyerInfo | null;
}

function changesBetween(previous: Quote, next: Quote) {
  const changes: string[] = [];
  for (const line of next.lines) {
    const before = previous.lines.find((l) => l.cartItemId === line.cartItemId);
    if (!before) changes.push(`${line.name} foi adicionado.`);
    else if (before.unitPrice !== line.unitPrice)
      changes.push(`${line.name}: ${formatEth(before.unitPrice)} → ${formatEth(line.unitPrice)}`);
    else if (before.quantity !== line.quantity) changes.push(`${line.name}: quantidade ${before.quantity} → ${line.quantity}`);
  }
  for (const line of previous.lines)
    if (!next.lines.some((l) => l.cartItemId === line.cartItemId)) changes.push(`${line.name} saiu do pedido.`);
  if (previous.discount !== next.discount)
    changes.push(`Desconto: ${formatDiscount(previous.discount)} → ${formatDiscount(next.discount)}`);
  if (previous.networkFee !== next.networkFee)
    changes.push(`Taxa de rede: ${formatEth(previous.networkFee)} → ${formatEth(next.networkFee)}`);
  if (previous.total !== next.total) changes.push(`Total: ${formatEth(previous.total)} → ${formatEth(next.total)}`);
  return changes;
}

export function ReviewDialog(props: ReviewDialogProps) {
  const { open, onOpenChange, acknowledged, latest, refreshing, onAcceptLatest, onConfirm, placing, error, timedOut, connection, buyer } =
    props;
  const quote = latest ?? acknowledged;
  const stale = Boolean(acknowledged && latest && latest.id !== acknowledged.id);
  const blocked = Boolean(latest?.issues.length);
  const changes = stale ? changesBetween(acknowledged!, latest!) : [];

  return (
    <Dialog open={open} onOpenChange={(value) => !placing && onOpenChange(value)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="review-dialog">
        <DialogHeader>
          <DialogTitle>Revise sua compra</DialogTitle>
          <DialogDescription>Confira os itens, as taxas e a carteira antes de enviar o pedido.</DialogDescription>
        </DialogHeader>

        {!quote ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="flex flex-col gap-4 text-xs">
            {stale && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-[4px] border border-warning/60 bg-warning/10 p-3"
                data-testid="quote-changed"
              >
                <p className="flex items-center gap-2 font-bold text-warning">
                  <AlertTriangle className="size-4" aria-hidden /> Os valores mudaram desde a sua revisão
                </p>
                <ul className="list-disc pl-5">
                  {changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="w-fit" onClick={onAcceptLatest} disabled={blocked}>
                  Revisar novos valores
                </Button>
              </div>
            )}
            {blocked && (
              <div role="alert" className="rounded-[4px] border border-destructive/60 bg-destructive/10 p-3 text-destructive">
                {latest!.issues.map((i) => (
                  <p key={i.cartItemId}>{i.message}</p>
                ))}
                <p className="mt-1 text-foreground">Volte ao carrinho para ajustar os itens.</p>
              </div>
            )}

            <ul className="flex flex-col gap-2" aria-label="Itens do pedido">
              {quote.lines.map((line) => (
                <li key={line.cartItemId} className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                  <span>
                    <strong className="font-bold">{line.name}</strong> · Edição {line.editionLabel} · x{line.quantity}
                  </span>
                  <span className="font-bold whitespace-nowrap text-price">{formatEth(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <SummaryRows
              summary={{
                subtotal: quote.subtotal,
                discount: quote.discount,
                networkFee: quote.networkFee,
                total: quote.total,
                network: quote.network,
                feeEstimated: true,
              }}
            />

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[4px] bg-surface-strong p-3">
              <dt className="text-muted-foreground">Carteira</dt>
              <dd>{connection ? `${WALLET_TYPE_LABEL[connection.walletType]} · ${shortAddress(connection.address)}` : "—"}</dd>
              <dt className="text-muted-foreground">Rede</dt>
              <dd>{NETWORK_LABEL[quote.network]}</dd>
              <dt className="text-muted-foreground">Colecionador</dt>
              <dd>
                {buyer?.displayName} (@{buyer?.username})
              </dd>
              {quote.coupon && (
                <>
                  <dt className="text-muted-foreground">Cupom</dt>
                  <dd>{quote.coupon.code}</dd>
                </>
              )}
            </dl>

            {timedOut && (
              <p role="alert" className="rounded-[4px] border border-warning/60 bg-warning/10 p-3" data-testid="order-timeout">
                O servidor demorou para responder e não sabemos se o pedido foi registrado. Tente novamente: usamos a mesma chave de
                idempotência, então o mesmo pedido será recuperado, sem cobrança duplicada.
              </p>
            )}
            {error && !timedOut && (
              <p role="alert" className="rounded-[4px] border border-destructive/60 bg-destructive/10 p-3 text-destructive">
                {error}
              </p>
            )}
            {refreshing && (
              <p role="status" className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Revalidando preços e disponibilidade…
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={placing}>
            Voltar
          </Button>
          <Button onClick={onConfirm} disabled={placing || stale || blocked || !quote || refreshing} data-testid="confirm-order">
            {placing ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Enviando pedido…
              </>
            ) : timedOut ? (
              <>
                <RotateCw aria-hidden /> Tentar novamente
              </>
            ) : (
              `Confirmar e pagar ${quote ? formatEth(quote.total) : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
