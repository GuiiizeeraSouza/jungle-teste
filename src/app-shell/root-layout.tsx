"use client";

import { useEffect, useRef } from "react";
import { Outlet, useMatches, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { LiveAnnouncer, SkipLink } from "@/components/shared/misc";
import { SessionExpiredDialog } from "@/features/auth/session-expired-dialog";
import { PendingOrderBanner } from "@/features/orders/pending-order-banner";
import { cn } from "@/lib/utils";
import type { RouteChrome } from "./router";

function useChrome(): Required<RouteChrome> {
  const matches = useMatches();
  const chrome = [...matches].reverse().find((m) => m.staticData?.chrome)?.staticData?.chrome ?? {};
  return { mobileNav: chrome.mobileNav ?? false, footer: chrome.footer ?? "all", header: chrome.header ?? true };
}

/** Move o foco para o conteúdo a cada troca de página (leitores de tela/teclado). */
function useRouteFocus() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("conteudo")?.focus({ preventScroll: true });
  }, [pathname]);
}

export function RootLayout() {
  const chrome = useChrome();
  useRouteFocus();

  return (
    <>
      <SkipLink />
      {chrome.header && <SiteHeader />}
      <PendingOrderBanner />
      {/* Altura mínima de tela: o rodapé nunca aparece acima da dobra durante o carregamento (evita CLS). */}
      <main id="conteudo" tabIndex={-1} className={cn("min-h-dvh outline-none", chrome.mobileNav && "pb-28 md:pb-0")}>
        <Outlet />
      </main>
      {chrome.footer !== "none" && (
        <SiteFooter className={cn(chrome.footer === "desktop" && "hidden md:block", chrome.mobileNav && "mb-24 md:mb-0")} />
      )}
      {chrome.mobileNav && <MobileBottomNav />}
      <SessionExpiredDialog />
      <LiveAnnouncer />
      <Toaster
        theme="dark"
        position="top-center"
        // Abaixo do cabeçalho/barra superior: toasts não cobrem navegação nem ações.
        offset={{ top: 76 }}
        mobileOffset={{ top: 80 }}
        closeButton
        toastOptions={{
          classNames: {
            toast: "!bg-card !border-border !text-foreground !font-sans",
            description: "!text-muted-foreground",
            actionButton: "!bg-primary !text-primary-foreground",
          },
        }}
      />
    </>
  );
}
