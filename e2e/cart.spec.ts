import type { Page } from "@playwright/test";
import { CART_THREE_ITEMS, expect, fillLogin, test } from "./fixtures";

const summary = (page: Page) => ({
  subtotal: page.getByTestId("summary-subtotal"),
  discount: page.getByTestId("summary-discount"),
  fee: page.getByTestId("summary-fee"),
  total: page.getByTestId("summary-total"),
});

const item = (page: Page, name: string) => page.getByTestId("cart-item").filter({ hasText: name });

test.describe("Carrinho", () => {
  test("quantidades, remoção, cupom, resumo coerente e persistência após refresh e login", async ({ page, app }) => {
    await app.goto("/");
    await app.addToCartViaApi(CART_THREE_ITEMS);
    await page.goto("/carrinho");

    const s = summary(page);
    await expect(s.subtotal).toHaveText("26.83 ETH");
    await expect(s.discount).toHaveText("(-) 00.00");
    await expect(s.fee).toHaveText("0.016 ETH");
    await expect(s.total).toHaveText("26.846 ETH");

    // Alterar quantidade
    await item(page, "Emerald Ape #042").getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(item(page, "Emerald Ape #042").locator("output")).toHaveText("3");
    await expect(s.subtotal).toHaveText("28.02 ETH");
    await expect(s.total).toHaveText("28.036 ETH");

    // Remover
    await page.getByRole("button", { name: "Remover Violet Nomad #314 do carrinho" }).click();
    await expect(item(page, "Violet Nomad #314")).toHaveCount(0);
    await expect(s.subtotal).toHaveText("19.68 ETH");

    // Cupom inválido, expirado e válido
    const coupon = page.getByRole("textbox", { name: "Código promocional" });
    const apply = page.getByRole("button", { name: "Aplicar" });
    await coupon.fill("XYZ");
    await apply.click();
    await expect(page.getByRole("alert").filter({ hasText: "Código promocional inválido" })).toBeVisible();
    await expect(coupon).toHaveAttribute("aria-invalid", "true");
    await coupon.fill("VERAO25");
    await apply.click();
    await expect(page.getByRole("alert").filter({ hasText: "Este código promocional expirou" })).toBeVisible();
    await coupon.fill("KURIO10");
    await apply.click();
    await expect(page.getByTestId("coupon-applied")).toContainText("KURIO10");
    await expect(s.discount).toHaveText("(-) 1.968 ETH");
    await expect(s.total).toHaveText("17.728 ETH");
    await page.getByRole("button", { name: "Remover código promocional KURIO10" }).click();
    await expect(s.discount).toHaveText("(-) 00.00");

    // Persistência após refresh
    await page.reload();
    await expect(item(page, "Emerald Ape #042").locator("output")).toHaveText("3");
    await expect(page.getByTestId("cart-item")).toHaveCount(2);

    // Itens do visitante são preservados ao autenticar.
    await page.getByRole("button", { name: "Conectar e finalizar" }).click();
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/);
    await fillLogin(page);
    await expect(page).toHaveURL(/\/pagamento$/);
    await page.goto("/carrinho");
    await expect(item(page, "Emerald Ape #042").locator("output")).toHaveText("3");
    await expect(item(page, "Ivory Baron #088").locator("output")).toHaveText("9");
    const owner = await app.mock((m) => m.state().carts.find((c) => c.ownerId === "usr_nova")?.items.length);
    expect(owner).toBe(2);
  });

  test("adicionar respeita a disponibilidade da edição", async ({ page, app }) => {
    await app.goto("/");
    await app.mock((m) => m.setAvailability("emerald-ape-042", "1-50", 2));
    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 2 }]);
    await page.goto("/carrinho");
    await expect(item(page, "Emerald Ape #042").getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
  });

  test("carrinho vazio", async ({ page, app }) => {
    await app.goto("/carrinho");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
  });
});
