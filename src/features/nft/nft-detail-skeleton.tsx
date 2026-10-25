import { Skeleton } from "@/components/ui/skeleton";
import { useIsDesktop } from "@/lib/use-media-query";

/** Mesmas dimensões do conteúdo final — evita deslocamento de layout. */
export function NftDetailSkeleton() {
  const desktop = useIsDesktop();
  if (!desktop) {
    return (
      <div aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton" className="px-6 pt-20">
        <Skeleton className="aspect-[63/62] rounded-3xl" />
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-16" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton" className="container-page flex flex-col gap-3 pt-6">
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex gap-4">
          <div className="flex w-16 flex-col gap-3 lg:w-[4.5rem]">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
          <div className="flex-1 bg-card p-3">
            <Skeleton className="aspect-square rounded-2xl" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-9" />
          <Skeleton className="h-14 w-2/3" />
        </div>
      </div>
    </div>
  );
}
