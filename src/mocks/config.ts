/**
 * Configuração da simulação de rede e de negócio da camada MSW.
 *
 * Tudo é determinístico: latências variáveis usam PRNG com semente fixa e os
 * cenários são selecionáveis por URL (`?mock=<cenario>`), pelo painel de
 * mocks ou por `window.__kurioMock.setScenario()` (usado pelo Playwright).
 */

export const SCENARIOS = {
  default: "Padrão — latência curta e realista",
  slow: "Rede lenta — 2,5 s a 4 s por requisição",
  variable: "Latência variável — 50 ms a 2,5 s (semente fixa)",
  "out-of-order": "Respostas fora de ordem — catálogo alterna respostas lentas e rápidas",
  offline: "Sem conexão — todas as requisições falham na rede",
  "server-error": "Falha 500 persistente no catálogo",
  flaky: "Instável — a 1ª tentativa de cada consulta retorna 503",
  "empty-catalog": "Catálogo vazio",
  "session-expired": "Sessões expiram 20 s após o login",
  "payment-declined": "Pagamento recusado pela rede",
  "order-timeout": "Pedido criado, mas a resposta excede o timeout (recuperação por idempotência)",
  "price-change-checkout": "Preço alterado no momento da confirmação da compra",
  "sold-out-checkout": "Edição esgota no momento da confirmação da compra",
  "wallet-reject": "Carteira recusa a conexão",
  "manual-orders": "Pedidos ficam pendentes até resolução manual (painel/testes)",
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

export interface RouteOverride {
  method: string;
  /** Prefixo do caminho, ex.: "/api/v1/favorites" (ou caminho exato com `exact`). */
  path: string;
  exact?: boolean;
  status?: number;
  /** `network` simula falha de conexão; `timeout` segura a resposta além do timeout do cliente. */
  failure?: "network" | "timeout";
  delayMs?: number;
  /** Quantas vezes aplicar (padrão: sempre). */
  times?: number;
}

export interface MockConfig {
  scenario: ScenarioId;
  latency: { min: number; max: number };
  seed: number;
  /** Tempo até o pedido sair de "pending" (ms). */
  orderProcessingMs: number;
  sessionTtlMs: number;
  overrides: RouteOverride[];
}

const STORAGE_KEY = "kurio.mock.config";

const LATENCY_BY_SCENARIO: Partial<Record<ScenarioId, { min: number; max: number }>> = {
  slow: { min: 2500, max: 4000 },
  variable: { min: 50, max: 2500 },
};

export function defaultConfig(scenario: ScenarioId = "default"): MockConfig {
  return {
    scenario,
    latency: LATENCY_BY_SCENARIO[scenario] ?? { min: 80, max: 260 },
    seed: 42,
    // No cenário de timeout o pedido é processado depois do timeout do cliente (8 s).
    orderProcessingMs: scenario === "order-timeout" ? 15_000 : 2500,
    sessionTtlMs: scenario === "session-expired" ? 20_000 : 2 * 60 * 60 * 1000,
    overrides: [],
  };
}

let current: MockConfig = defaultConfig();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* armazenamento indisponível: mantém apenas em memória */
  }
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<MockConfig>;
      current = { ...defaultConfig(stored.scenario ?? "default"), ...stored };
    }
  } catch {
    current = defaultConfig();
  }
  const fromUrl = new URLSearchParams(window.location.search).get("mock");
  if (fromUrl && fromUrl in SCENARIOS && fromUrl !== current.scenario) {
    current = defaultConfig(fromUrl as ScenarioId);
    persist();
  }
  rng = createRng(current.seed);
  return current;
}

export function getConfig() {
  return current;
}

export function setScenario(scenario: ScenarioId) {
  current = defaultConfig(scenario);
  rng = createRng(current.seed);
  requestCounters.clear();
  persist();
  return current;
}

export function updateConfig(patch: Partial<MockConfig>) {
  current = { ...current, ...patch };
  if (patch.seed !== undefined) rng = createRng(current.seed);
  persist();
  return current;
}

export function addOverride(override: RouteOverride) {
  current = { ...current, overrides: [...current.overrides, override] };
  persist();
}

/** Consome a primeira regra aplicável (decrementando `times`). */
export function takeOverride(method: string, pathname: string): RouteOverride | undefined {
  const index = current.overrides.findIndex(
    (o) => o.method.toUpperCase() === method.toUpperCase() && (o.exact ? pathname === o.path : pathname.startsWith(o.path)),
  );
  if (index === -1) return undefined;
  const override = current.overrides[index]!;
  if (override.times !== undefined) {
    const remaining = override.times - 1;
    const overrides = [...current.overrides];
    if (remaining <= 0) overrides.splice(index, 1);
    else overrides[index] = { ...override, times: remaining };
    current = { ...current, overrides };
    persist();
  }
  return override;
}

/* ---------------------------- aleatoriedade ------------------------------ */

function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = createRng(42);

export function nextLatency() {
  const { min, max } = current.latency;
  if (max <= min) return min;
  return Math.round(min + rng() * (max - min));
}

/** Contadores por rota — usados por "flaky" e "out-of-order". */
export const requestCounters = new Map<string, number>();

export function countRequest(key: string) {
  const next = (requestCounters.get(key) ?? 0) + 1;
  requestCounters.set(key, next);
  return next;
}
