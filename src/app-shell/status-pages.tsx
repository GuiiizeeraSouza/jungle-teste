"use client";

import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Compass, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";

export function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-16 text-center">
      <Compass className="size-10 text-primary" aria-hidden />
      <p className="text-sm font-bold text-primary">Erro 404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        O endereço acessado não existe ou foi movido. Que tal voltar a explorar a coleção?
      </p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="container-page py-16">
      <ErrorState
        error={error}
        title="Algo deu errado nesta página"
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </div>
  );
}

/** Seções fora do escopo da entrega: comunicadas como indisponíveis. */
export function ComingSoonPage() {
  return (
    <>
      <MobileTopBar title="Em breve" />
      <div className="container-page flex min-h-[55dvh] flex-col items-center justify-center gap-4 py-16 text-center">
        <Hammer className="size-10 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">Esta seção ainda não está disponível</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Criadores e conteúdos educativos não fazem parte desta versão da Kurio. Enquanto isso, explore o mercado.
        </p>
        <Button asChild>
          <Link to="/" hash="catalogo">
            Explorar o mercado
          </Link>
        </Button>
      </div>
    </>
  );
}
