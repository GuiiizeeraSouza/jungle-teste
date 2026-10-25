import type { Network, NftListParams } from "@/contracts";

/**
 * Chaves de cache. Dados privados ficam sob ["private", userId, ...] para
 * isolar usuários e permitir limpar tudo de uma sessão em uma única operação.
 * O carrinho do visitante é isolado pelo id do carrinho.
 */
export const qk = {
  nfts: ["nfts"] as const,
  nftList: (params: NftListParams) => ["nfts", "list", params] as const,
  nftLists: ["nfts", "list"] as const,
  featured: ["nfts", "featured"] as const,
  nft: (id: string) => ["nfts", "detail", id] as const,
  reviews: (id: string) => ["nfts", "reviews", id] as const,

  session: ["session"] as const,

  private: (userId: string) => ["private", userId] as const,
  allPrivate: ["private"] as const,
  favorites: (userId: string) => ["private", userId, "favorites"] as const,
  profile: (userId: string) => ["private", userId, "profile"] as const,
  wallets: (userId: string) => ["private", userId, "wallets"] as const,
  orders: (userId: string) => ["private", userId, "orders"] as const,
  order: (userId: string, orderId: string) => ["private", userId, "orders", "detail", orderId] as const,
  pendingOrders: (userId: string) => ["private", userId, "orders", "pending"] as const,

  /** owner: "user:<id>" | "guest:<cartId>" | "guest:new" */
  cart: (owner: string) => ["cart", owner] as const,
  carts: ["cart"] as const,
  quote: (owner: string, network: Network) => ["quote", owner, network] as const,
  quotes: ["quote"] as const,
};
