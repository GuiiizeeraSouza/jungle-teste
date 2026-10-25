import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** Botão de favorito do NFT principal da página de detalhe. */
function favoriteButton(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole("button", { name: /^(Favoritar|Remover) Emerald Ape #042( dos favoritos)?$/ }).first()
    : page.getByRole("button", { name: /^Favorit(ar|ado)$/ });
}

test.describe("Favoritos", () => {
  test("atualização otimista com rollback em falha e persistência após recuperação", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await page.goto("/nft/emerald-ape-042");
    const button = favoriteButton(page, app.isMobile);
    await expect(button).toHaveAttribute("aria-pressed", "false");

    // A API falha (500) depois de 800 ms: a UI muda na hora e volta ao estado anterior.
    await app.mock((m) => m.failNext({ method: "PUT", path: "/api/v1/favorites", status: 500, delayMs: 800 }));
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Favoritos não atualizados")).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");

    // Nova tentativa funciona e persiste após refresh.
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("live-polite")).toContainText("Emerald Ape #042 adicionado aos favoritos.");
    await page.reload();
    await expect(favoriteButton(page, app.isMobile)).toHaveAttribute("aria-pressed", "true");
    expect(await app.mock((m) => m.state().favorites.usr_nova)).toContain("emerald-ape-042");

    await page.goto("/perfil/lista-de-interesse");
    await expect(page.getByTestId("favorites-list").getByRole("heading", { name: "Emerald Ape #042" })).toBeVisible();
  });

  test("visitante é levado ao login ao favoritar", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042");
    await favoriteButton(page, app.isMobile).click();
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Femerald-ape-042/);
  });
});
