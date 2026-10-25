"use client";

import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import type { NftListParams } from "@/contracts";
import { catalogApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";

export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: qk.nftList(params),
    // O AbortSignal cancela respostas obsoletas quando os parâmetros mudam.
    queryFn: ({ signal }) => catalogApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

export const featuredQuery = () =>
  queryOptions({
    queryKey: qk.featured,
    queryFn: ({ signal }) => catalogApi.featured({ signal }),
    staleTime: 60_000,
  });

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => catalogApi.detail(id, { signal }),
  });

export const reviewsQuery = (id: string) =>
  queryOptions({
    queryKey: qk.reviews(id),
    queryFn: ({ signal }) => catalogApi.reviews(id, { signal }),
    staleTime: 5 * 60_000,
  });

export function useNftList(params: NftListParams, options: { enabled?: boolean } = {}) {
  return useQuery({ ...nftListQuery(params), enabled: options.enabled });
}
