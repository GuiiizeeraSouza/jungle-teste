import * as React from "react";

type AutoFocusHandler = (event: Event) => void;

/**
 * Devolve o foco ao elemento que abriu o diálogo/drawer. O Radix só faz isso
 * quando há um `Trigger`; diálogos controlados por estado perderiam o foco.
 */
export function useReturnFocus(onOpenAutoFocus?: AutoFocusHandler, onCloseAutoFocus?: AutoFocusHandler) {
  const returnTo = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const target = returnTo.current;
      if (!event.defaultPrevented && target?.isConnected && target !== document.body) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
