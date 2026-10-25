import type { Page } from "@playwright/test";
import { USERS, expect, fillLogin, logout, test } from "./fixtures";

async function expectLoggedIn(page: Page, name: string, isMobile: boolean) {
  if (isMobile) {
    await page.goto("/perfil");
    await expect(page.getByRole("textbox", { name: "Nome de exibição" })).toHaveValue(name);
  } else {
    await expect(page.getByRole("button", { name: `Menu da conta de ${name}` })).toBeVisible();
  }
}

test.describe("Cadastro e login", () => {
  test("cadastro valida campos, trata conflito e cria a sessão", async ({ page, app }) => {
    await app.goto("/cadastro");
    const form = page.getByRole("form", { name: "Criar conta" });
    const submit = form.getByRole("button", { name: /Criar (conta|perfil)/ });

    await submit.click();
    await expect(form.getByText("Use pelo menos 3 caracteres")).toBeVisible();
    await expect(form.getByText("Informe seu e-mail")).toBeVisible();
    await expect(form.getByText("A senha precisa ter pelo menos 8 caracteres")).toBeVisible();
    const username = form.getByPlaceholder("Nome de usuário");
    await expect(username).toHaveAttribute("aria-invalid", "true");
    await expect(username).toHaveAccessibleDescription("Use pelo menos 3 caracteres");

    await username.fill("nova.sato");
    await form.getByPlaceholder("Digite seu e-mail").fill(USERS.nova.email);
    await form.getByPlaceholder("Senha", { exact: true }).fill("Kurio2026");
    await form.getByPlaceholder("Confirmar senha").fill("Kurio2027");
    await submit.click();
    await expect(form.getByText("As senhas não coincidem")).toBeVisible();

    await form.getByPlaceholder("Confirmar senha").fill("Kurio2026");
    await submit.click();
    // Conflito retornado pela API, associado aos campos.
    await expect(form.getByText("Este e-mail já está cadastrado")).toBeVisible();
    await expect(form.getByText("Este nome de usuário já está em uso")).toBeVisible();

    await username.fill("colecionador.e2e");
    await form.getByPlaceholder("Digite seu e-mail").fill("e2e@kurio.test");
    await submit.click();
    await expect(page).toHaveURL(/\/$/);
    await expectLoggedIn(page, "colecionador.e2e", app.isMobile);

    // A sessão é recuperada após refresh.
    await page.reload();
    await expectLoggedIn(page, "colecionador.e2e", app.isMobile);
  });

  test("login com credenciais inválidas exibe erro acessível", async ({ page, app }) => {
    await app.goto("/entrar");
    await page.getByPlaceholder("contato@email.com").fill(USERS.nova.email);
    await page.getByPlaceholder("Senha").fill("senha-errada1");
    await page.getByRole("form", { name: "Entrar" }).getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
  });

  test("login retorna ao fluxo anterior", async ({ page, app }) => {
    await app.goto("/perfil/carteiras");
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/);
    await fillLogin(page);
    await expect(page).toHaveURL(/\/perfil\/carteiras$/);
    await expect(page.getByRole("heading", { name: "Carteira principal" })).toBeVisible();
  });
});

test.describe("Sessão", () => {
  test("expiração durante a navegação é detectada no horário de expiração", async ({ page, app }) => {
    await page.clock.install();
    await app.goto("/");
    await app.loginViaApi("nova");
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: "Perfil do colecionador" })).toBeVisible();

    // Avança o relógio além do TTL da sessão (2 h): o app revalida e a API responde 401.
    await page.clock.fastForward("02:00:05");
    const dialog = page.getByRole("dialog", { name: "Sua sessão expirou" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Entrar novamente" }).click();
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil&motivo=expirada/);
    await expect(page.getByText("Sua sessão expirou. Entre novamente para continuar de onde parou.")).toBeVisible();
    await fillLogin(page);
    await expect(page).toHaveURL(/\/perfil$/);
  });

  test("expiração durante o checkout preserva o contexto para retomada", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await app.addToCartViaApi([{ nftId: "emerald-ape-042", quantity: 2 }]);
    await page.goto("/pagamento");
    if (app.isMobile) await page.getByRole("button", { name: "Dados do colecionador" }).click();
    const note = page.getByRole("textbox", { name: "Observação do colecionador (opcional)" });
    await note.fill("Presente para a Ana");

    await app.mock((m) => m.expireSessions());
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    const dialog = page.getByRole("dialog", { name: "Sua sessão expirou" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Entrar novamente" }).click();
    await expect(page).toHaveURL(/redirect=%2Fpagamento/);
    await fillLogin(page);

    await expect(page).toHaveURL(/\/pagamento$/);
    if (app.isMobile) await page.getByRole("button", { name: "Dados do colecionador" }).click();
    await expect(page.getByRole("textbox", { name: "Observação do colecionador (opcional)" })).toHaveValue("Presente para a Ana");
    const items = await app.mock((m) => m.state().carts.find((c) => c.ownerId === "usr_nova")?.items.length);
    expect(items).toBe(1);
  });

  test("logout e troca de usuário limpam dados privados da sessão anterior", async ({ page, app }) => {
    await app.goto("/");
    await app.loginViaApi("nova");
    await app.addToCartViaApi([{ nftId: "ivory-baron-088", quantity: 1 }]);
    await page.goto("/perfil/lista-de-interesse");
    const list = page.getByTestId("favorites-list");
    await expect(list.getByRole("heading", { name: "Sage Nomad #009" })).toBeVisible();

    await page.goto("/");
    await logout(page, app.isMobile);
    await expect(page).toHaveURL(/\/$/);
    if (!app.isMobile) await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Carrinho, 0 itens/ }).first()).toBeAttached();

    await page.goto("/entrar");
    await fillLogin(page, "leo");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/perfil/lista-de-interesse");
    await expect(page.getByRole("heading", { name: "Sua lista de interesse está vazia" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sage Nomad #009" })).toHaveCount(0);

    await page.goto("/carrinho");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();

    // Nenhum dado privado da sessão anterior permanece no armazenamento do app.
    const leftovers = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes("usr_nova")));
    expect(leftovers).toEqual([]);
  });
});
