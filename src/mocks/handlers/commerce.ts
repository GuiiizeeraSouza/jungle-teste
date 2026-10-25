import { HttpResponse, http } from "msw";
import { z } from "zod";
import {
  AddCartItemInput,
  ApplyCouponInput,
  CreateOrderInput,
  IDEMPOTENCY_HEADER,
  QuoteInput,
  UpdateCartItemInput,
  WalletConnectionInput,
  isValidAddress,
  type WalletConnection,
} from "@/contracts";
import { getConfig } from "../config";
import { commit, db, nextId } from "../db";
import {
  DomainError,
  acknowledgeCart,
  addCartItem,
  applyCoupon,
  computeQuote,
  createOrder,
  findCartForUser,
  findOrCreateGuestCart,
  mergeGuestCart,
  removeCartItem,
  removeCoupon,
  serializeCart,
  serializeOrder,
  updateCartItem,
} from "../domain";
import { api, authenticate, parseBody, requireAuth, withConditions } from "../http-utils";

export const CART_HEADER = "X-Cart-Id";

/** Carrinho do usuário autenticado ou, para visitantes, o carrinho do header X-Cart-Id. */
function resolveCart(request: Request) {
  const auth = authenticate(request);
  if (auth) return findCartForUser(auth.record.user.id);
  return findOrCreateGuestCart(request.headers.get(CART_HEADER));
}

const cartResponse = (cart: ReturnType<typeof resolveCart>) => HttpResponse.json(serializeCart(cart));

export const commerceHandlers = [
  /* -------------------------------- carrinho ------------------------------ */

  http.get(
    api("/cart"),
    withConditions(({ request }) => cartResponse(resolveCart(request))),
  ),

  http.post(
    api("/cart/items"),
    withConditions(async ({ request }) => {
      const cart = resolveCart(request);
      addCartItem(cart, await parseBody(request, AddCartItemInput));
      return cartResponse(cart);
    }),
  ),

  http.patch(
    api("/cart/items/:itemId"),
    withConditions(async ({ request, params }) => {
      const cart = resolveCart(request);
      const { quantity } = await parseBody(request, UpdateCartItemInput);
      updateCartItem(cart, String(params.itemId), quantity);
      return cartResponse(cart);
    }),
  ),

  http.delete(
    api("/cart/items/:itemId"),
    withConditions(({ request, params }) => {
      const cart = resolveCart(request);
      removeCartItem(cart, String(params.itemId));
      return cartResponse(cart);
    }),
  ),

  http.put(
    api("/cart/coupon"),
    withConditions(async ({ request }) => {
      const cart = resolveCart(request);
      const { code } = await parseBody(request, ApplyCouponInput);
      applyCoupon(cart, code);
      return cartResponse(cart);
    }),
  ),

  http.delete(
    api("/cart/coupon"),
    withConditions(({ request }) => {
      const cart = resolveCart(request);
      removeCoupon(cart);
      return cartResponse(cart);
    }),
  ),

  http.post(
    api("/cart/acknowledge"),
    withConditions(({ request }) => {
      const cart = resolveCart(request);
      acknowledgeCart(cart);
      return cartResponse(cart);
    }),
  ),

  http.post(
    api("/cart/merge"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const { guestCartId } = await parseBody(request, z.object({ guestCartId: z.string() }));
      const cart = findCartForUser(record.user.id);
      mergeGuestCart(cart, guestCartId);
      return cartResponse(cart);
    }),
  ),

  /* -------------------------------- cotação ------------------------------- */

  http.post(
    api("/quote"),
    withConditions(async ({ request }) => {
      const cart = resolveCart(request);
      const { network } = await parseBody(request, QuoteInput);
      return HttpResponse.json(computeQuote(cart, network));
    }),
  ),

  /* ---------------------------- conexão de carteira ----------------------- */

  http.post(
    api("/wallet-connections"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const input = await parseBody(request, WalletConnectionInput);
      if (!isValidAddress(input.address, input.network)) {
        throw new DomainError(422, "VALIDATION_ERROR", "Endereço incompatível com a rede selecionada.", {
          fields: { walletAddress: "Endereço incompatível com a rede selecionada" },
        });
      }
      if (getConfig().scenario === "wallet-reject") {
        throw new DomainError(409, "WALLET_REJECTED", "A conexão foi recusada na carteira.");
      }
      const state = db();
      for (const c of state.connections) if (c.userId === record.user.id) c.active = false;
      const connection = {
        id: nextId("conn"),
        userId: record.user.id,
        walletType: input.walletType,
        network: input.network,
        address: input.address,
        connectedAt: new Date().toISOString(),
        active: true,
      };
      state.connections.push(connection);
      commit();
      const body: WalletConnection = {
        id: connection.id,
        walletType: connection.walletType,
        network: connection.network,
        address: connection.address,
        status: "connected",
        connectedAt: connection.connectedAt,
      };
      return HttpResponse.json(body, { status: 201 });
    }),
  ),

  http.delete(
    api("/wallet-connections/:connectionId"),
    withConditions(({ request, params }) => {
      const { record } = requireAuth(request);
      const connection = db().connections.find((c) => c.id === String(params.connectionId) && c.userId === record.user.id);
      if (connection) {
        connection.active = false;
        commit();
      }
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  /* -------------------------------- pedidos ------------------------------- */

  http.post(
    api("/orders"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const key = request.headers.get(IDEMPOTENCY_HEADER);
      if (!key || key.length < 8) {
        throw new DomainError(422, "VALIDATION_ERROR", `Cabeçalho ${IDEMPOTENCY_HEADER} obrigatório.`);
      }
      const input = await parseBody(request, CreateOrderInput);
      const cart = findCartForUser(record.user.id);
      const { order, replayed } = createOrder({
        userId: record.user.id,
        cart,
        input,
        idempotencyKey: key,
        fingerprint: JSON.stringify(input),
      });

      // Cenário: o pedido é criado, mas a 1ª resposta excede o timeout do cliente.
      const state = db();
      if (!replayed && getConfig().scenario === "order-timeout" && !state.triggers.orderTimeout) {
        state.triggers.orderTimeout = true;
        commit();
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      }
      return HttpResponse.json(serializeOrder(order), {
        status: replayed ? 200 : 202,
        headers: replayed ? { "Idempotent-Replayed": "true" } : undefined,
      });
    }),
  ),

  http.get(
    api("/orders"),
    withConditions(({ request }) => {
      const { record } = requireAuth(request);
      const status = new URL(request.url).searchParams.get("status");
      const items = db()
        .orders.filter((o) => o.userId === record.user.id && (!status || o.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(serializeOrder);
      return HttpResponse.json({ items });
    }),
  ),

  http.get(
    api("/orders/:orderId"),
    withConditions(({ request, params }) => {
      const { record } = requireAuth(request);
      const order = db().orders.find((o) => o.id === String(params.orderId));
      if (!order) throw new DomainError(404, "NOT_FOUND", "Pedido não encontrado.");
      if (order.userId !== record.user.id) throw new DomainError(403, "FORBIDDEN", "Você não tem permissão para ver este pedido.");
      return HttpResponse.json(serializeOrder(order));
    }),
  ),
];
