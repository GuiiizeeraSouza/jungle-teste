import { z } from "zod";
import { EthAmount } from "./common";
import { EditionId } from "./nft";
import { OrderStatus } from "./commerce";

/**
 * Envelope de todos os eventos Socket.IO.
 * - `id`: identidade estável do evento (deduplicação)
 * - `resource`: recurso afetado
 * - `version`: versão monotônica do recurso após a mudança (ordenação)
 * - `userId`: dono do recurso, quando privado (isolamento entre sessões)
 */
function envelope<TType extends string, TResource extends string, TData extends z.ZodTypeAny>(
  type: TType,
  resource: TResource,
  data: TData,
) {
  return z.object({
    id: z.string(),
    type: z.literal(type),
    resource: z.object({ type: z.literal(resource), id: z.string() }),
    version: z.number().int().min(1),
    occurredAt: z.string(),
    userId: z.string().nullable(),
    data,
  });
}

export const NftUpdatedEvent = envelope(
  "nft.updated",
  "nft",
  z.object({
    nftId: z.string(),
    name: z.string(),
    price: EthAmount,
    compareAtPrice: EthAmount.nullable(),
    available: z.number().int().min(0),
    editions: z.array(z.object({ id: EditionId, price: EthAmount, available: z.number().int().min(0) })),
    reason: z.enum(["price", "availability", "price_and_availability"]),
  }),
);
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>;

export const OrderUpdatedEvent = envelope(
  "order.updated",
  "order",
  z.object({
    orderId: z.string(),
    status: OrderStatus,
    txHash: z.string().nullable(),
    explorerUrl: z.string().nullable(),
    failureReason: z.string().nullable(),
  }),
);
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>;

export const RealtimeEvent = z.discriminatedUnion("type", [NftUpdatedEvent, OrderUpdatedEvent]);
export type RealtimeEvent = z.infer<typeof RealtimeEvent>;

export const REALTIME_EVENTS = ["nft.updated", "order.updated"] as const;
