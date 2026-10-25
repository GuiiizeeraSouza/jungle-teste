"use client";

import { Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { NftCard, NftCardSkeleton } from "@/features/catalog/nft-card";
import { nftDetailQuery } from "@/features/catalog/queries";
import { useFavorites } from "@/features/favorites/use-favorites";

export function FavoritesPage() {
  const favorites = useFavorites();
  const ids = favorites.data?.nftIds ?? [];
  const details = useQueries({ queries: ids.map((id) => nftDetailQuery(id)) });

  return (
    <section aria-labelledby="favoritos-title" className="flex flex-col gap-5">
      <h1 id="favoritos-title" className="text-base font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Carregando favoritos">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.error ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} retrying={favorites.isRefetching} />
      ) : ids.length === 0 ? (
        <EmptyState
          title="Sua lista de interesse está vazia"
          description="Toque no coração de um NFT para acompanhá-lo aqui."
          action={
            <Button asChild>
              <Link to="/" hash="catalogo">
                Explorar o mercado
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3" aria-label="NFTs favoritos" data-testid="favorites-list">
          {details.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
