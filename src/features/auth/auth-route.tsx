"use client";

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/shared/form-field";
import { CatalogSection } from "@/features/catalog/catalog-section";
import { Hero } from "@/features/catalog/hero";
import { useSession } from "@/features/session/use-session";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { AuthSearch } from "@/app-shell/router";
import { LoginForm, RegisterForm, SocialLogin } from "./auth-forms";

type Mode = "login" | "register";

const PRIVATE_ROUTE = /^\/(pagamento|perfil|pedidos)/;

const COPY: Record<Mode, { intro: string; mobileTitle: string }> = {
  login: { intro: "Entre para gerenciar sua carteira, coleção e perfil de criador.", mobileTitle: "Entrar" },
  register: { intro: "Crie seu perfil de colecionador e conecte uma carteira quando quiser.", mobileTitle: "Criar perfil de colecionador" },
};

function useAuthFlow(mode: Mode) {
  const search = useSearch({ strict: false }) as AuthSearch;
  const navigate = useNavigate();
  const target = search.redirect ?? "/";
  return {
    search,
    target,
    done: () => {
      toast.success(mode === "login" ? "Bem-vindo de volta!" : "Conta criada com sucesso!");
      // Retorna ao fluxo anterior (ex.: checkout), substituindo a tela de login no histórico.
      void navigate({ to: target, replace: true });
    },
    // Fechar sem entrar não pode levar de volta a uma rota privada.
    close: () => void navigate({ to: PRIVATE_ROUTE.test(target) ? "/" : target, replace: true }),
  };
}

function ExpiredNotice({ search }: { search: AuthSearch }) {
  if (search.motivo !== "expirada") return null;
  return <FormAlert tone="info" message="Sua sessão expirou. Entre novamente para continuar de onde parou." />;
}

function ModeTabs({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const tab = (active: boolean) => cn("transition-colors hover:text-primary", active ? "text-primary" : "text-foreground");
  return (
    <nav aria-label="Acesso à conta" className="flex items-center justify-center gap-1.5 text-base">
      <Link to="/entrar" search={search} replace aria-current={mode === "login" ? "page" : undefined} className={tab(mode === "login")}>
        Entrar
      </Link>
      <span aria-hidden className="h-4 w-px bg-primary" />
      <Link
        to="/cadastro"
        search={search}
        replace
        aria-current={mode === "register" ? "page" : undefined}
        className={tab(mode === "register")}
      >
        Criar conta
      </Link>
    </nav>
  );
}

function AuthScreen({ mode }: { mode: Mode }) {
  const desktop = useIsDesktop();
  const session = useSession();
  const [alreadyAuthenticated] = useState(() => session.status === "authenticated");
  const flow = useAuthFlow(mode);
  const Form = mode === "login" ? LoginForm : RegisterForm;

  useEffect(() => {
    document.title = `${mode === "login" ? "Entrar" : "Criar conta"} · Kurio`;
  }, [mode]);

  // Só redireciona quem já chegou autenticado; durante o envio, o próprio fluxo navega ao concluir.
  if (alreadyAuthenticated && session.status === "authenticated") return <Navigate to={flow.target} replace />;

  if (!desktop) {
    return (
      <div className="flex min-h-dvh flex-col px-6 pt-24 pb-10">
        <p className="text-center text-4xl font-bold tracking-[0.1em]" aria-hidden>
          KURIO
        </p>
        <h1 className="mt-24 mb-8 text-center text-xl font-bold">{COPY[mode].mobileTitle}</h1>
        <div className="flex flex-col gap-8">
          <ExpiredNotice search={flow.search} />
          <Form size="large" onSuccess={flow.done} />
          <SocialLogin size="large" />
          <p className="text-center text-base text-muted-foreground">
            {mode === "login" ? (
              <>
                Novo na Kurio?{" "}
                <Link to="/cadastro" search={flow.search} replace className="hover:text-primary">
                  Crie uma conta
                </Link>
              </>
            ) : (
              <>
                Já tem uma conta?{" "}
                <Link to="/entrar" search={flow.search} replace className="hover:text-primary">
                  Entre
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fundo: a tela inicial, como no layout (inerte enquanto o diálogo está aberto). */}
      <div aria-hidden inert className="pointer-events-none">
        <Hero />
        <CatalogSection search={{}} filtersOpen={false} onFiltersOpenChange={() => {}} />
      </div>
      <Dialog open onOpenChange={(open) => !open && flow.close()}>
        <DialogContent className="top-24 w-[20.5rem] max-w-[calc(100%-2rem)] translate-y-0 gap-0 rounded-none border-0 border-b-8 border-b-primary p-0 sm:max-w-[20.5rem]">
          <div className="flex flex-col gap-4 px-11 pt-7 pb-4">
            <DialogTitle className="sr-only">{mode === "login" ? "Entrar na Kurio" : "Criar conta na Kurio"}</DialogTitle>
            <ModeTabs mode={mode} search={flow.search} />
            <DialogDescription className="text-center text-[0.7rem] leading-snug text-foreground">{COPY[mode].intro}</DialogDescription>
            <ExpiredNotice search={flow.search} />
            <Form size="compact" onSuccess={flow.done} />
          </div>
          <div className="border-t border-border px-11 pt-2 pb-8">
            <SocialLogin size="compact" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LoginRoute() {
  return <AuthScreen mode="login" />;
}

export function RegisterRoute() {
  return <AuthScreen mode="register" />;
}
