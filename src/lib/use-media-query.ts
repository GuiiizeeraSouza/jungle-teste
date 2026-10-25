"use client";

import { useSyncExternalStore } from "react";

/** Media query reativa. A SPA renderiza só no cliente: o valor inicial já é o real. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Breakpoint `md` (768px): a partir dele usamos os layouts desktop/tablet. */
export function useIsDesktop() {
  return useMediaQuery("(min-width: 48rem)");
}

/** Breakpoint `lg` (1024px): barra lateral de filtros fixa. */
export function useIsLargeScreen() {
  return useMediaQuery("(min-width: 64rem)");
}
