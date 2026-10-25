"use client";

import { useEffect, useState } from "react";
import type { CatalogFacets, Category, Network } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { eth, formatEthBr } from "@/lib/eth";
import { cn } from "@/lib/utils";
import type { CatalogSearch } from "./search";

interface FiltersPanelProps {
  facets: CatalogFacets | undefined;
  search: CatalogSearch;
  onChange: (patch: Partial<CatalogSearch>) => void;
  className?: string;
}

function toggle<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
  const current = list ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return next.length ? next : undefined;
}

function FacetGroup<T extends string>({
  legend,
  entries,
  selected,
  onToggle,
}: {
  legend: string;
  entries: Array<{ id: T; label: string; count: number }>;
  selected: T[] | undefined;
  onToggle: (id: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-3 text-sm font-bold">{legend}</legend>
      {entries.map((entry) => {
        const checked = selected?.includes(entry.id) ?? false;
        return (
          <label
            key={entry.id}
            className={cn(
              "relative flex cursor-pointer items-center justify-between rounded-[3px] px-2 py-1.5 text-xs transition-colors hover:text-primary",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              checked ? "font-bold text-primary" : "text-muted-foreground",
            )}
          >
            <input
              type="checkbox"
              className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
              checked={checked}
              onChange={() => onToggle(entry.id)}
            />
            <span className="flex items-center gap-2">
              <span aria-hidden className={cn("size-1.5 rounded-full", checked ? "bg-primary" : "bg-transparent")} />
              {entry.label}
            </span>
            <span className={cn("tabular-nums", checked ? "text-primary" : "text-foreground/80")}>({entry.count})</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function PriceFilter({
  facets,
  search,
  onChange,
}: {
  facets: CatalogFacets;
  search: CatalogSearch;
  onChange: FiltersPanelProps["onChange"];
}) {
  const bounds: [number, number] = [Number(facets.price.min), Number(facets.price.max)];
  const fromSearch = (): [number, number] => [search.min ? Number(search.min) : bounds[0], search.max ? Number(search.max) : bounds[1]];
  const [range, setRange] = useState<[number, number]>(fromSearch);

  // Sincroniza com a URL (voltar/avançar no histórico).
  useEffect(() => {
    setRange(fromSearch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.min, search.max, facets.price.min, facets.price.max]);

  const apply = () => {
    const min = range[0].toFixed(2);
    const max = range[1].toFixed(2);
    onChange({
      min: eth.cmp(min, facets.price.min) <= 0 ? undefined : min,
      max: eth.cmp(max, facets.price.max) >= 0 ? undefined : max,
    });
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-bold">Faixa de preço</legend>
      <Slider
        min={bounds[0]}
        max={bounds[1]}
        step={0.01}
        minStepsBetweenThumbs={1}
        value={range}
        onValueChange={(v) => setRange([v[0]!, v[1]!])}
        thumbLabels={["Preço mínimo (ETH)", "Preço máximo (ETH)"]}
        className="px-1"
      />
      <p className="text-xs text-foreground/90" aria-live="polite">
        Preço: {formatEthBr(range[0].toFixed(2))} - {formatEthBr(range[1].toFixed(2))} ETH
      </p>
      <Button size="sm" onClick={apply} className="h-7 w-fit px-3">
        Aplicar
      </Button>
    </fieldset>
  );
}

export function FiltersPanel({ facets, search, onChange, className }: FiltersPanelProps) {
  if (!facets) {
    return (
      <div className={cn("flex flex-col gap-3 bg-card p-4", className)} aria-busy="true" aria-label="Carregando filtros">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-7 bg-card px-4 py-5", className)}>
      <FacetGroup<Category>
        legend="Coleções"
        entries={facets.categories as Array<{ id: Category; label: string; count: number }>}
        selected={search.categoria}
        onToggle={(id) => onChange({ categoria: toggle(search.categoria, id) })}
      />
      <PriceFilter facets={facets} search={search} onChange={onChange} />
      <FacetGroup<Network>
        legend="Rede"
        entries={facets.networks as Array<{ id: Network; label: string; count: number }>}
        selected={search.rede}
        onToggle={(id) => onChange({ rede: toggle(search.rede, id) })}
      />
    </div>
  );
}
