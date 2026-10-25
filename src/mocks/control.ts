import type { EditionId, NftUpdatedEvent, RealtimeEvent } from "@/contracts";
import {
  addOverride,
  getConfig,
  setScenario,
  updateConfig,
  type MockConfig,
  type RouteOverride,
  type ScenarioId,
  SCENARIOS,
} from "./config";
import { commit, db, resetDb } from "./db";
import { buildNftEvent, clearOrderTimers, findNft, resolveOrder, updateNft } from "./domain";
import { activeConnectionCount, dropConnections, getEventLog, publish } from "./realtime";

/**
 * API de controle do backend simulado. Toda mudança passa pelo "servidor":
 * altera o banco (refletido nas respostas REST) e publica o evento Socket.IO
 * correspondente — a UI nunca é manipulada diretamente.
 */
export const mockControl = {
  scenarios: SCENARIOS,
  getConfig: () => getConfig(),
  setScenario: (scenario: ScenarioId) => setScenario(scenario),
  updateConfig: (patch: Partial<MockConfig>) => updateConfig(patch),
  failNext: (override: RouteOverride) => addOverride({ times: 1, ...override }),

  /** Restaura integralmente o cenário conhecido (banco + configuração). */
  async reset(scenario: ScenarioId = "default") {
    clearOrderTimers();
    dropConnections(0);
    await resetDb();
    setScenario(scenario);
  },

  setPrice(nftId: string, editionId: EditionId, price: string) {
    return updateNft(nftId, [{ editionId, price }]).version;
  },

  setAvailability(nftId: string, editionId: EditionId, available: number) {
    return updateNft(nftId, [{ editionId, available }]).version;
  },

  /** Expira todas as sessões ativas (próxima chamada autenticada recebe 401). */
  expireSessions() {
    const state = db();
    for (const s of state.sessions) s.expiresAt = Date.now() - 1;
    commit();
  },

  /** Derruba o Socket.IO; reconexões são recusadas durante `blockMs`. */
  disconnectRealtime(blockMs = 0) {
    dropConnections(blockMs);
  },

  /** Simula a carteira desconectando no meio do checkout. */
  disconnectWallets() {
    const state = db();
    for (const c of state.connections) c.active = false;
    commit();
  },

  resolveOrder(orderId: string, outcome: "confirmed" | "rejected") {
    return resolveOrder(orderId, outcome);
  },

  latestOrderId() {
    const orders = db().orders;
    return orders[orders.length - 1]?.id ?? null;
  },

  /** Reenvia um evento já publicado (mesmo id) — teste de deduplicação. */
  replayEvent(eventId: string) {
    const event = getEventLog().find((e) => e.id === eventId);
    if (event) publish(event, { log: false });
    return Boolean(event);
  },

  /** Publica um nft.updated com versão antiga e dados divergentes — o cliente deve ignorar. */
  emitStaleNftEvent(nftId: string, price: string) {
    const nft = findNft(nftId);
    if (!nft) return null;
    const event: NftUpdatedEvent = buildNftEvent(nft, "price", Math.max(1, nft.version - 1));
    event.data = {
      ...event.data,
      price,
      editions: event.data.editions.map((e) => (e.id === nft.defaultEditionId ? { ...e, price } : e)),
    };
    publish(event, { log: false });
    return event.id;
  },

  events: (): RealtimeEvent[] => getEventLog(),
  connections: () => activeConnectionCount(),
  state: () => db(),
};

export type MockControl = typeof mockControl;

declare global {
  interface Window {
    __kurioMock?: MockControl;
  }
}
