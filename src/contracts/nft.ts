import { z } from "zod";
import { EthAmount, ImageRef, Network, paginated } from "./common";

export const Category = z.enum([
  "arte-digital",
  "fotografia",
  "musica",
  "arte-3d",
  "colecionaveis",
  "generativa",
  "jogos",
  "assinaturas",
  "utilidade",
]);
export type Category = z.infer<typeof Category>;

export const CATEGORY_LABEL: Record<Category, string> = {
  "arte-digital": "Arte digital",
  fotografia: "Fotografia",
  musica: "Música",
  "arte-3d": "Arte 3D",
  colecionaveis: "Colecionáveis",
  generativa: "Generativa",
  jogos: "Jogos",
  assinaturas: "Assinaturas",
  utilidade: "Utilidade",
};

export const EditionId = z.enum(["1-1", "1-10", "1-50", "open"]);
export type EditionId = z.infer<typeof EditionId>;

export const EDITION_LABEL: Record<EditionId, string> = {
  "1-1": "1/1",
  "1-10": "1/10",
  "1-50": "1/50",
  open: "ABERTA",
};

export const Edition = z.object({
  id: EditionId,
  label: z.string(),
  price: EthAmount,
  supply: z.number().int().min(1),
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1),
});
export type Edition = z.infer<typeof Edition>;

export const SortOption = z.enum(["recent", "price-asc", "price-desc", "rating", "name"]);
export type SortOption = z.infer<typeof SortOption>;

export const SORT_LABEL: Record<SortOption, string> = {
  recent: "Listados recentemente",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  rating: "Mais bem avaliados",
  name: "Nome (A–Z)",
};

export const CatalogTab = z.enum(["all", "new", "trending"]);
export type CatalogTab = z.infer<typeof CatalogTab>;

export const NftSummary = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  collection: z.string(),
  category: Category,
  network: Network,
  image: ImageRef,
  /** Preço da edição padrão (exibida no card). */
  price: EthAmount,
  compareAtPrice: EthAmount.nullable(),
  defaultEditionId: EditionId,
  rare: z.boolean(),
  isNew: z.boolean(),
  trending: z.boolean(),
  rating: z.number(),
  reviewCount: z.number().int(),
  listedAt: z.string(),
  /** Soma das edições disponíveis. */
  available: z.number().int().min(0),
  /** Versão monotônica do recurso — usada para ordenar eventos em tempo real. */
  version: z.number().int().min(1),
});
export type NftSummary = z.infer<typeof NftSummary>;

export const GalleryItem = ImageRef.extend({
  /** Recorte/zoom aplicado na galeria (mesma arte, enquadramentos diferentes). */
  focus: z.enum(["full", "face", "detail", "torso"]),
});
export type GalleryItem = z.infer<typeof GalleryItem>;

export const NftDetail = NftSummary.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  attributes: z.array(z.string()),
  creator: z.string(),
  royaltyPercent: z.number(),
  contractAddress: z.string(),
  contractStandard: z.string(),
  storage: z.string(),
  gallery: z.array(GalleryItem),
  editions: z.array(Edition),
});
export type NftDetail = z.infer<typeof NftDetail>;

export const FacetEntry = z.object({ id: z.string(), label: z.string(), count: z.number().int() });
export type FacetEntry = z.infer<typeof FacetEntry>;

export const CatalogFacets = z.object({
  categories: z.array(FacetEntry),
  networks: z.array(FacetEntry),
  price: z.object({ min: EthAmount, max: EthAmount }),
});
export type CatalogFacets = z.infer<typeof CatalogFacets>;

export const NftListResponse = paginated(NftSummary).extend({ facets: CatalogFacets });
export type NftListResponse = z.infer<typeof NftListResponse>;

/** Parâmetros enviados à API de listagem (espelham o estado da URL). */
export interface NftListParams {
  q?: string;
  categories?: Category[];
  networks?: Network[];
  minPrice?: string;
  maxPrice?: string;
  sort?: SortOption;
  tab?: CatalogTab;
  page?: number;
  pageSize?: number;
  collection?: string;
  exclude?: string;
}

export const FeaturedResponse = z.object({
  spotlight: NftSummary,
  hero: z.array(NftSummary),
});
export type FeaturedResponse = z.infer<typeof FeaturedResponse>;

export const Review = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
});
export type Review = z.infer<typeof Review>;

export const ReviewListResponse = z.object({
  items: z.array(Review),
  average: z.number(),
  total: z.number().int(),
});
export type ReviewListResponse = z.infer<typeof ReviewListResponse>;
