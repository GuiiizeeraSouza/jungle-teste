import { expect, fillLogin, logout, test } from "./fixtures";

// PNG 1×1 válido.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.describe("Perfil do colecionador", () => {
  test.beforeEach(async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();
  });

  test("edição de dados com validação, conflito da API e persistência", async ({ page }) => {
    const displayName = page.getByRole("textbox", { name: "Nome de exibição" });
    const save = page.getByRole("button", { name: "Salvar", exact: true });

    await displayName.fill("");
    await save.click();
    await expect(displayName).toHaveAttribute("aria-invalid", "true");
    await expect(displayName).toHaveAccessibleDescription("Informe o nome de exibição");

    await displayName.fill("Nova S.");
    await page.getByRole("textbox", { name: "Nome de usuário" }).fill("leo.prado");
    await save.click();
    await expect(page.getByText("Este nome de usuário já está em uso")).toBeVisible();

    await page.getByRole("textbox", { name: "Nome de usuário" }).fill("nova.sato");
    await save.click();
    await expect(page.getByText("Perfil atualizado com sucesso.").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Nome de exibição" })).toHaveValue("Nova S.");
  });

  test("avatar: envio, validação de formato e remoção", async ({ page }) => {
    await page.getByTestId("avatar-input").setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(page.getByRole("alert").filter({ hasText: "Use uma imagem PNG, JPEG ou WebP." })).toBeVisible();

    await page.getByTestId("avatar-input").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("img", { name: "Avatar de Nova Sato" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("img", { name: "Avatar de Nova Sato" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Remover" }).click();
    await expect(page.getByRole("img", { name: "Avatar de Nova Sato" })).toHaveCount(0);
  });

  test("alteração de senha com erros de validação e da API", async ({ page, app }) => {
    const current = page.getByLabel("Senha atual");
    const next = page.getByLabel("Nova senha", { exact: true });
    const confirm = page.getByLabel("Confirmar nova senha");
    const save = page.getByRole("button", { name: "Salvar", exact: true });

    await current.fill("Kurio2026");
    await next.fill("curta");
    await confirm.fill("outra");
    await save.click();
    await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres")).toBeVisible();
    await expect(page.getByText("As senhas não coincidem")).toBeVisible();

    await current.fill("errada123");
    await next.fill("NovaSenha42");
    await confirm.fill("NovaSenha42");
    await save.click();
    await expect(page.getByText("Senha atual incorreta")).toBeVisible();

    await current.fill("Kurio2026");
    await save.click();
    await expect(page.getByText("Senha alterada com sucesso.").first()).toBeVisible();

    // A nova senha passa a valer; a antiga não.
    await page.goto("/");
    await logout(page, app.isMobile);
    await page.goto("/entrar");
    await fillLogin(page);
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
    await page.getByPlaceholder("Senha").fill("NovaSenha42");
    await page.getByRole("form", { name: "Entrar" }).getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Carteiras", () => {
  test("cadastro e edição das carteiras principal e secundária com validação", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("leo");
    await page.goto("/perfil/carteiras");
    const primary = page.getByRole("region", { name: "Carteira principal" });
    const address = primary.getByRole("textbox", { name: "Endereço da carteira" });
    const save = primary.getByRole("button", { name: "Salvar carteira" });

    await address.fill("0x123");
    await save.click();
    await expect(address).toHaveAttribute("aria-invalid", "true");
    await expect(address).toHaveAccessibleDescription("Endereço inválido: use 0x seguido de 40 caracteres hexadecimais");

    await address.fill("0x9b2C4d6E8f0A1B3c5D7e9F1a2B4c6D8e0F1a2B3c");
    await primary.getByRole("textbox", { name: "Apelido da carteira" }).fill("Cofre");
    await save.click();
    await expect(page.getByText("Carteira principal salva").first()).toBeVisible();

    // Secundária igual à principal
    const secondary = page.getByRole("region", { name: "Carteira secundária" });
    await expect(secondary.getByTestId("secondary-status")).toHaveText("Você ainda não adicionou uma carteira secundária.");
    await secondary.getByRole("radio", { name: "Igual à carteira principal" }).click();
    await expect(secondary.getByTestId("secondary-status")).toHaveText("Usando os mesmos dados da carteira principal.");

    await page.reload();
    await expect(
      page.getByRole("region", { name: "Carteira principal" }).getByRole("textbox", { name: "Apelido da carteira" }),
    ).toHaveValue("Cofre");
    await expect(page.getByTestId("secondary-status")).toHaveText("Usando os mesmos dados da carteira principal.");

    // As carteiras cadastradas aparecem no pagamento.
    await app.addToCartViaApi([{ nftId: "golden-beat-207", quantity: 1 }]);
    await page.goto("/pagamento");
    await expect(page.getByTestId("wallet-primary")).toBeVisible();
  });
});
