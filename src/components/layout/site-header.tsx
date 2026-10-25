"use client";

import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, LogIn, LogOut, Search, ShoppingCart, User, Wallet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/use-cart";
import { useLogout } from "@/features/session/use-auth-actions";
import { useSession } from "@/features/session/use-session";
import { cn } from "@/lib/utils";
import { SearchDialog } from "./search-dialog";
import { UserAvatar } from "./user-avatar";

const NAV = [
  { label: "Início", to: "/", match: (p: string) => p === "/" },
  { label: "Mercado", to: "/", hash: "catalogo", match: (p: string) => /^\/(nft|carrinho|pagamento)/.test(p) },
  { label: "Criadores", to: "/criadores", match: (p: string) => p.startsWith("/criadores") },
  { label: "Aprenda", to: "/aprenda", match: (p: string) => p.startsWith("/aprenda") },
] as const;

export function CartLink({ className }: { className?: string }) {
  const { data } = useCart();
  const count = data?.itemCount ?? 0;
  return (
    <Link
      to="/carrinho"
      aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
      className={cn("relative grid size-9 place-items-center rounded-full text-foreground hover:text-primary", className)}
    >
      <ShoppingCart className="size-5" aria-hidden />
      <span
        aria-hidden
        data-testid="cart-count"
        className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
      >
        {count}
      </span>
    </Link>
  );
}

function AccountArea() {
  const session = useSession();
  const href = useRouterState({ select: (s) => s.location.href });
  const logout = useLogout();

  if (session.status !== "authenticated") {
    return (
      <Button asChild size="sm" className="h-8 gap-1.5 text-sm">
        <Link to="/entrar" search={{ redirect: href.startsWith("/entrar") || href.startsWith("/cadastro") ? undefined : href }}>
          <LogIn aria-hidden />
          Entrar
        </Link>
      </Button>
    );
  }

  const { user } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm hover:bg-accent"
          aria-label={`Menu da conta de ${user.displayName}`}
        >
          <UserAvatar user={user} className="size-7" />
          <span className="max-w-28 truncate font-medium">{user.displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border bg-card">
        <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <User aria-hidden /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/carteiras">
            <Wallet aria-hidden /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/lista-de-interesse">
            <Heart aria-hidden /> Lista de interesse
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Cabeçalho desktop/tablet (o mobile usa barras próprias por tela). */
export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="hidden md:block">
      <div className="container-page">
        <div className="relative flex h-16 items-center justify-between border-b border-border">
          <Link to="/" className="text-sm font-bold tracking-[0.18em]" aria-label="Kurio — página inicial">
            KURIO
          </Link>

          <nav aria-label="Principal" className="absolute inset-y-0 left-1/2 -translate-x-1/2">
            <ul className="flex h-full items-stretch gap-6 lg:gap-9">
              {NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.label} className="flex">
                    <Link
                      to={item.to}
                      hash={"hash" in item ? item.hash : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center text-sm transition-colors hover:text-primary",
                        active && "font-bold text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-3 lg:gap-5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar NFTs"
              className="grid size-9 place-items-center rounded-full hover:text-primary"
            >
              <Search className="size-5" aria-hidden />
            </button>
            <CartLink />
            <AccountArea />
          </div>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
