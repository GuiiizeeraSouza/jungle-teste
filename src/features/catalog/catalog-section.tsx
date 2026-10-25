"use client";

import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { CATEGORY_LABEL, NETWORK_LABEL, SORT_LABEL, SortOption, type NftListResponse } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NftImage } from "@/components/shared/nft-image";
import { BackgroundRefresh, EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEthBr } from "@/lib/eth";
import { useIsDesktop, useIsLargeScreen } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { FiltersPanel } from "./filters-panel";
import { NftCard, NftCardSkeleton } from "./nft-card";
import { featuredQuery, useNftList } from "./queries";
import { hasActiveFilters, toListParams, type CatalogSearch } from "./search";

const TABS: Array<{ value: CatalogSearch["aba"]; label: string }> = [
  { value: undefined, label: "Todos os NFTs" },
  { value: "novos", label: "Novos lançamentos" },
  { value: "em-alta", label: "Em alta" },
];

/** Atualiza o estado do catálogo na URL. Mudanças de filtro reiniciam a paginação. */
export function useCatalogNavigation() {
  const navigate = useNavigate({ from: "/" });
  return (patch: Partial<CatalogSearch>, options: { keepPage?: boolean } = {}) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch, ...(options.keepPage ? {} : { pagina: undefined }) }),
      resetScroll: false,
    });
}

