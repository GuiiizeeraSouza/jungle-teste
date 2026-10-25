import { expect, test } from "./fixtures";

test.describe("Carregamento lento", () => {
  test.use({ scenario: "slow" });

  test("skeletons com shimmer no catálogo, detalhe e resumo do carrinho", async ({ page, app }) => {
    await app.goto("/");
    await expect(page.getByTestId("catalog-skeleton")).toBeVisible();
    await expect(page.getByTestId("nft-card").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("catalog-skeleton")).toHaveCount(0);

    await page.goto("/nft/emerald-ape-042");
    await expect(page.getByTestId("detail-skeleton")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Emerald Ape #042" })).toBeVisible({ timeout: 15_000 });

    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 1 }]);
    await page.goto("/carrinho");
    await expect(page.getByTestId("cart-skeleton")).toBeVisible();
    await expect(page.getByTestId("summary-total")).toBeVisible({ timeout: 15_000 });
  });

  test("respeita a preferência por movimento reduzido", async ({ page, app }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.goto("/");
    const skeleton = page.getByTestId("catalog-skeleton").locator("[data-slot=skeleton]").first();
    await expect(skeleton).toBeVisible();
    const shimmer = await skeleton.evaluate((el) => getComputedStyle(el, "::after").display);
    expect(shimmer).toBe("none");
  });
});

test.describe("Falhas e recuperação", () => {
  test.describe("erro 500", () => {
    test.use({ scenario: "server-error" });
    test("exibe feedback de erro e recupera após nova tentativa", async ({ page, app }) => {
      await app.goto("/");
      await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar" })).toBeVisible({ timeout: 15_000 });
      await app.mock((m) => m.setScenario("default"));
      await page.getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page.getByTestId("nft-card").first()).toBeVisible();
    });
  });

  test.describe("sem conexão", () => {
    test.use({ scenario: "offline" });
    test("informa a indisponibilidade de rede e recupera", async ({ page, app }) => {
      await app.goto("/nft/emerald-ape-042");
      await expect(page.getByRole("alert").filter({ hasText: "Sem conexão com o servidor" })).toBeVisible({ timeout: 15_000 });
      await app.mock((m) => m.setScenario("default"));
      await page.getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Emerald Ape #042" })).toBeVisible();
    });
  });

  test.describe("falha transitória", () => {
    test.use({ scenario: "flaky" });
    test("consultas repetem automaticamente após 503", async ({ page, app }) => {
      await app.goto("/");
      await expect(page.getByTestId("nft-card").first()).toBeVisible({ timeout: 15_000 });
    });
  });

  test("falha de mutation no carrinho mostra erro e mantém o estado", async ({ page, app }) => {
    await app.goto("/");
    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 1 }]);
    await page.goto("/carrinho");
    await expect(page.getByTestId("summary-total")).toHaveText("1.206 ETH");
    await app.mock((m) => m.failNext({ method: "PATCH", path: "/api/v1/cart/items", status: 503 }));
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(page.getByText("Não foi possível alterar a quantidade")).toBeVisible();
    await expect(page.getByTestId("cart-item").locator("output")).toHaveText("1");
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(page.getByTestId("cart-item").locator("output")).toHaveText("2");
  });
});
