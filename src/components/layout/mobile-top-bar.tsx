"use client";

import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileTopBarProps {
  title?: string;
  /** Destino quando não há histórico (acesso direto). */
  fallback?: string;
  action?: React.ReactNode;
  className?: string;
  /** O título é o h1 da página no mobile. */
  asHeading?: boolean;
}

export function BackButton({ fallback = "/", className, label = "Voltar" }: { fallback?: string; className?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        if (router.history.canGoBack()) router.history.back();
        else void router.navigate({ to: fallback });
      }}
      className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-surface-strong text-primary hover:bg-accent", className)}
    >
      <ChevronLeft className="size-5" aria-hidden />
    </button>
  );
}

/** Barra superior das telas mobile (voltar + título), conforme o layout. */
export function MobileTopBar({ title, fallback = "/", action, className, asHeading = false }: MobileTopBarProps) {
  const Title = asHeading ? "h1" : "p";
  return (
    <div className={cn("flex items-center gap-4 px-6 pt-6 pb-3 md:hidden", className)}>
      <BackButton fallback={fallback} />
      {title && (
        <Title className="flex-1 pr-11 text-center text-[clamp(1.05rem,4.8vw,1.25rem)] leading-tight font-bold text-balance">{title}</Title>
      )}
      {action}
    </div>
  );
}
