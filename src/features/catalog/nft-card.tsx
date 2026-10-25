"use client";

import { Link } from "@tanstack/react-router";
import { Heart, Search, ShoppingCart } from "lucide-react";
import type { NftSummary } from "@/contracts";
import { NftImage } from "@/components/shared/nft-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToCart } from "@/features/cart/use-cart";
import { useIsFavorite, useToggleFavorite } from "@/features/favorites/use-favorites";
import { toApiError } from "@/lib/api/errors";
import { formatEth } from "@/lib/eth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NftCardProps {
  nft: NftSummary;
  priority?: boolean;
  /** "grid": card do catálogo desktop; "tile": card arredondado do mobile. */
  variant?: "grid" | "tile";
  sizes?: string;
  className?: string;
}

function RareBadge() {
  return <span className="absolute top-2 left-0 z-10 bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">RARO</span>;
}

export function NftPrice({ nft, className }: { nft: Pick<NftSummary, "price" | "compareAtPrice">; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-sm font-bold text-price", className)}>
      <span data-testid="nft-price">{formatEth(nft.price)}</span>
      {nft.compareAtPrice && (
        <span className="font-normal text-muted-foreground">
          <span className="sr-only">preço anterior </span>
          {formatEth(nft.compareAtPrice)}
        </span>
      )}
    </p>
  );
}

function QuickActions({ nft }: { nft: NftSummary }) {
  const addToCart = useAddToCart();
  const favorites = useToggleFavorite();
  const favorite = useIsFavorite(nft.id);
  const soldOut = nft.available === 0;
  const button =
    "grid size-8 place-items-center rounded-[4px] bg-[#1c120e]/90 text-foreground backdrop-blur transition-colors hover:text-primary disabled:opacity-50";

  return (
    <div className="absolute right-3 bottom-3 z-10 flex gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
      <button
        type="button"
        className={button}
        disabled={soldOut || addToCart.isPending}
        aria-label={soldOut ? `${nft.name} esgotado` : `Adicionar ${nft.name} ao carrinho`}
        onClick={() =>
          addToCart.mutate(
            { nftId: nft.id, editionId: nft.defaultEditionId, quantity: 1 },
            { onError: (error) => toast.error("Não foi possível adicionar", { description: toApiError(error).message }) },
          )
        }
      >
        <ShoppingCart className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={cn(button, favorite && "text-primary")}
        aria-pressed={favorite}
        aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
        onClick={() => favorites.toggle(nft.id, nft.name, !favorite)}
      >
        <Heart className={cn("size-4", favorite && "fill-current")} aria-hidden />
      </button>
      <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={button} aria-label={`Ver detalhes de ${nft.name}`}>
        <Search className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

export function NftCard({ nft, priority, variant = "grid", sizes, className }: NftCardProps) {
  const favorites = useToggleFavorite();
  const favorite = useIsFavorite(nft.id);

  if (variant === "tile") {
    return (
      <article className={cn("relative flex flex-col gap-3", className)} data-testid="nft-card">
        <div className="relative rounded-3xl bg-card p-2.5">
          {nft.rare && <RareBadge />}
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} tabIndex={-1} aria-hidden>
            <NftImage image={nft.image} sizes={sizes ?? "45vw"} priority={priority} className="aspect-square rounded-2xl" decorative />
          </Link>
          <button
            type="button"
            onClick={() => favorites.toggle(nft.id, nft.name, !favorite)}
            aria-pressed={favorite}
            aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-[#2b1d16]/90 text-primary"
          >
            <Heart className={cn("size-4", favorite && "fill-current")} aria-hidden />
          </button>
        </div>
        <div className="px-1">
          <h3 className="text-base leading-tight">
            <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-primary">
              {nft.name}
            </Link>
          </h3>
          <NftPrice nft={nft} className="text-lg" />
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group flex flex-col gap-2", className)} data-testid="nft-card">
      <div className="relative bg-card p-2.5">
        {nft.rare && <RareBadge />}
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} tabIndex={-1} aria-hidden>
          <NftImage
            image={nft.image}
            sizes={sizes ?? "(min-width: 1024px) 270px, 45vw"}
            priority={priority}
            className="aspect-[25/27] rounded-xl"
            imageClassName="group-hover:scale-[1.03]"
            decorative
          />
        </Link>
        <QuickActions nft={nft} />
      </div>
      <div>
        <h3 className="text-sm leading-snug">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-primary">
            {nft.name}
          </Link>
        </h3>
        <NftPrice nft={nft} />
      </div>
    </article>
  );
}

export function NftCardSkeleton({ variant = "grid" }: { variant?: "grid" | "tile" }) {
  if (variant === "tile") {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-3xl bg-card p-2.5">
          <Skeleton className="aspect-square rounded-2xl" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-card p-2.5">
        <Skeleton className="aspect-[25/27] rounded-xl" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}