function TabsBar({
  search,
  onChange,
  className,
}: {
  search: CatalogSearch;
  onChange: (p: Partial<CatalogSearch>) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Destaques do catálogo" className={cn("flex scrollbar-none gap-3 overflow-x-auto md:gap-5", className)}>
      {TABS.map((tab) => {
        const active = search.aba === tab.value;
        return (
          <button
            key={tab.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ aba: tab.value })}
            className={cn(
              "shrink-0 border-b-2 pb-1 whitespace-nowrap transition-colors hover:text-primary",
              active ? "border-primary font-bold text-primary" : "border-transparent",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SortSelect({ search, onChange }: { search: CatalogSearch; onChange: (p: Partial<CatalogSearch>) => void }) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-1 text-sm">
      <span id={labelId} className="whitespace-nowrap">
        Ordenar por:
      </span>
      <Select
        value={search.ordem ?? "recent"}
        onValueChange={(value) => onChange({ ordem: value === "recent" ? undefined : SortOption.parse(value) })}
      >
        <SelectTrigger aria-labelledby={labelId} className="h-8 border-0 bg-transparent px-1 text-sm shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-border bg-card">
          {SortOption.options.map((option) => (
            <SelectItem key={option} value={option}>
              {SORT_LABEL[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ActiveFilters({ search, onChange }: { search: CatalogSearch; onChange: (p: Partial<CatalogSearch>) => void }) {
  if (!hasActiveFilters(search)) return null;
  const chips: Array<{ label: string; remove: Partial<CatalogSearch> }> = [];
  if (search.busca) chips.push({ label: `Busca: “${search.busca}”`, remove: { busca: undefined } });
  for (const c of search.categoria ?? [])
    chips.push({
      label: CATEGORY_LABEL[c],
      remove: { categoria: search.categoria!.filter((x) => x !== c).length ? search.categoria!.filter((x) => x !== c) : undefined },
    });
  for (const n of search.rede ?? [])
    chips.push({
      label: NETWORK_LABEL[n],
      remove: { rede: search.rede!.filter((x) => x !== n).length ? search.rede!.filter((x) => x !== n) : undefined },
    });
  if (search.min || search.max)
    chips.push({
      label: `Preço: ${search.min ? formatEthBr(search.min) : "mín."} – ${search.max ? formatEthBr(search.max) : "máx."} ETH`,
      remove: { min: undefined, max: undefined },
    });

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => onChange(chip.remove)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1 text-xs hover:bg-primary/10"
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="size-3" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        className="text-xs font-bold text-primary underline-offset-4 hover:underline"
        onClick={() => onChange({ busca: undefined, categoria: undefined, rede: undefined, min: undefined, max: undefined })}
      >
        Limpar filtros
      </button>
    </div>
  );
}

function Pagination({ data, search }: { data: NftListResponse; search: CatalogSearch }) {
  const current = data.page;
  if (data.totalPages <= 1) return null;
  const pages = Array.from({ length: data.totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === data.totalPages || Math.abs(p - current) <= 2,
  );
  const base = "grid size-7 place-items-center rounded-[3px] border border-border text-xs transition-colors hover:border-primary";
  const toPage = (p: number) => ({ ...search, pagina: p > 1 ? p : undefined });

  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex items-center gap-1.5">
        {current > 1 && (
          <li>
            <Link from="/" to="/" search={toPage(current - 1)} hash="catalogo" className={base} aria-label="Página anterior">
              <ChevronLeft className="size-3.5" aria-hidden />
            </Link>
          </li>
        )}
        {pages.map((p, index) => (
          <li key={p} className="flex items-center gap-1.5">
            {index > 0 && p - pages[index - 1]! > 1 && <span aria-hidden>…</span>}
            <Link
              from="/"
              to="/"
              search={toPage(p)}
              hash="catalogo"
              aria-label={`Página ${p}`}
              aria-current={p === current ? "page" : undefined}
              className={cn(base, p === current && "border-primary bg-primary font-bold text-primary-foreground")}
            >
              {p}
            </Link>
          </li>
        ))}
        {current < data.totalPages && (
          <li>
            <Link from="/" to="/" search={toPage(current + 1)} hash="catalogo" className={base} aria-label="Próxima página">
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

function SpotlightCard() {
  const { data, isPending } = useQuery(featuredQuery());
  return (
    <section aria-labelledby="destaque-title" className="bg-card pt-4">
      <h2 id="destaque-title" className="px-2 text-center">
        <span className="block text-xl font-bold text-price">NFT EM DESTAQUE</span>
        <span className="block text-sm font-bold">OFERTA LIMITADA</span>
      </h2>
      {isPending || !data ? (
        <Skeleton className="mt-3 aspect-[4/5] rounded-2xl" />
      ) : (
        <Link
          to="/nft/$nftId"
          params={{ nftId: data.spotlight.id }}
          className="mt-3 block"
          aria-label={`Ver ${data.spotlight.name} em destaque`}
        >
          <NftImage image={data.spotlight.image} sizes="260px" className="aspect-[4/5] rounded-2xl" />
        </Link>
      )}
    </section>
  );
}

interface CatalogSectionProps {
  search: CatalogSearch;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
}

export function CatalogSection({ search, filtersOpen, onFiltersOpenChange: setFiltersOpen }: CatalogSectionProps) {
  const params = toListParams(search);
  const query = useNftList(params);
  const change = useCatalogNavigation();
  const desktop = useIsDesktop();
  const largeScreen = useIsLargeScreen();
  const { error, isPlaceholderData, isFetching, refetch, isRefetching } = query;
  // Renderização dos resultados em prioridade de transição (fatiada, não bloqueia o main thread).
  const data = useDeferredValue(query.data);
  const isPending = !data && !error;

  // Anuncia o total de resultados quando a consulta atual termina.
  const [announcement, setAnnouncement] = useState("");
  const lastKey = useRef("");
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    const key = JSON.stringify(params);
    if (key === lastKey.current) return;
    lastKey.current = key;
    setAnnouncement(
      data.total === 0 ? "Nenhum NFT encontrado" : `${data.total} NFTs encontrados, página ${data.page} de ${data.totalPages}`,
    );
  }, [data, isPlaceholderData, params]);

  const pageOutOfRange = data && !isPlaceholderData && data.total > 0 && data.items.length === 0;

  return (
    <section id="catalogo" aria-labelledby="catalogo-title" className="container-page scroll-mt-6 pt-10 md:pt-14">
      <h2 id="catalogo-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,15rem)_1fr] xl:grid-cols-[minmax(0,16.5rem)_1fr]">
        {largeScreen && (
          <aside aria-label="Filtros do catálogo" className="flex flex-col gap-6">
            <FiltersPanel facets={data?.facets} search={search} onChange={change} />
            <SpotlightCard />
          </aside>
        )}

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <TabsBar search={search} onChange={change} className="-mx-1 px-1 text-[0.92rem] md:text-sm" />
            <div className="hidden items-center gap-3 md:flex">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal aria-hidden /> Filtros
              </Button>
              <SortSelect search={search} onChange={change} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ActiveFilters search={search} onChange={change} />
            <BackgroundRefresh active={isFetching && !isPending} label={isPlaceholderData ? "Carregando resultados…" : "Atualizando…"} />
          </div>

          {isPending ? (
            <div aria-busy="true" aria-label="Carregando NFTs" data-testid="catalog-skeleton">
              {desktop ? (
                <div className="grid grid-cols-3 gap-x-5 gap-y-9">
                  {Array.from({ length: 9 }, (_, i) => (
                    <NftCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className={cn(i % 2 === 1 && "mt-14")}>
                      <NftCardSkeleton variant="tile" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : error && !data ? (
            <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
          ) : data && data.total === 0 ? (
            <EmptyState
              title="Nenhum NFT encontrado"
              description="Tente outros termos de busca ou remova alguns filtros."
              action={
                hasActiveFilters(search) || search.aba ? (
                  <Button
                    onClick={() =>
                      change({ busca: undefined, categoria: undefined, rede: undefined, min: undefined, max: undefined, aba: undefined })
                    }
                  >
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : pageOutOfRange ? (
            <EmptyState
              title="Esta página não existe"
              description={`O catálogo tem ${data.totalPages} página(s) para estes filtros.`}
              action={
                <Button asChild>
                  <Link from="/" to="/" search={{ ...search, pagina: undefined }}>
                    Ir para a primeira página
                  </Link>
                </Button>
              }
            />
          ) : data ? (
            <div aria-busy={isPlaceholderData} className={cn("flex flex-col gap-8 transition-opacity", isPlaceholderData && "opacity-60")}>
              {error && <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} className="py-6" />}
              {desktop ? (
                <ul className="grid grid-cols-3 gap-x-5 gap-y-9" aria-label="NFTs">
                  {data.items.map((nft, i) => (
                    <li key={nft.id}>
                      <NftCard nft={nft} priority={i < 3 && data.page === 1} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-6" aria-label="NFTs">
                  {data.items.map((nft, i) => (
                    <li key={nft.id} className={cn(i % 2 === 1 && "mt-14")}>
                      <NftCard nft={nft} variant="tile" priority={i < 2 && data.page === 1} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  {data.total} NFTs · página {data.page} de {data.totalPages}
                </p>
                <Pagination data={data} search={search} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto border-border p-0">
          <SheetHeader className="px-4 pt-5">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Combine coleções, faixa de preço e rede.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-6">
            <div className="md:hidden">
              <SortSelect search={search} onChange={change} />
            </div>
            <FiltersPanel facets={data?.facets} search={search} onChange={change} className="px-0" />
            <Button onClick={() => setFiltersOpen(false)}>Ver {data ? `${data.total} resultados` : "resultados"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
