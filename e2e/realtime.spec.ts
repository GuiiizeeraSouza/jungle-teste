import type { Page } from "@playwright/test";
import { expect, fillLogin, logout, test, type AppFixture } from "./fixtures";

/** Garante que o socket.io-client do app está conectado ao servidor simulado. */
async function waitForSocket(app: AppFixture) {
  await expect.poll(() => app.mock((m) => m.connections()), { timeout: 10_000 }).toBeGreaterThan(0);
}

async function placeOrder(page: Page) {
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await page.getByTestId("review-dialog").getByTestId("confirm-order").click();
  await expect(page).toHaveURL(/\/pedidos\/ord_\d+$/);
  await expect(page.getByTestId("order-pending")).toBeVisible();
}

test.describe("Tempo real (Socket.IO)", () => {
  test("nft.updated com o carrinho aberto informa a alteração e atualiza o resumo", async ({ page, app }) => {
    await app.goto("/");
    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 2 }]);
    await page.goto("/carrinho");
    await expect(page.getByTestId("summary-subtotal")).toHaveText("2.38 ETH");
    await waitForSocket(app);

    await app.mock((m) => m.setPrice("emerald-ape-042", "1-50", "1.49"));

    await expect(page.getByTestId("cart-item-notice")).toContainText("Preço alterado de 1.19 ETH para 1.49 ETH");
    await expect(page.getByTestId("summary-subtotal")).toHaveText("2.98 ETH");
    await expect(page.getByTestId("summary-total")).toHaveText("2.996 ETH");
    await expect(page.getByTestId("cart-changes-banner")).toBeVisible();
    await expect(page.getByTestId("live-polite")).toContainText("mudou de 1.19 ETH para 1.49 ETH");

    await page.getByRole("button", { name: "Entendi" }).click();
    await expect(page.getByTestId("cart-item-notice")).toHaveCount(0);

    // Disponibilidade abaixo da quantidade bloqueia a finalização.
    await app.mock((m) => m.setAvailability("emerald-ape-042", "1-50", 1));
    await expect(page.getByTestId("cart-item-notice")).toContainText("Restam apenas 1");
    await expect(page.getByRole("button", { name: "Conectar e finalizar" })).toBeDisabled();
  });

  test("checkout impede confirmar com cotação desatualizada", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 2 }]);
    await page.goto("/pagamento");
    await waitForSocket(app);

    await page.getByRole("button", { name: "Confirmar compra" }).click();
    const dialog = page.getByTestId("review-dialog");
    await expect(dialog.getByTestId("summary-total")).toHaveText("2.396 ETH");

    await app.mock((m) => m.setPrice("emerald-ape-042", "1-50", "1.49"));

    await expect(dialog.getByTestId("quote-changed")).toBeVisible();
    await expect(dialog.getByTestId("quote-changed")).toContainText("Total: 2.396 ETH → 2.996 ETH");
    await expect(dialog.getByTestId("confirm-order")).toBeDisabled();
    await dialog.getByRole("button", { name: "Revisar novos valores" }).click();
    await expect(dialog.getByTestId("confirm-order")).toBeEnabled();
    await expect(dialog.getByTestId("confirm-order")).toHaveText(/2\.996 ETH/);
    await dialog.getByTestId("confirm-order").click();
    await expect(page.getByTestId("order-confirmed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("receipt-total")).toHaveText("2.996 ETH");
  });

  test("eventos duplicados ou antigos não regridem o estado nem reaplicam efeitos", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042");
    await expect(page.getByTestId("detail-price")).toContainText("1.19 ETH");
    await waitForSocket(app);

    await app.mock((m) => m.setPrice("emerald-ape-042", "1-50", "1.29"));
    await expect(page.getByTestId("detail-price")).toContainText("1.29 ETH");
    const firstEventId = await app.mock(
      (m) =>
        m
          .events()
          .filter((e) => e.type === "nft.updated")
          .at(-1)!.id,
    );

    await app.mock((m) => m.setPrice("emerald-ape-042", "1-50", "1.39"));
    await expect(page.getByTestId("detail-price")).toContainText("1.39 ETH");
    await expect(page.getByTestId("live-price-change")).toHaveText("Preço atualizado agora: de 1.29 ETH para 1.39 ETH");

    // Duplicata do 1º evento (mesmo id, versão menor) e evento antigo com outro preço.
    expect(await app.mock((m, id) => m.replayEvent(id), firstEventId)).toBe(true);
    await app.mock((m) => m.emitStaleNftEvent("emerald-ape-042", "9.99"));
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("detail-price")).toContainText("1.39 ETH");
    await expect(page.getByText("9.99 ETH")).toHaveCount(0);
    await expect(page.getByTestId("live-price-change")).toHaveText("Preço atualizado agora: de 1.29 ETH para 1.39 ETH");
  });

  test.describe("pedido pendente", () => {
    test.use({ scenario: "manual-orders" });

    test("desconexão: a confirmação perdida é reconciliada via REST ao reconectar", async ({ page, app }) => {
      await app.goto("/");
      await app.loginViaApi("nova");
      await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 1 }]);
      await page.goto("/pagamento");
      await placeOrder(page);
      await waitForSocket(app);

      // Derruba o socket e confirma o pedido enquanto o cliente está offline (evento perdido).
      await app.mock((m) => m.disconnectRealtime(3000));
      await expect.poll(() => app.mock((m) => m.connections())).toBe(0);
      await app.mock((m) => m.resolveOrder(m.latestOrderId()!, "confirmed"));

      await expect(page.getByTestId("order-confirmed")).toBeVisible({ timeout: 20_000 });
      expect(await app.mock((m) => m.state().orders.length)).toBe(1);
    });

    test("refresh durante o processamento retoma o mesmo pedido sem criar outra compra", async ({ page, app }) => {
      await app.goto("/");
      await app.loginViaApi("nova");
      await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 1 }]);
      await page.goto("/pagamento");
      await placeOrder(page);
      const orderUrl = page.url();

      await page.reload();
      await expect(page).toHaveURL(orderUrl);
      await expect(page.getByTestId("order-pending")).toBeVisible();

      // Em outra tela, o pedido pendente continua acessível e bloqueia nova compra.
      await page.goto("/pagamento");
      await expect(page.getByText("Você já tem um pedido em processamento")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
      await page.getByTestId("pending-order-banner").getByRole("link", { name: "Acompanhar pedido" }).click();
      await expect(page).toHaveURL(orderUrl);

      await waitForSocket(app);
      await app.mock((m) => m.resolveOrder(m.latestOrderId()!, "confirmed"));
      await expect(page.getByTestId("order-confirmed")).toBeVisible({ timeout: 15_000 });
      // Estados terminais não mudam.
      await app.mock((m) => m.resolveOrder(m.latestOrderId()!, "rejected"));
      await page.reload();
      await expect(page.getByTestId("order-confirmed")).toBeVisible();
      expect(await app.mock((m) => m.state().orders.length)).toBe(1);
    });

    test("eventos de uma sessão anterior não chegam ao novo usuário", async ({ page, app }) => {
      await app.goto("/");
      await app.loginViaApi("nova");
      await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 1 }]);
      await page.goto("/pagamento");
      await placeOrder(page);

      await page.goto("/");
      await logout(page, app.isMobile);
      await page.goto("/entrar");
      await fillLogin(page, "leo");
      await expect(page).toHaveURL(/\/$/);
      await waitForSocket(app);

      await app.mock((m) => m.resolveOrder(m.latestOrderId()!, "confirmed"));
      await page.waitForTimeout(1500);
      await expect(page.getByText("Pedido confirmado")).toHaveCount(0);
      await expect(page.getByTestId("pending-order-banner")).toHaveCount(0);
    });
  });
});
