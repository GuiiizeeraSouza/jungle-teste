import { z } from "zod";

/**
 * Valores em ETH trafegam SEMPRE como string decimal (ex.: "1.19", "0.016").
 * Nunca convertidos para number no transporte — os cálculos usam big.js.
 */
export const EthAmount = z.string().regex(/^\d+(\.\d+)?$/, "Valor ETH inválido");
export type EthAmount = z.infer<typeof EthAmount>;

export const Network = z.enum(["ethereum", "polygon", "solana"]);
export type Network = z.infer<typeof Network>;

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
};

export const WalletType = z.enum(["walletconnect", "metamask", "coinbase"]);
export type WalletType = z.infer<typeof WalletType>;

export const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  walletconnect: "WalletConnect",
  metamask: "MetaMask",
  coinbase: "Coinbase Wallet",
};

export const ImageRef = z.object({
  src: z.string(),
  alt: z.string(),
});
export type ImageRef = z.infer<typeof ImageRef>;

/** Códigos de erro estáveis. A UI decide mensagens e recuperação a partir deles. */
export const ErrorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "SESSION_INVALID",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "EMAIL_TAKEN",
  "USERNAME_TAKEN",
  "AVAILABILITY_CONFLICT",
  "EDITION_UNAVAILABLE",
  "QUANTITY_LIMIT",
  "COUPON_INVALID",
  "COUPON_EXPIRED",
  "QUOTE_STALE",
  "IDEMPOTENCY_CONFLICT",
  "WALLET_REJECTED",
  "WALLET_NOT_CONNECTED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Erros por campo (validação de formulário). */
    fields: z.record(z.string(), z.string()).optional(),
    /** Dados extras específicos do código (ex.: nova cotação em QUOTE_STALE). */
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  });
}
