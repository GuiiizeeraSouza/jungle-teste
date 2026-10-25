"use client";

import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { CatalogSection, useCatalogNavigation } from "./catalog-section";
import { Hero } from "./hero";
import { JournalSection, PromoBanners } from "./home-extras";

/** Busca + botão de filtros do topo da tela inicial mobile. */
function MobileSearchBar({ onOpenFilters }: { onOpenFilters: () => void }) {
  const search = useSearch({ from: "/" });
  const change = useCatalogNavigation();
  const [value, setValue] = useState(search.busca ?? "");

  useEffect(() => setValue(search.busca ?? ""), [search.busca]);

  // Busca enquanto digita (debounce), refletida na URL.
  useEffect(() => {
    const term = value.trim();
    if (term === (search.busca ?? "")) return;
    const timer = setTimeout(() => void change({ busca: term || undefined }), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="container-page flex gap-3 pt-8 pb-5 md:hidden">
      <form
        role="search"
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          void change({ busca: value.trim() || undefined });
        }}
      >
        <label htmlFor="busca-mobile" className="sr-only">
          Explorar coleções
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-price" aria-hidden />
        <input
          id="busca-mobile"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-xl bg-card pr-4 pl-12 text-base font-bold text-foreground placeholder:text-price/80 focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Abrir filtros"
        className="gradient-primary grid size-11 shrink-0 place-items-center rounded-xl text-primary-foreground"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
      </button>
    </div>
  );
}

export function HomePage() {
  const search = useSearch({ from: "/" });
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
      <MobileSearchBar onOpenFilters={() => setFiltersOpen(true)} />
      <Hero />
      <CatalogSection search={search} filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen} />
      <PromoBanners />
      <JournalSection />
    </>
  );
}
