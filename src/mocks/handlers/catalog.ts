import { HttpResponse, http } from "msw";
import { z } from "zod";
import { CatalogTab, Category, Network, SortOption, type FeaturedResponse, type ReviewListResponse } from "@/contracts";
import { commit, db } from "../db";
import { DomainError, findNft, listNfts, toDetail, toSummary } from "../domain";
import { buildReviews } from "../fixtures";
import { api, requireAuth, withConditions } from "../http-utils";

const csv = <T extends string>(item: z.ZodType<T, string>) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(item));

const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .optional();

const ListParams = z.object({
  q: z.string().max(80).optional(),
  category: csv(Category),
  network: csv(Network),
  minPrice: decimal,
  maxPrice: decimal,
  sort: SortOption.default("recent"),
  tab: CatalogTab.default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(9),
  collection: z.string().optional(),
  exclude: z.string().optional(),
});

export const catalogHandlers = [
  http.get(
    api("/nfts"),
    withConditions(({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      const parsed = ListParams.safeParse(params);
      if (!parsed.success) {
        throw new DomainError(422, "VALIDATION_ERROR", "Parâmetros de busca inválidos.");
      }
      const p = parsed.data;
      return HttpResponse.json(
        listNfts({
          q: p.q,
          categories: p.category,
          networks: p.network,
          minPrice: p.minPrice,
          maxPrice: p.maxPrice,
          sort: p.sort,
          tab: p.tab,
          page: p.page,
          pageSize: p.pageSize,
          collection: p.collection,
          exclude: p.exclude,
        }),
      );
    }),
  ),

  http.get(
    api("/nfts/featured"),
    withConditions(() => {
      const nfts = db().nfts;
      const spotlight = nfts.find((n) => n.id === "sage-nomad-009") ?? nfts[0];
      if (!spotlight) throw new DomainError(404, "NOT_FOUND", "Nenhum destaque disponível");
      const body: FeaturedResponse = {
        spotlight: toSummary(spotlight),
        hero: nfts
          .filter((n) => n.trending)
          .slice(0, 3)
          .map(toSummary),
      };
      return HttpResponse.json(body);
    }),
  ),

  http.get(
    api("/nfts/:nftId"),
    withConditions(({ params }) => {
      const nft = findNft(String(params.nftId));
      if (!nft) throw new DomainError(404, "NOT_FOUND", "NFT não encontrado.");
      return HttpResponse.json(toDetail(nft));
    }),
  ),

  http.get(
    api("/nfts/:nftId/reviews"),
    withConditions(({ params }) => {
      const nft = findNft(String(params.nftId));
      if (!nft) throw new DomainError(404, "NOT_FOUND", "NFT não encontrado.");
      const body: ReviewListResponse = {
        items: buildReviews(nft.id, nft.reviewCount, nft.rating),
        average: nft.rating,
        total: nft.reviewCount,
      };
      return HttpResponse.json(body);
    }),
  ),

  /* ------------------------------- favoritos ------------------------------ */

  http.get(
    api("/favorites"),
    withConditions(({ request }) => {
      const { record } = requireAuth(request);
      return HttpResponse.json({ nftIds: db().favorites[record.user.id] ?? [] });
    }),
  ),

  http.put(
    api("/favorites/:nftId"),
    withConditions(({ request, params }) => {
      const { record } = requireAuth(request);
      const nftId = String(params.nftId);
      if (!findNft(nftId)) throw new DomainError(404, "NOT_FOUND", "NFT não encontrado.");
      const state = db();
      const list = state.favorites[record.user.id] ?? [];
      if (!list.includes(nftId)) state.favorites[record.user.id] = [...list, nftId];
      commit();
      return HttpResponse.json({ nftIds: state.favorites[record.user.id] });
    }),
  ),

  http.delete(
    api("/favorites/:nftId"),
    withConditions(({ request, params }) => {
      const { record } = requireAuth(request);
      const state = db();
      state.favorites[record.user.id] = (state.favorites[record.user.id] ?? []).filter((id) => id !== String(params.nftId));
      commit();
      return HttpResponse.json({ nftIds: state.favorites[record.user.id] });
    }),
  ),
];
