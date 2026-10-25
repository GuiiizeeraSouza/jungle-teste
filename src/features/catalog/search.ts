import { z } from "zod";
import { Category, Network, SortOption, type NftListParams } from "@/contracts";

/**
 * Estado do catálogo na URL (parâmetros em português, listas separadas por
 * vírgula). Valores inválidos são descartados — a URL nunca quebra a página.
 */
export interface CatalogSearch {
  busca?: string;
  categoria?: Category[];
  rede?: Network[];
  min?: string;
  max?: string;
  ordem?: SortOption;
  aba?: "novos" | "em-alta";
  pagina?: number;
}

export const CATALOG_PAGE_SIZE = 9;

const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .optional()
  .catch(undefined);

function list<T extends string>(schema: z.ZodType<T>, value: unknown): T[] | undefined {
  if (typeof value !== "string" && !Array.isArray(value)) return undefined;
  const raw = Array.isArray(value) ? value.map(String) : value.split(",");
  const parsed = [...new Set(raw.map((v) => v.trim()).filter(Boolean))].filter((v): v is T => schema.safeParse(v).success);
  return parsed.length ? parsed : undefined;
}

export function validateCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const busca = typeof search.busca === "string" ? search.busca.trim().slice(0, 80) : undefined;
  const page = Number(search.pagina);
  return {
    busca: busca || undefined,
    categoria: list(Category, search.categoria),
    rede: list(Network, search.rede),
    min: decimal.parse(search.min === undefined ? undefined : String(search.min)),
    max: decimal.parse(search.max === undefined ? undefined : String(search.max)),
    ordem: SortOption.optional().catch(undefined).parse(search.ordem),
    aba: z.enum(["novos", "em-alta"]).optional().catch(undefined).parse(search.aba),
    pagina: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.busca,
    categories: search.categoria,
    networks: search.rede,
    minPrice: search.min,
    maxPrice: search.max,
    sort: search.ordem ?? "recent",
    tab: search.aba === "novos" ? "new" : search.aba === "em-alta" ? "trending" : "all",
    page: search.pagina ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  };
}

export function hasActiveFilters(search: CatalogSearch) {
  return Boolean(search.busca || search.categoria || search.rede || search.min || search.max);
}
