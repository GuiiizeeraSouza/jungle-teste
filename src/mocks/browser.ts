import { setupWorker } from "msw/browser";
import { loadConfig } from "./config";
import { DB_STORAGE_KEY, initDb, syncFromStorage } from "./db";
import { resumePendingOrders } from "./domain";
import { mockControl } from "./control";
import { accountHandlers } from "./handlers/account";
import { authHandlers } from "./handlers/auth";
import { catalogHandlers } from "./handlers/catalog";
import { commerceHandlers } from "./handlers/commerce";
import { realtimeHandler } from "./realtime";

export const handlers = [...authHandlers, ...catalogHandlers, ...commerceHandlers, ...accountHandlers, realtimeHandler];

/**
 * Inicializa a camada de mocks: carrega configuração e banco persistido,
 * registra o Service Worker (REST) e a interceptação de WebSocket (Socket.IO).
 */
export async function startMocks() {
  loadConfig();
  await initDb();

  const worker = setupWorker(...handlers);
  await worker.start({
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
    // Assets, imagens e chunks do Next seguem para a rede normalmente.
    onUnhandledRequest: "bypass",
  });

  resumePendingOrders();
  window.addEventListener("storage", (event) => {
    if (event.key === DB_STORAGE_KEY) syncFromStorage(event.newValue);
  });
  window.__kurioMock = mockControl;
}
