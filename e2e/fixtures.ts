import { test as base, expect, type Page } from "@playwright/test";
import type { MockControl } from "../src/mocks/control";
import type { ScenarioId } from "../src/mocks/config";

export const USERS = {
  nova: { email: "nova@kurio.test", password: "Kurio2026", name: "Nova Sato", id: "usr_nova" },
  leo: { email: "leo@kurio.test", password: "Kurio2026", name: "Leo Prado", id: "usr_leo" },
} as const;

type MockFn = <T, A = undefined>(fn: (mock: MockControl, arg: A) => T | Promise<T>, arg?: A) => Promise<Awaited<T>>;

export interface AppFixture {
  /** Abre uma rota com a camada de mocks pronta. */
  goto: (path: string) => Promise<void>;
  /** Executa uma ação no backend simulado (MSW) — nunca na UI. */
  mock: MockFn;
  /** Autentica pela API simulada e grava a sessão como o app faria. */
  loginViaApi: (user?: keyof typeof USERS) => Promise<void>;
  /** Adiciona itens ao carrinho pela API (pré-condição de testes). */
  addToCartViaApi: (items: Array<{ nftId: string; editionId?: string; quantity: number }>) => Promise<void>;
  isMobile: boolean;
}

declare global {
  interface Window {
    __kurioMock?: MockControl;
  }
}

/** Script injetado na página: fetch com nova tentativa em falha de rede (pré-condições de teste). */
const FETCH_WITH_RETRY = `async function fetchRetry(url, init) {
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(url, init); }
    catch (error) { if (attempt >= 5) throw error; await new Promise((r) => setTimeout(r, 600)); }
  }
}`;

async function waitForMocks(page: Page) {
  await page.waitForFunction(() => Boolean(window.__kurioMock), undefined, { timeout: 30_000 });
}

export const test = base.extend<{ scenario: ScenarioId; app: AppFixture }>({
  scenario: ["default", { option: true }],

  app: async ({ page, scenario, isMobile }, use) => {
    // Cenário aplicado antes do primeiro carregamento (uma única vez por teste).
    await page.addInitScript((id) => {
      if (sessionStorage.getItem("e2e.scenarioApplied")) return;
      sessionStorage.setItem("e2e.scenarioApplied", "1");
      localStorage.setItem("kurio.mock.config", JSON.stringify({ scenario: id }));
    }, scenario);

    const mock: MockFn = async (fn, arg) => {
      await waitForMocks(page);
      return page.evaluate(({ source, arg }) => new Function("mock", "arg", `return (${source})(mock, arg);`)(window.__kurioMock, arg), {
        source: fn.toString(),
        arg,
      }) as never;
    };

    const app: AppFixture = {
      isMobile: Boolean(isMobile),
      goto: async (path) => {
        await page.goto(path);
        await waitForMocks(page);
      },
      mock,
      loginViaApi: async (user = "nova") => {
        await waitForMocks(page);
        const { email, password } = USERS[user];
        await page.evaluate(
          async ({ email, password, helper }) => {
            const fetchRetry = new Function(`return (${helper})`)() as typeof fetch;
            const res = await fetchRetry("/api/v1/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const session = await res.json();
            localStorage.setItem(
              "kurio.session",
              JSON.stringify({ token: session.token, user: session.user, expiresAt: session.expiresAt }),
            );
          },
          { email, password, helper: FETCH_WITH_RETRY },
        );
      },
      addToCartViaApi: async (items) => {
        await waitForMocks(page);
        await page.evaluate(
          async ({ list, helper }) => {
            const fetchRetry = new Function(`return (${helper})`)() as typeof fetch;
            const session = JSON.parse(localStorage.getItem("kurio.session") ?? "null");
            for (const item of list) {
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (session) headers.Authorization = `Bearer ${session.token}`;
              if (!session) {
                let cartId = localStorage.getItem("kurio.cartId");
                if (!cartId) {
                  cartId = `guest_${crypto.randomUUID()}`;
                  localStorage.setItem("kurio.cartId", cartId);
                }
                headers["X-Cart-Id"] = cartId;
              }
              const res = await fetchRetry("/api/v1/cart/items", {
                method: "POST",
                headers,
                body: JSON.stringify({ nftId: item.nftId, editionId: item.editionId ?? "1-50", quantity: item.quantity }),
              });
              if (!res.ok) throw new Error(`addToCart falhou: ${res.status}`);
            }
          },
          { list: items, helper: FETCH_WITH_RETRY },
        );
      },
    };
    await use(app);
  },
});

export { expect };

/** Preenche o login no formulário (modal no desktop, página no mobile). */
export async function fillLogin(page: Page, user: keyof typeof USERS = "nova") {
  await page.getByPlaceholder("contato@email.com").fill(USERS[user].email);
  await page.getByPlaceholder("Senha").fill(USERS[user].password);
  await page.getByRole("form", { name: "Entrar" }).getByRole("button", { name: "Entrar" }).click();
}

/** Abre o menu da conta (desktop) ou navega para o perfil (mobile) e sai. */
export async function logout(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Meu perfil" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Entrar" })).toBeVisible();
  } else {
    await page.getByRole("button", { name: /Menu da conta/ }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page.getByRole("banner").getByRole("link", { name: "Entrar" })).toBeVisible();
  }
}

export const CART_THREE_ITEMS = [
  { nftId: "emerald-ape-042", quantity: 2 },
  { nftId: "violet-nomad-314", quantity: 6 },
  { nftId: "ivory-baron-088", quantity: 9 },
];
