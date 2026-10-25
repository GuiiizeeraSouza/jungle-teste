"use client";

import { useQuery } from "@tanstack/react-query";
import { Rating } from "@/components/shared/misc";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { reviewsQuery } from "@/features/catalog/queries";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function ReviewsPanel({ nftId }: { nftId: string }) {
  const { data, isPending, error, refetch, isRefetching } = useQuery(reviewsQuery(nftId));
  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando avaliações">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        <Rating value={data.average} />
        <span>
          {data.average.toFixed(1)} de 5 · {data.total} avaliações
        </span>
      </p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.items.map((review) => (
          <li key={review.id} className="flex flex-col gap-1.5 bg-card p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{review.author}</span>
              <time dateTime={review.createdAt} className="text-muted-foreground">
                {dateFormat.format(new Date(review.createdAt))}
              </time>
            </div>
            <Rating value={review.rating} />
            <p className="text-muted-foreground">{review.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
