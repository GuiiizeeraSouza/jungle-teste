import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function prepare(page: Page, app: import("./fixtures").AppFixture, quantity = 2) {
  await app.goto("/");
  await app.loginViaApi("nova");
  await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity }]);
  await page.goto("/pagamento");
}

async function openReview(page: Page) {
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  const dialog = page.getByTestId("review-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

const ordersCount = (app: import("./fixtures").AppFixture) => app.mock((m) => m.state().orders.length);

test.describe("Compra", () => {
  test("compra completa do catálogo ao recibo confirmado", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await page.reload();

    await page.getByRole("link", { name: "Emerald Ape #042", exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Emerald Ape #042" })).toBeVisible();
    await page.getByTestId("buy-button").click();
    await expect(page).toHaveURL(/\/carrinho$/);
    await expect(page.getByTestId("summary-total")).toHaveText("1.206 ETH");
    await page.getByRole("button", { name: "Conectar e finalizar" }).click();
    await expect(page).toHaveURL(/\/pagamento$/);

    const dialog = await openReview(page);
    await expect(dialog.getByTestId("summary-total")).toHaveText("1.206 ETH");
    await expect(page.getByTestId("wallet-connected")).toContainText("MetaMask");
    await dialog.getByTestId("confirm-order").click();

    await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/);
    await expect(page.getByTestId("order-pending")).toBeVisible();
    // Confirmação chega pelo Socket.IO (order.updated).
    await expect(page.getByTestId("order-confirmed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("receipt-line")).toHaveCount(1);
    await expect(page.getByTestId("receipt-total")).toHaveText("1.206 ETH");
    await expect(page.getByTestId("order-tx")).toHaveText(/^0x/);
    await expect(page.getByRole("link", { name: /Ver no Etherscan/ })).toHaveAttribute("href", /etherscan\.io\/tx\/0x/);

    // Apenas os itens comprados saem do carrinho.
    expect(await app.mock((m) => m.state().carts.find((c) => c.ownerId === "usr_nova")?.items.length)).toBe(0);
    expect(await ordersCount(app)).toBe(1);

    // O recibo é um snapshot: mudanças posteriores no catálogo não o alteram.
    await app.mock((m) => m.setPrice("emerald-ape-042", "1-50", "3.33"));
    await page.reload();
    await expect(page.getByTestId("receipt-total")).toHaveText("1.206 ETH");
  });
});

test.describe("Compra — cenários de falha", () => {
  test.describe("pagamento recusado", () => {
    test.use({ scenario: "payment-declined" });
    test("exibe recusa e mantém o carrinho", async ({ page, app }) => {
      await prepare(page, app);
      const dialog = await openReview(page);
      await dialog.getByTestId("confirm-order").click();
      await expect(page.getByTestId("order-rejected")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "Pagamento recusado" })).toBeVisible();
      await expect(page.getByTestId("order-confirmed")).toHaveCount(0);
      expect(await app.mock((m) => m.state().carts.find((c) => c.ownerId === "usr_nova")?.items[0]?.quantity)).toBe(2);
      // Estado terminal: reabrir não muda o resultado.
      await page.reload();
      await expect(page.getByTestId("order-rejected")).toBeVisible();
    });
  });

  test.describe("cliques repetidos", () => {
    test.use({ scenario: "manual-orders" });
    test("não criam pedidos duplicados", async ({ page, app }) => {
      await prepare(page, app);
      const dialog = await openReview(page);
      await dialog.getByTestId("confirm-order").dblclick();
      await expect(page).toHaveURL(/\/pedidos\//);
      await expect(page.getByTestId("order-pending")).toBeVisible();
      expect(await ordersCount(app)).toBe(1);
    });
  });

  test.describe("timeout após criação", () => {
    test.use({ scenario: "order-timeout" });
    test("nova tentativa recupera o mesmo pedido pela chave de idempotência", async ({ page, app }) => {
      await prepare(page, app);
      const dialog = await openReview(page);
      await dialog.getByTestId("confirm-order").click();
      await expect(dialog.getByTestId("order-timeout")).toBeVisible({ timeout: 20_000 });
      // O pedido já existe no servidor, mas o cliente não recebeu a resposta.
      expect(await ordersCount(app)).toBe(1);
      await dialog.getByRole("button", { name: "Tentar novamente" }).click();
      await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/);
      const orderId = page.url().split("/").pop();
      expect(await ordersCount(app)).toBe(1);
      expect(await app.mock((m) => m.latestOrderId())).toBe(orderId);
      await expect(page.getByTestId("order-confirmed")).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe("carteira recusa a conexão", () => {
    test.use({ scenario: "wallet-reject" });
    test("informa a recusa sem abrir a revisão", async ({ page, app }) => {
      await prepare(page, app);
      await page.getByRole("button", { name: "Confirmar compra" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "A conexão foi recusada na carteira" })).toBeVisible();
      await expect(page.getByTestId("review-dialog")).toHaveCount(0);
    });
  });

  test("carteira desconectada antes da confirmação exige reconexão", async ({ page, app }) => {
    await prepare(page, app);
    let dialog = await openReview(page);
    await app.mock((m) => m.disconnectWallets());
    await dialog.getByTestId("confirm-order").click();
    await expect(page.getByRole("alert").filter({ hasText: "A carteira foi desconectada" })).toBeVisible();
    await expect(page.getByTestId("wallet-connected")).toHaveCount(0);
    dialog = await openReview(page);
    await dialog.getByTestId("confirm-order").click();
    await expect(page).toHaveURL(/\/pedidos\//);
  });

  test.describe("preço alterado na confirmação", () => {
    test.use({ scenario: "price-change-checkout" });
    test("exige nova confirmação com os valores atualizados", async ({ page, app }) => {
      await prepare(page, app);
      const dialog = await openReview(page);
      await expect(dialog.getByTestId("summary-total")).toHaveText("2.396 ETH");
      await dialog.getByTestId("confirm-order").click();
      await expect(dialog.getByTestId("quote-changed")).toBeVisible();
      await expect(dialog.getByTestId("confirm-order")).toBeDisabled();
      expect(await ordersCount(app)).toBe(0);
      await dialog.getByRole("button", { name: "Revisar novos valores" }).click();
      await expect(dialog.getByTestId("summary-total")).toHaveText("2.596 ETH");
      await dialog.getByTestId("confirm-order").click();
      await expect(page).toHaveURL(/\/pedidos\//);
      await expect(page.getByTestId("order-confirmed")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("receipt-total")).toHaveText("2.596 ETH");
    });
  });

  test.describe("edição esgotada na confirmação", () => {
    test.use({ scenario: "sold-out-checkout" });
    test("bloqueia a compra e orienta a ajustar o carrinho", async ({ page, app }) => {
      await prepare(page, app);
      const dialog = await openReview(page);
      await dialog.getByTestId("confirm-order").click();
      await expect(dialog.getByText(/esgotou/).first()).toBeVisible();
      await expect(dialog.getByTestId("confirm-order")).toBeDisabled();
      expect(await ordersCount(app)).toBe(0);
    });
  });

  test("validação dos campos do pagamento", async ({ page, app }) => {
    await prepare(page, app);
    if (app.isMobile) await page.getByRole("button", { name: "Dados do colecionador" }).click();
    const address = page.getByRole("textbox", { name: "Endereço da carteira" });
    await address.fill("0x123");
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("invalido");
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByText("Revise os campos destacados antes de continuar.")).toBeVisible();
    await expect(address).toHaveAttribute("aria-invalid", "true");
    await expect(address).toHaveAccessibleDescription("Endereço inválido: use 0x seguido de 40 caracteres hexadecimais");
    await expect(page.getByTestId("review-dialog")).toHaveCount(0);
  });
});
