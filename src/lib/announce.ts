import { useSyncExternalStore } from "react";

/**
 * Anúncios para leitores de tela (aria-live) — usados em atualizações que
 * acontecem sem ação direta do usuário, como eventos em tempo real.
 */
type Politeness = "polite" | "assertive";

let messages: Record<Politeness, string> = { polite: "", assertive: "" };
const listeners = new Set<() => void>();
let counter = 0;

export function announce(message: string, politeness: Politeness = "polite") {
  // Sufixo invisível força a releitura de mensagens repetidas.
  counter += 1;
  messages = { ...messages, [politeness]: `${message}${counter % 2 ? "​" : ""}` };
  for (const l of listeners) l();
}

export function useAnnouncements() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => messages,
    () => messages,
  );
}
