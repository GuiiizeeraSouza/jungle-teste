import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const cards = (page: Page) => page.getByTestId("nft-card");
const cardNames = (page: Page) => cards(page).getByRole("heading").allInnerTexts();

async function search(page: Page, term: string, isMobile: boolean) {
  if (isMobile) {
    const box = page.getByRole("searchbox", { name: "Explorar coleções" });
    await box.fill(term);
    await box.press("Enter");
  } else {
    await page.getByRole("button", { name: "Buscar NFTs" }).click();
    const dialog = page.getByRole("dialog", { name: "Buscar na Kurio" });
    await dialog.getByRole("searchbox", { name: "Termo de busca" }).fill(term);
    await dialog.getByRole("button", { name: "Buscar" }).click();
  }
}

/** No mobile os filtros ficam em um drawer; no desktop, na barra lateral. */
async function filters(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir filtros" }).click();
    return page.getByRole("dialog", { name: "Filtros" });
  }
  return page.getByRole("complementary", { name: "Filtros do catálogo" });
}

async function closeFilters(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: /^Ver \d+ resultados$/ }).click();
}

test.describe("Catálogo", () => {
  test("busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem ao histórico e refresh", async ({ page, app }) => {
    await app.goto("/");
    await expect(cards(page)).toHaveCount(9);
    await expect(cards(page).first()).toContainText("Emerald Ape #042");

    // Paginação
    await page.getByRole("link", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByText(/NFTs · página 2 de \d+/)).toBeVisible();
    const page2 = await cardNames(page);
    expect(page2).not.toContain("Emerald Ape #042");

    // Filtros combinados (categoria + rede) reiniciam a paginação.
    const expectedCount = await app.mock((m) => m.state().nfts.filter((n) => n.category === "musica" && n.network === "polygon").length);
    let panel = await filters(page, app.isMobile);
    await panel.getByRole("checkbox", { name: /Música/ }).check();
    await expect(page).toHaveURL(/categoria=musica/);
    await expect(page).not.toHaveURL(/pagina=/);
    await panel.getByRole("checkbox", { name: /Polygon/ }).check();
    await expect(page).toHaveURL(/categoria=musica&rede=polygon|rede=polygon.*categoria=musica/);
    await closeFilters(page, app.isMobile);
    await expect(cards(page)).toHaveCount(expectedCount);
    await expect(page.getByRole("heading", { name: "Golden Beat #207" })).toBeVisible();

    // Ordenação por menor preço
    panel = app.isMobile ? await filters(page, true) : page.locator("main");
    await panel.getByRole("combobox", { name: "Ordenar por:" }).click();
    await page.getByRole("option", { name: "Menor preço" }).click();
    await closeFilters(page, app.isMobile);
    await expect(page).toHaveURL(/ordem=price-asc/);
    const prices = await cards(page).getByTestId("nft-price").allInnerTexts();
    const values = prices.map((p) => Number(p.replace(" ETH", "")));
    expect(values).toEqual([...values].sort((a, b) => a - b));

    // Busca
    await search(page, "golden", app.isMobile);
    await expect(page).toHaveURL(/busca=golden/);
    await expect(page.getByRole("heading", { name: "Golden Beat #207" })).toBeVisible();

    // Refresh mantém o estado.
    const urlBeforeReload = page.url();
    await page.reload();
    await expect(page).toHaveURL(urlBeforeReload);
    await expect(page.getByRole("heading", { name: "Golden Beat #207" })).toBeVisible();

    // Histórico: voltar desfaz a busca, avançar refaz.
    await page.goBack();
    await expect(page).not.toHaveURL(/busca=/);
    await expect(page).toHaveURL(/ordem=price-asc/);
    await page.goForward();
    await expect(page).toHaveURL(/busca=golden/);

    // Acesso direto a uma página do catálogo reproduz os mesmos resultados.
    await page.goto("/?pagina=2");
    await expect(page.getByText(/NFTs · página 2 de \d+/)).toBeVisible();
    expect(await cardNames(page)).toEqual(page2);
  });

  test("resultado vazio oferece limpar filtros", async ({ page, app }) => {
    await app.goto("/?busca=inexistente-xyz");
    await expect(page.getByRole("heading", { name: "Nenhum NFT encontrado" })).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).last().click();
    await expect(cards(page)).toHaveCount(9);
  });

  test("respostas fora de ordem não sobrescrevem a consulta mais recente", async ({ page, app }) => {
    await app.goto("/");
    await expect(cards(page)).toHaveCount(9);
    // A próxima listagem demora 2,5 s; a seguinte responde rápido.
    await app.mock((m) => m.failNext({ method: "GET", path: "/api/v1/nfts", exact: true, delayMs: 2500 }));
    await search(page, "golden", app.isMobile);
    await search(page, "baron", app.isMobile);
    await expect(page.getByRole("heading", { name: "Ivory Baron #088" })).toBeVisible();
    // Depois que a resposta lenta (antiga) chega, a tela continua mostrando "baron".
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/busca=baron/);
    await expect(page.getByRole("heading", { name: /Golden/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Ivory Baron #088" })).toBeVisible();
  });

  test("parâmetros inválidos na URL são descartados sem quebrar a página", async ({ page, app }) => {
    await app.goto("/?categoria=foo,musica&ordem=xyz&pagina=-3&min=abc");
    await expect(cards(page).first()).toBeVisible();
    const parsed = await cards(page).count();
    expect(parsed).toBeGreaterThan(0);
  });
});
