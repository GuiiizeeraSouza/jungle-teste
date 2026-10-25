"use client";

import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { announce } from "@/lib/announce";
import { sessionStore } from "@/lib/session/session-store";

const PRIVATE = /^\/(pagamento|perfil|pedidos)/;

/**
 * Exibido quando a API rejeita a sessão durante a navegação. O contexto
 * (rota atual, rascunho do checkout) é preservado para retomada após o login.
 */
export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });

  useEffect(
    () =>
      sessionStore.subscribe((next, previous) => {
        if (previous.status === "authenticated" && next.status === "anonymous" && next.reason === "expired") {
          setOpen(true);
          announce("Sua sessão expirou. Entre novamente para continuar.", "assertive");
        }
      }),
    [],
  );

  const onAuthPage = location.pathname === "/entrar" || location.pathname === "/cadastro";
  const isPrivate = PRIVATE.test(location.pathname);

  const relogin = () => {
    setOpen(false);
    void navigate({ to: "/entrar", search: { redirect: location.href, motivo: "expirada" } });
  };

  const dismiss = () => {
    setOpen(false);
    if (isPrivate) void navigate({ to: "/" });
  };

  return (
    <Dialog open={open && !onAuthPage} onOpenChange={(value) => !value && dismiss()}>
      <DialogContent className="sm:max-w-sm" data-testid="session-expired-dialog">
        <DialogHeader className="items-center text-center sm:text-center">
          <Clock className="size-8 text-primary" aria-hidden />
          <DialogTitle>Sua sessão expirou</DialogTitle>
          <DialogDescription>
            Por segurança, encerramos sua sessão. Entre novamente para continuar de onde parou — seu carrinho e o que você preencheu foram
            mantidos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={dismiss}>
            {isPrivate ? "Ir para o início" : "Continuar navegando"}
          </Button>
          <Button onClick={relogin} autoFocus>
            Entrar novamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
