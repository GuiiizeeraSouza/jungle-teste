import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";

/** Foco visível: contorno (outline) ou anel (box-shadow). */
async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const style = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow };
  });
  expect(style.outline !== "none" && style.width !== "0px" ? true : style.shadow !== "none").toBe(true);
}

test.describe("Acessibilidade", () => {
  test("link de pular para o conteúdo e navegação por teclado", async ({ page, app }) => {
    await app.goto("/");
    await page.getByTestId("nft-card").first().waitFor();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expectVisibleFocus(skip);
    await page.keyboard.press("Enter");
    await expect(page.locator("#conteudo")).toBeFocused();

    if (!app.isMobile) {
      // Navegação principal acessível por teclado.
      const market = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mercado" });
      await market.focus();
      await expectVisibleFocus(market);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#catalogo/);
    }
  });

  test("diálogo/drawer prende o foco e devolve ao gatilho ao fechar", async ({ page, app }) => {
    await app.goto("/");
    await page.getByTestId("nft-card").first().waitFor();
    const trigger = app.isMobile ? page.getByRole("button", { name: "Abrir filtros" }) : page.getByRole("button", { name: "Buscar NFTs" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Tab nunca sai do diálogo.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("erros de formulário são associados aos campos e o foco vai ao primeiro inválido", async ({ page, app }) => {
    await app.goto("/entrar");
    const form = page.getByRole("form", { name: "Entrar" });
    await form.getByRole("button", { name: "Entrar" }).click();
    const email = form.getByPlaceholder("contato@email.com");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Informe seu e-mail");
    await expect(form.getByPlaceholder("Senha")).toHaveAccessibleDescription("Informe sua senha");

    // Corrigir o campo remove o erro (revalidação ao digitar).
    await email.fill("nova@kurio.test");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  test("imagens relevantes têm texto alternativo e controles têm nome acessível", async ({ page, app }) => {
    await app.goto("/nft/emerald-ape-042");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const unnamed = await page.evaluate(() => {
      const issues: string[] = [];
      for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) issues.push(img.src);
      for (const b of document.querySelectorAll("button, a[href]")) {
        const name = (b.getAttribute("aria-label") ?? b.textContent ?? "").trim();
        const hidden = b.closest("[aria-hidden=true]");
        if (!name && !hidden) issues.push(b.outerHTML.slice(0, 80));
      }
      return issues;
    });
    expect(unnamed).toEqual([]);
  });

  test("sem overflow horizontal na largura atual", async ({ page, app }) => {
    for (const path of ["/", "/nft/emerald-ape-042", "/carrinho", "/entrar", "/cadastro"]) {
      await app.goto(path);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(0);
    }
    // Rotas autenticadas
    await app.loginViaApi("nova");
    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 2 }]);
    for (const path of ["/pagamento", "/perfil", "/perfil/carteiras", "/perfil/lista-de-interesse"]) {
      await app.goto(path);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("Acessibilidade — tablet (768 px)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test("telas principais sem overflow horizontal", async ({ page, app }) => {
    for (const path of ["/", "/nft/emerald-ape-042", "/carrinho"]) {
      await app.goto(path);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
