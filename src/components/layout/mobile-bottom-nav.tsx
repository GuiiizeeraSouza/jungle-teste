"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart, House, ScanLine, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/features/cart/use-cart";
import { useSession } from "@/features/session/use-session";
import { cn } from "@/lib/utils";

const itemClass = "grid h-14 place-items-center text-[#d8bf9f] transition-colors hover:text-primary aria-[current=page]:text-primary";

/** Navegação inferior do mobile (layout "Início" mobile). */
export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const navigate = useNavigate();
  const { data: cart } = useCart();
  const count = cart?.itemCount ?? 0;
  const authed = session.status === "authenticated";

  const explore = () => {
    void navigate({ to: "/", hash: "catalogo" }).then(() => {
      document.getElementById("busca-mobile")?.focus();
    });
  };

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto grid h-20 max-w-md grid-cols-5 items-center rounded-t-[2rem] bg-card px-4 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <Link to="/" aria-label="Início" aria-current={pathname === "/" ? "page" : undefined} className={itemClass}>
          <House className="size-6 fill-current" aria-hidden />
        </Link>
        <Link
          to="/perfil/lista-de-interesse"
          aria-label="Lista de interesse"
          aria-current={pathname.startsWith("/perfil/lista-de-interesse") ? "page" : undefined}
          className={itemClass}
        >
          <Heart className="size-6 fill-current" aria-hidden />
        </Link>
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={explore}
            aria-label="Explorar coleções"
            className="gradient-primary absolute -top-12 grid size-16 place-items-center rounded-full text-foreground ring-8 ring-background"
          >
            <ScanLine className="size-7" aria-hidden />
          </button>
        </div>
        <Link
          to="/carrinho"
          aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
          aria-current={pathname === "/carrinho" ? "page" : undefined}
          className={cn(itemClass, "relative")}
        >
          <ShoppingCart className="size-6" aria-hidden />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute top-2 right-3 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
            >
              {count}
            </span>
          )}
        </Link>
        <Link
          to={authed ? "/perfil" : "/entrar"}
          aria-label={authed ? "Meu perfil" : "Entrar"}
          aria-current={pathname === "/perfil" || pathname === "/perfil/carteiras" ? "page" : undefined}
          className={itemClass}
        >
          <User className="size-6 fill-current" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
