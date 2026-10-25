"use client";

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/session/use-session";

/**
 * O `beforeLoad` protege a entrada nas rotas privadas; este gate cobre a
 * sessão que termina com a página já aberta (expiração/logout em outra aba).
 */
export function AuthGate() {
  const session = useSession();
  const href = useRouterState({ select: (s) => s.location.href });
  if (session.status === "authenticated") return <Outlet />;
  return (
    <div className="container-page flex min-h-[55dvh] flex-col items-center justify-center gap-4 py-16 text-center">
      <Lock className="size-9 text-primary" aria-hidden />
      <h1 className="text-xl font-bold">Entre para continuar</h1>
      <p className="max-w-md text-sm text-muted-foreground">Esta área é exclusiva para colecionadores autenticados.</p>
      <Button asChild>
        <Link to="/entrar" search={{ redirect: href, motivo: session.reason === "expired" ? "expirada" : undefined }}>
          Entrar
        </Link>
      </Button>
    </div>
  );
}
