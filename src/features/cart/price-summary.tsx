"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Coupon, PriceSummary as PriceSummaryType } from "@/contracts";
import { ApplyCouponInput } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api/errors";
import { formatDiscount, formatEth } from "@/lib/eth";
import { cn } from "@/lib/utils";
import { useApplyCoupon, useRemoveCoupon } from "./use-cart";

export function CouponForm({
  coupon,
  variant = "desktop",
  disabled,
}: {
  coupon: Coupon | null;
  variant?: "desktop" | "mobile";
  disabled?: boolean;
}) {
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (coupon) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-[3px] border border-primary/40 bg-primary/10 px-3 py-2 text-xs"
        data-testid="coupon-applied"
      >
        <span>
          Código <strong className="text-primary">{coupon.code}</strong> aplicado — {coupon.description}
        </span>
        <button
          type="button"
          onClick={() => remove.mutate(undefined, { onError: (e) => setError(toApiError(e).message) })}
          disabled={remove.isPending}
          aria-label={`Remover código promocional ${coupon.code}`}
          className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-primary/20"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = ApplyCouponInput.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Código inválido");
      return;
    }
    setError(null);
    apply.mutate(parsed.data.code, {
      onSuccess: () => setCode(""),
      onError: (e) => {
        const apiError = toApiError(e);
        setError(apiError.fields.code ?? apiError.message);
      },
    });
  };

  const mobile = variant === "mobile";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <label htmlFor={`cupom-${variant}`} className={cn("text-xs font-bold", mobile && "sr-only")}>
        Código promocional
      </label>
      <div className={cn("flex", mobile && "rounded-full border border-border bg-[#1a110d] p-1")}>
        <input
          id={`cupom-${variant}`}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `cupom-${variant}-erro` : undefined}
          disabled={disabled}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/80 focus-visible:outline-none",
            mobile
              ? "px-4 text-sm"
              : "h-8 rounded-l-[3px] border border-r-0 border-primary/60 bg-input-bg px-2 text-[0.7rem] focus-visible:border-primary aria-invalid:border-destructive",
          )}
        />
        <Button
          type="submit"
          variant={mobile ? "pill" : "default"}
          disabled={apply.isPending || disabled}
          className={mobile ? "h-11 px-6 text-base" : "h-8 rounded-l-none px-5 text-xs"}
        >
          {apply.isPending ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>
      {error && (
        <p id={`cupom-${variant}-erro`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

export function SummaryRows({ summary, size = "sm" }: { summary: PriceSummaryType; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <dl className={cn("flex flex-col", lg ? "gap-3 text-base" : "gap-2.5 text-xs")} data-testid="price-summary">
      <div className="flex justify-between gap-3">
        <dt>Subtotal</dt>
        <dd className={cn("tabular-nums", !lg && "text-sm")} data-testid="summary-subtotal">
          {formatEth(summary.subtotal)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>Desconto do lançamento</dt>
        <dd className="tabular-nums" data-testid="summary-discount">
          {formatDiscount(summary.discount)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          <span className={cn("block tabular-nums", !lg && "text-sm")} data-testid="summary-fee">
            {formatEth(summary.networkFee)}
          </span>
          {summary.feeEstimated && <span className={cn("block text-primary", lg ? "text-sm" : "text-[0.65rem]")}>Taxa estimada</span>}
        </dd>
      </div>
      <div className={cn("flex items-baseline justify-between gap-3 font-bold", lg ? "pt-1 text-xl" : "mt-2 text-sm")}>
        <dt>Total</dt>
        <dd className={cn("text-price tabular-nums", lg && "text-xl")} data-testid="summary-total">
          {formatEth(summary.total)}
        </dd>
      </div>
    </dl>
  );
}

export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando resumo" data-testid="summary-skeleton">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
      <div className="mt-2 flex justify-between">
        <Skeleton className="h-5 w-1/5" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      <Skeleton className="mt-2 h-9" />
    </div>
  );
}
