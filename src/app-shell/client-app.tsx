import { startTransition, useEffect, useState, type ComponentType } from "react";
import { BootScreen } from "@/components/layout/boot-screen";
import { setNetworkGate } from "@/lib/network-gate";

const MOCKS_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

/**
 * Camada de rede simulada (MSW): inicia em paralelo com o bundle da aplicação.
 * A interface renderiza assim que o JS carrega; requisições REST e o Socket.IO
 * aguardam o portão de rede (ver lib/network-gate).
 */
const mocksReady: Promise<ComponentType | null> | null =
  typeof window !== "undefined" && MOCKS_ENABLED
    ? import("@/mocks/browser").then(async (m) => {
        await m.startMocks();
        return (await import("@/mocks/panel")).MockPanel;
      })
    : null;

if (mocksReady) setNetworkGate(mocksReady);

const appModule = typeof window !== "undefined" ? import("@/app-shell/app") : null;

/**
 * Monta a SPA (somente no cliente) dentro de uma transição: o React renderiza
 * em fatias e cede o main thread, em vez de um único bloqueio longo.
 */
export function ClientApp() {
  const [App, setApp] = useState<ComponentType | null>(null);
  const [Panel, setPanel] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;
    void appModule?.then((m) => active && startTransition(() => setApp(() => m.App)));
    void mocksReady?.then((component) => active && setPanel(() => component));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {App ? <App /> : <BootScreen />}
      {Panel && <Panel />}
    </>
  );
}
