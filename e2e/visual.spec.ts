import path from "node:path";
import type { Page } from "@playwright/test";
import { CART_THREE_ITEMS, expect, test } from "./fixtures";

/**
 * Regressão visual com dados determinísticos (cenário padrão dos mocks).
 * Baselines versionadas em e2e/__screenshots__/<projeto>/.
 */
async function stabilize(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Carrega imagens lazy rolando a página; depois volta ao topo.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  // Só imagens renderizadas (com área); imagens em elementos ocultos não carregam (lazy).
  await page.waitForFunction(() =>
    [...document.images].filter((img) => img.getBoundingClientRect().width > 0).every((img) => img.complete && img.naturalWidth > 0),
  );
  // Após rolar, o Chromium rasteriza imagens com filtro de baixa qualidade e só
  // depois troca para alta qualidade: espera o repaint assentar.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(1500);
}

const shot = {
  fullPage: true,
  animations: "disabled" as const,
  caret: "hide" as const,
  stylePath: path.join(__dirname, "visual.css"),
  timeout: 20_000,
};

// DPR 1: capturas de página inteira em DPR 2 (>12 000 px de altura no mobile) fazem o
// Chromium redecodificar imagens entre capturas, o que torna a comparação instável.
test.use({ deviceScaleFactor: 1 });

test.describe("Regressão visual", () => {
  test("início", async ({ page, app }) => {
    await app.goto("/");
    await expect(page.getByTestId("nft-card")).toHaveCount(9);
    await stabilize(page);
    await expect(page).toHaveScreenshot("inicio.png", shot);
  });

  test("detalhe do NFT", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042");
    await expect(page.getByRole("heading", { level: 1, name: "Emerald Ape #042" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Mais desta coleção" }).getByTestId("nft-card").first()).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot("detalhe.png", shot);
  });

  test("carrinho", async ({ page, app }) => {
    await app.goto("/");
    await app.addToCartViaApi(CART_THREE_ITEMS);
    await page.goto("/carrinho");
    await expect(page.getByTestId("summary-total")).toHaveText("26.846 ETH");
    await stabilize(page);
    await expect(page).toHaveScreenshot("carrinho.png", shot);
  });

  test("pagamento", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await app.addToCartViaApi(CART_THREE_ITEMS);
    await page.goto("/pagamento");
    if (app.isMobile) {
      await expect(page.getByTestId("checkout-total")).toHaveText("26.846 ETH");
    } else {
      await expect(page.getByTestId("summary-total")).toHaveText("26.846 ETH");
    }
    await stabilize(page);
    await expect(page).toHaveScreenshot("pagamento.png", shot);
  });
});
