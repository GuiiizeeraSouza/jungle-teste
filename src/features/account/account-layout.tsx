"use client";

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Download, Heart, LogOut, MapPin, ShoppingCart, Tag, User } from "lucide-react";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { notAvailable } from "@/components/shared/misc";
import { useLogout } from "@/features/session/use-auth-actions";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Dados do perfil", to: "/perfil", Icon: User },
  { label: "Carteiras", to: "/perfil/carteiras", Icon: MapPin },
  { label: "Atividade", Icon: ShoppingCart },
  { label: "Lista de interesse", to: "/perfil/lista-de-interesse", Icon: Heart },
  { label: "Ofertas", Icon: Tag },
  { label: "Arquivos baixados", Icon: Download },
  { label: "Suporte", Icon: AlertTriangle },
] as const;

const TITLES: Record<string, string> = {
  "/perfil": "Meu perfil",
  "/perfil/carteiras": "Carteiras",
  "/perfil/lista-de-interesse": "Lista de interesse",
};

export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }).replace(/\/$/, "") || "/perfil";
  const logout = useLogout();
  const item = "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-accent";

  return (
    <>
      <MobileTopBar title={TITLES[pathname] ?? "Meu perfil"} fallback="/" />
      <div className="container-page grid grid-cols-1 items-start gap-6 pt-2 pb-12 md:grid-cols-[minmax(0,13.5rem)_1fr] md:pt-7 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-6">
        <nav aria-labelledby="meu-perfil-nav" className="min-w-0 bg-card pt-3">
          <h2 id="meu-perfil-nav" className="px-2.5 pb-1 text-base font-bold">
            Meu perfil
          </h2>
          <ul className="flex scrollbar-none overflow-x-auto md:block">
            {LINKS.map(({ label, Icon, ...rest }) => {
              const to = "to" in rest ? rest.to : undefined;
              const active = to === pathname;
              return (
                <li key={label} className="shrink-0">
                  {to ? (
                    <Link
                      to={to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        item,
                        "relative",
                        active && "before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-primary",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </Link>
                  ) : (
                    <button type="button" className={cn(item, "whitespace-nowrap")} onClick={() => notAvailable(label)}>
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-3 border-t border-primary/40 px-4 py-3 text-sm font-bold text-primary hover:bg-accent"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </>
  );
}
