"use client";

import { useId } from "react";
import type { NftDetail, NftSummary } from "@/contracts";
import { Carousel } from "@/components/shared/carousel";
import { NftCard, NftCardSkeleton } from "@/features/catalog/nft-card";
import { useNftList } from "@/features/catalog/queries";

/** Faixa "Mais desta coleção" / "Colecionadores também viram". */
export function MoreFromCollection({ nft, title = "Mais desta coleção" }: { nft: Pick<NftDetail, "id" | "collection">; title?: string }) {
  const { data, isPending } = useNftList({ collection: nft.collection, exclude: nft.id, pageSize: 8, sort: "recent" });
  return <NftStrip title={title} items={data?.items} loading={isPending} />;
}

export function NftStrip({ title, items, loading }: { title: string; items: NftSummary[] | undefined; loading: boolean }) {
  const headingId = useId();
  const item = "w-[calc((100%-1rem)/2)] shrink-0 snap-start md:w-[calc((100%-4rem)/5)]";
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <h2 id={headingId} className="border-b border-border pb-1.5 text-sm font-bold text-price">
        {title}
      </h2>
      {loading ? (
        <div className="flex gap-4 overflow-hidden" aria-busy="true" aria-label={`Carregando ${title}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={item}>
              <NftCardSkeleton />
            </div>
          ))}
        </div>
      ) : items && items.length ? (
        <Carousel label={title}>
          {items.map((n) => (
            <div key={n.id} className={item}>
              <NftCard nft={n} sizes="(min-width: 768px) 220px, 45vw" />
            </div>
          ))}
        </Carousel>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma outra obra disponível no momento.</p>
      )}
    </section>
  );
}
