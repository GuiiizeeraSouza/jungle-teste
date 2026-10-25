import {
  Cart,
  CurrentSessionResponse,
  FavoritesResponse,
  FeaturedResponse,
  IDEMPOTENCY_HEADER,
  NftDetail,
  NftListResponse,
  Order,
  OrderListResponse,
  Quote,
  ReviewListResponse,
  SessionResponse,
  User,
  WalletConnection,
  WalletsResponse,
  type AddCartItemInput,
  type CreateOrderInput,
  type LoginInput,
  type Network,
  type NftListParams,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type RegisterInput,
  type SecondaryWalletInput,
  type WalletConnectionInput,
  type WalletInput,
} from "@/contracts";
import { request, requestVoid } from "./http";

type Signal = { signal?: AbortSignal };

/** Serializa os parâmetros do catálogo exatamente como a API espera. */
export function toListQuery(params: NftListParams) {
  const query: Record<string, string> = {};
  if (params.q) query.q = params.q;
  if (params.categories?.length) query.category = params.categories.join(",");
  if (params.networks?.length) query.network = params.networks.join(",");
  if (params.minPrice) query.minPrice = params.minPrice;
  if (params.maxPrice) query.maxPrice = params.maxPrice;
  if (params.sort) query.sort = params.sort;
  if (params.tab) query.tab = params.tab;
  if (params.page) query.page = String(params.page);
  if (params.pageSize) query.pageSize = String(params.pageSize);
  if (params.collection) query.collection = params.collection;
  if (params.exclude) query.exclude = params.exclude;
  return query;
}

export const authApi = {
  login: (input: LoginInput) => request(SessionResponse, { method: "POST", url: "/auth/login", data: input }),
  register: (input: RegisterInput) => request(SessionResponse, { method: "POST", url: "/auth/register", data: input }),
  session: ({ signal }: Signal = {}) => request(CurrentSessionResponse, { url: "/auth/session", signal }),
  /** Recebe o token explicitamente: a sessão local já foi encerrada quando a chamada sai. */
  logout: (token: string) => requestVoid({ method: "POST", url: "/auth/logout", headers: { Authorization: `Bearer ${token}` } }),
};

export const catalogApi = {
  list: (params: NftListParams, { signal }: Signal = {}) => request(NftListResponse, { url: "/nfts", params: toListQuery(params), signal }),
  featured: ({ signal }: Signal = {}) => request(FeaturedResponse, { url: "/nfts/featured", signal }),
  detail: (id: string, { signal }: Signal = {}) => request(NftDetail, { url: `/nfts/${encodeURIComponent(id)}`, signal }),
  reviews: (id: string, { signal }: Signal = {}) => request(ReviewListResponse, { url: `/nfts/${encodeURIComponent(id)}/reviews`, signal }),
};

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => request(FavoritesResponse, { url: "/favorites", signal }),
  add: (nftId: string) => request(FavoritesResponse, { method: "PUT", url: `/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) => request(FavoritesResponse, { method: "DELETE", url: `/favorites/${encodeURIComponent(nftId)}` }),
};

export const cartApi = {
  get: ({ signal }: Signal = {}) => request(Cart, { url: "/cart", signal }),
  addItem: (input: AddCartItemInput) => request(Cart, { method: "POST", url: "/cart/items", data: input }),
  updateItem: (itemId: string, quantity: number) => request(Cart, { method: "PATCH", url: `/cart/items/${itemId}`, data: { quantity } }),
  removeItem: (itemId: string) => request(Cart, { method: "DELETE", url: `/cart/items/${itemId}` }),
  applyCoupon: (code: string) => request(Cart, { method: "PUT", url: "/cart/coupon", data: { code } }),
  removeCoupon: () => request(Cart, { method: "DELETE", url: "/cart/coupon" }),
  acknowledge: () => request(Cart, { method: "POST", url: "/cart/acknowledge" }),
  /** Token explícito: a mesclagem acontece antes de a sessão ficar visível para a UI. */
  merge: (guestCartId: string, token: string) =>
    request(Cart, { method: "POST", url: "/cart/merge", data: { guestCartId }, headers: { Authorization: `Bearer ${token}` } }),
};

export const quoteApi = {
  create: (network: Network, { signal }: Signal = {}) => request(Quote, { method: "POST", url: "/quote", data: { network }, signal }),
};

export const walletConnectionApi = {
  connect: (input: WalletConnectionInput) => request(WalletConnection, { method: "POST", url: "/wallet-connections", data: input }),
  disconnect: (id: string) => requestVoid({ method: "DELETE", url: `/wallet-connections/${id}` }),
};

export const ordersApi = {
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    request(Order, {
      method: "POST",
      url: "/orders",
      data: input,
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      timeout: 8_000,
    }),
  get: (id: string, { signal }: Signal = {}) => request(Order, { url: `/orders/${encodeURIComponent(id)}`, signal }),
  pending: ({ signal }: Signal = {}) => request(OrderListResponse, { url: "/orders", params: { status: "pending" }, signal }),
};

export const profileApi = {
  get: ({ signal }: Signal = {}) => request(User, { url: "/me/profile", signal }),
  update: (input: ProfileUpdateInput) => request(User, { method: "PATCH", url: "/me/profile", data: input }),
  setAvatar: (dataUrl: string) => request(User, { method: "PUT", url: "/me/avatar", data: { dataUrl } }),
  removeAvatar: () => request(User, { method: "DELETE", url: "/me/avatar" }),
  changePassword: (input: PasswordChangeInput) => requestVoid({ method: "POST", url: "/me/password", data: input }),
};

export const walletsApi = {
  get: ({ signal }: Signal = {}) => request(WalletsResponse, { url: "/me/wallets", signal }),
  savePrimary: (input: WalletInput) => request(WalletsResponse, { method: "PUT", url: "/me/wallets/primary", data: input }),
  saveSecondary: (input: SecondaryWalletInput) => request(WalletsResponse, { method: "PUT", url: "/me/wallets/secondary", data: input }),
  removeSecondary: () => request(WalletsResponse, { method: "DELETE", url: "/me/wallets/secondary" }),
};
