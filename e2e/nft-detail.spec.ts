import { expect, test } from "./fixtures";

test.describe("Detalhe do NFT", () => {
  test("acesso direto exibe galeria, informações e preço", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042");
    await expect(page.getByRole("heading", { level: 1, name: "Emerald Ape #042" })).toBeVisible();
    await expect(page.getByText("1.19 ETH").first()).toBeVisible();
    await expect(page.getByText("ID do token: #0042")).toBeVisible();
    await expect(page.getByText("Coleção: Kurio Apes")).toBeVisible();
    await expect(page.getByRole("img", { name: /Macaco de pelo castanho/ }).first()).toBeVisible();
    if (!app.isMobile) {
      await expect(page.getByRole("tab", { name: /Ver imagem 1 de 4/ })).toHaveAttribute("aria-selected", "true");
      await page.getByRole("tab", { name: /Ver imagem 2 de 4/ }).click();
      await expect(page.getByRole("tab", { name: /Ver imagem 2 de 4/ })).toHaveAttribute("aria-selected", "true");
    }
  });

  test("NFT inexistente mostra estado de não encontrado", async ({ page, app }) => {
    await app.goto("/nft/nao-existe-123");
    await expect(page.getByRole("heading", { name: "NFT não encontrado" })).toBeVisible();
    await page.getByRole("link", { name: "Explorar o catálogo" }).click();
    await expect(page).toHaveURL(/\/#catalogo$|\/$/);
  });

  test("rota inexistente mostra 404", async ({ page, app }) => {
    await app.goto("/rota/que/nao/existe");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("edição indisponível bloqueia a compra", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042?edicao=1-1");
    await expect(page.getByRole("radio", { name: /1\/1.*esgotada/ })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("alert").filter({ hasText: "Edição esgotada" })).toBeVisible();
    await expect(page.getByTestId("buy-button")).toBeDisabled();
  });

  test("quantidade respeita o limite por pedido e o que já está no carrinho", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042");
    await page.getByRole("radio", { name: /^1\/10/ }).click();
    await expect(page).toHaveURL(/edicao=1-10/);
    const increase = page.getByRole("button", { name: "Aumentar quantidade" });
    for (let i = 0; i < 6; i++) if (await increase.isEnabled()) await increase.click();
    // 6 disponíveis, máximo de 5 por pedido.
    await expect(page.getByRole("group", { name: "Quantidade" }).locator("output")).toHaveText("5");
    await expect(increase).toBeDisabled();
    await page.getByTestId("buy-button").click();
    await expect(page).toHaveURL(/\/carrinho$/);
    await page.goBack();
    await expect(page.getByRole("alert").filter({ hasText: "Você já tem o máximo desta edição no carrinho" })).toBeVisible();
    await expect(page.getByTestId("buy-button")).toBeDisabled();
  });
});
