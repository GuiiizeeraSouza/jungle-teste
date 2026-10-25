"use client";

import { Star } from "lucide-react";
import { toast } from "sonner";
import { useAnnouncements } from "@/lib/announce";
import { cn } from "@/lib/utils";

export function Rating({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Avaliação ${value.toFixed(1)} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3.5", i < Math.round(value) ? "fill-primary text-primary" : "fill-transparent text-primary/50")}
        />
      ))}
    </span>
  );
}

/**
 * Ações fora do escopo da entrega: deixam claro que não estão disponíveis
 * (sem aparentar sucesso funcional).
 */
export function notAvailable(feature: string) {
  toast.info(`${feature} ainda não está disponível`, {
    id: `na-${feature}`,
    description: "Esta funcionalidade não faz parte desta versão da Kurio.",
  });
}

/** Regiões aria-live globais para atualizações em tempo real. */
export function LiveAnnouncer() {
  const { polite, assertive } = useAnnouncements();
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </>
  );
}

export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only z-[100] rounded-[4px] bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Pular para o conteúdo
    </a>
  );
}

export function shortAddress(address: string) {
  if (address.length <= 14 || !address.startsWith("0x")) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
