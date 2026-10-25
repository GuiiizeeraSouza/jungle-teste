import { z } from "zod";
import { EthAmount, ImageRef, Network, WalletType } from "./common";
import { EditionId } from "./nft";

/* ----------------------------------------------------------------------------
 * Favoritos
 * ------------------------------------------------------------------------- */

export const FavoritesResponse = z.object({ nftIds: z.array(z.string()) });
export type FavoritesResponse = z.infer<typeof FavoritesResponse>;

/* ----------------------------------------------------------------------------
 * Carrinho
 * ------------------------------------------------------------------------- */

export const CartNotice = z.discriminatedUnion("type", [
  z.object({ type: z.literal("price_changed"), previousPrice: EthAmount, currentPrice: EthAmount }),
  z.object({ type: z.literal("insufficient_availability"), available: z.number().int() }),
  z.object({ type: z.literal("sold_out") }),
]);
export type CartNotice = z.infer<typeof CartNotice>;

export const CartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: EditionId,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: ImageRef,
  quantity: z.number().int().min(1),
  unitPrice: EthAmount,
  lineTotal: EthAmount,
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1),
  notices: z.array(CartNotice),
});
export type CartItem = z.infer<typeof CartItem>;

export const Coupon = z.object({
  code: z.string(),
  description: z.string(),
});
export type Coupon = z.infer<typeof Coupon>;

export const PriceSummary = z.object({
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  network: Network,
  feeEstimated: z.boolean(),
});
export type PriceSummary = z.infer<typeof PriceSummary>;

export const Cart = z.object({
  id: z.string(),
  ownerType: z.enum(["guest", "user"]),
  items: z.array(CartItem),
  coupon: Coupon.nullable(),
  summary: PriceSummary,
  itemCount: z.number().int().min(0),
  hasBlockingIssues: z.boolean(),
  version: z.number().int(),
  updatedAt: z.string(),
});
export type Cart = z.infer<typeof Cart>;

export const AddCartItemInput = z.object({
  nftId: z.string(),
  editionId: EditionId,
  quantity: z.number().int().min(1).max(100),
});
export type AddCartItemInput = z.infer<typeof AddCartItemInput>;

export const UpdateCartItemInput = z.object({ quantity: z.number().int().min(1).max(100) });
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInput>;

export const ApplyCouponInput = z.object({
  code: z.string().trim().min(1, "Informe o código promocional").max(24, "Código muito longo"),
});
export type ApplyCouponInput = z.infer<typeof ApplyCouponInput>;

/* ----------------------------------------------------------------------------
 * Cotação (referência para finalizar o pedido)
 * ------------------------------------------------------------------------- */

export const QuoteLine = z.object({
  cartItemId: z.string(),
  nftId: z.string(),
  editionId: EditionId,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: ImageRef,
  quantity: z.number().int().min(1),
  unitPrice: EthAmount,
  lineTotal: EthAmount,
});
export type QuoteLine = z.infer<typeof QuoteLine>;

export const QuoteIssue = z.object({
  cartItemId: z.string(),
  nftId: z.string(),
  type: z.enum(["price_changed", "insufficient_availability", "sold_out"]),
  message: z.string(),
});
export type QuoteIssue = z.infer<typeof QuoteIssue>;

export const QuoteInput = z.object({ network: Network });
export type QuoteInput = z.infer<typeof QuoteInput>;

export const Quote = z.object({
  /** Identificador determinístico do conteúdo cotado (linhas, preços, cupom, rede, taxas). */
  id: z.string(),
  network: Network,
  lines: z.array(QuoteLine),
  coupon: Coupon.nullable(),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  issues: z.array(QuoteIssue),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type Quote = z.infer<typeof Quote>;

/* ----------------------------------------------------------------------------
 * Pedidos
 * ------------------------------------------------------------------------- */

export const OrderStatus = z.enum(["pending", "confirmed", "rejected"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const BuyerInfo = z.object({
  displayName: z.string(),
  username: z.string(),
  email: z.string(),
  profileName: z.string(),
  referralCode: z.string(),
  ensName: z.string(),
  secondaryAddress: z.string().nullable(),
  note: z.string().max(500).nullable(),
});
export type BuyerInfo = z.infer<typeof BuyerInfo>;

export const CreateOrderInput = z.object({
  quoteId: z.string(),
  network: Network,
  walletConnectionId: z.string(),
  walletType: WalletType,
  walletAddress: z.string(),
  buyer: BuyerInfo,
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export const OrderLine = QuoteLine.omit({ cartItemId: true });
export type OrderLine = z.infer<typeof OrderLine>;

export const Order = z.object({
  id: z.string(),
  status: OrderStatus,
  quoteId: z.string(),
  lines: z.array(OrderLine),
  coupon: Coupon.nullable(),
  subtotal: EthAmount,
  discount: EthAmount,
  networkFee: EthAmount,
  total: EthAmount,
  network: Network,
  wallet: z.object({ type: WalletType, address: z.string() }),
  buyer: BuyerInfo,
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
  version: z.number().int().min(1),
});
export type Order = z.infer<typeof Order>;

export const OrderListResponse = z.object({ items: z.array(Order) });
export type OrderListResponse = z.infer<typeof OrderListResponse>;

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
