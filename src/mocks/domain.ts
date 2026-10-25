import type {
  Cart,
  CartItem,
  CartNotice,
  CatalogFacets,
  CreateOrderInput,
  EditionId,
  ErrorCode,
  Network,
  NftDetail,
  NftListResponse,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderStatus,
  Quote,
  QuoteIssue,
  QuoteLine,
} from "@/contracts";
import { CATEGORY_LABEL, Category, NETWORK_LABEL } from "@/contracts";
import { eth } from "@/lib/eth";
import { COUPONS, NETWORK_FEES, type CouponDefinition } from "./fixtures";
import { commit, db, nextId, type CartRecord, type NftRecord, type OrderRecord } from "./db";
import { getConfig } from "./config";
import { publish } from "./realtime";

/* ------------------------------------------------------------------------ */
/* Erros de domínio → convertidos em respostas HTTP pelos handlers          */
/* ------------------------------------------------------------------------ */

export class DomainError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public extra: { fields?: Record<string, string>; details?: unknown } = {},
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------------ */
/* Catálogo                                                                 */
/* ------------------------------------------------------------------------ */

export function findNft(id: string) {
  return db().nfts.find((n) => n.id === id);
}

function defaultEdition(nft: NftRecord) {
  return nft.editions.find((e) => e.id === nft.defaultEditionId) ?? nft.editions[0]!;
}

function totalAvailable(nft: NftRecord) {
  return nft.editions.reduce((sum, e) => sum + e.available, 0);
}

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    image: nft.image,
    price: defaultEdition(nft).price,
    compareAtPrice: nft.compareAtPrice,
    defaultEditionId: nft.defaultEditionId,
    rare: nft.rare,
    isNew: nft.isNew,
    trending: nft.trending,
    rating: nft.rating,
    reviewCount: nft.reviewCount,
    listedAt: nft.listedAt,
    available: totalAvailable(nft),
    version: nft.version,
  };
}

export function toDetail(nft: NftRecord): NftDetail {
  return {
    ...toSummary(nft),
    description: nft.description,
    longDescription: nft.longDescription,
    attributes: nft.attributes,
    creator: nft.creator,
    royaltyPercent: nft.royaltyPercent,
    contractAddress: nft.contractAddress,
    contractStandard: nft.contractStandard,
    storage: nft.storage,
    gallery: nft.gallery,
    editions: nft.editions,
  };
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface ListQuery {
  q?: string;
  categories: string[];
  networks: string[];
  minPrice?: string;
  maxPrice?: string;
  sort: string;
  tab: string;
  page: number;
  pageSize: number;
  collection?: string;
  exclude?: string;
}

export function listNfts(query: ListQuery): NftListResponse {
  const all = getConfig().scenario === "empty-catalog" ? [] : db().nfts;

  // Busca + aba definem a base dos facets (contagens das categorias/redes).
  const term = query.q ? normalize(query.q.trim()) : "";
  const base = all.filter((n) => {
    if (term) {
      const haystack = normalize(`${n.name} ${n.collection} ${CATEGORY_LABEL[n.category]} ${n.tokenId}`);
      if (!haystack.includes(term)) return false;
    }
    if (query.tab === "new" && !n.isNew) return false;
    if (query.tab === "trending" && !n.trending) return false;
    if (query.collection && n.collection !== query.collection) return false;
    if (query.exclude && n.id === query.exclude) return false;
    return true;
  });

  const filtered = base.filter((n) => {
    const price = defaultEdition(n).price;
    if (query.categories.length && !query.categories.includes(n.category)) return false;
    if (query.networks.length && !query.networks.includes(n.network)) return false;
    if (query.minPrice && eth.cmp(price, query.minPrice) < 0) return false;
    if (query.maxPrice && eth.cmp(price, query.maxPrice) > 0) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "price-asc":
        return eth.cmp(defaultEdition(a).price, defaultEdition(b).price) || a.name.localeCompare(b.name);
      case "price-desc":
        return eth.cmp(defaultEdition(b).price, defaultEdition(a).price) || a.name.localeCompare(b.name);
      case "rating":
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return b.listedAt.localeCompare(a.listedAt);
    }
  });

  const total = sorted.length;
  const totalPages = Math.ceil(total / query.pageSize);
  const start = (query.page - 1) * query.pageSize;
  const items = sorted.slice(start, start + query.pageSize).map(toSummary);

  const facets: CatalogFacets = {
    categories: Category.options.map((id) => ({
      id,
      label: CATEGORY_LABEL[id],
      count: base.filter((n) => n.category === id).length,
    })),
    networks: (Object.keys(NETWORK_LABEL) as Network[]).map((id) => ({
      id,
      label: NETWORK_LABEL[id],
      count: base.filter((n) => n.network === id).length,
    })),
    price: priceRange(all),
  };

  return { items, page: query.page, pageSize: query.pageSize, total, totalPages, facets };
}

function priceRange(nfts: NftRecord[]) {
  if (!nfts.length) return { min: "0", max: "0" };
  let min = defaultEdition(nfts[0]!).price;
  let max = min;
  for (const n of nfts) {
    min = eth.min(min, defaultEdition(n).price);
    max = eth.max(max, defaultEdition(n).price);
  }
  return { min, max };
}

/* ------------------------------------------------------------------------ */
/* Atualização de NFTs (preço/disponibilidade) → REST + evento nft.updated */
/* ------------------------------------------------------------------------ */

export function updateNft(nftId: string, changes: Array<{ editionId: EditionId; price?: string; available?: number; delta?: number }>) {
  const nft = findNft(nftId);
  if (!nft) throw new DomainError(404, "NOT_FOUND", "NFT não encontrado");
  let priceChanged = false;
  let availabilityChanged = false;
  for (const change of changes) {
    const edition = nft.editions.find((e) => e.id === change.editionId);
    if (!edition) continue;
    if (change.price !== undefined && !eth.eq(change.price, edition.price)) {
      edition.price = eth.normalize(change.price);
      priceChanged = true;
    }
    const nextAvailable =
      change.available !== undefined ? change.available : change.delta !== undefined ? edition.available + change.delta : undefined;
    if (nextAvailable !== undefined && nextAvailable !== edition.available) {
      edition.available = Math.max(0, Math.min(edition.supply, nextAvailable));
      availabilityChanged = true;
    }
  }
  if (!priceChanged && !availabilityChanged) return nft;
  nft.version += 1;
  commit();
  publishNftUpdated(nft, priceChanged && availabilityChanged ? "price_and_availability" : priceChanged ? "price" : "availability");
  return nft;
}

export function buildNftEvent(nft: NftRecord, reason: NftUpdatedEvent["data"]["reason"], version = nft.version): NftUpdatedEvent {
  return {
    id: nextId("evt"),
    type: "nft.updated",
    resource: { type: "nft", id: nft.id },
    version,
    occurredAt: new Date().toISOString(),
    userId: null,
    data: {
      nftId: nft.id,
      name: nft.name,
      price: defaultEdition(nft).price,
      compareAtPrice: nft.compareAtPrice,
      available: totalAvailable(nft),
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
      reason,
    },
  };
}

function publishNftUpdated(nft: NftRecord, reason: NftUpdatedEvent["data"]["reason"]) {
  publish(buildNftEvent(nft, reason));
  commit();
}

/* ------------------------------------------------------------------------ */
/* Carrinho                                                                 */
/* ------------------------------------------------------------------------ */

export function findCartForUser(userId: string) {
  const state = db();
  let cart = state.carts.find((c) => c.ownerId === userId);
  if (!cart) {
    cart = { id: nextId("cart"), ownerId: userId, items: [], couponCode: null, version: 1, updatedAt: new Date().toISOString() };
    state.carts.push(cart);
    commit();
  }
  return cart;
}

const GUEST_CART_ID = /^guest_[A-Za-z0-9-]{8,64}$/;

export function findOrCreateGuestCart(cartId: string | null) {
  const state = db();
  const existing = cartId ? state.carts.find((c) => c.id === cartId && c.ownerId === null) : undefined;
  if (existing) return existing;
  // Adota o id gerado pelo cliente (idempotente entre requisições concorrentes).
  const id = cartId && GUEST_CART_ID.test(cartId) && !state.carts.some((c) => c.id === cartId) ? cartId : nextId("cart");
  const cart: CartRecord = { id, ownerId: null, items: [], couponCode: null, version: 1, updatedAt: new Date().toISOString() };
  state.carts.push(cart);
  commit();
  return cart;
}

function touch(cart: CartRecord) {
  cart.version += 1;
  cart.updatedAt = new Date().toISOString();
  commit();
}

function editionOf(nftId: string, editionId: EditionId) {
  const nft = findNft(nftId);
  const edition = nft?.editions.find((e) => e.id === editionId);
  return { nft, edition };
}

function couponDefinition(code: string | null): CouponDefinition | undefined {
  if (!code) return undefined;
  return COUPONS.find((c) => c.code === code.toUpperCase());
}

function computeDiscount(subtotal: string, coupon: CouponDefinition | undefined) {
  if (!coupon || eth.isZero(subtotal)) return "0";
  if (coupon.kind === "percent") return eth.round(eth.mul(subtotal, coupon.value), 6);
  return eth.min(coupon.value, subtotal);
}

function itemNotices(cartItem: CartRecord["items"][number], price: string, available: number): CartNotice[] {
  const notices: CartNotice[] = [];
  if (!eth.eq(price, cartItem.acknowledgedPrice)) {
    notices.push({ type: "price_changed", previousPrice: cartItem.acknowledgedPrice, currentPrice: price });
  }
  if (available === 0) notices.push({ type: "sold_out" });
  else if (available < cartItem.quantity) notices.push({ type: "insufficient_availability", available });
  return notices;
}

/** Quantidade reservada por pedidos pendentes do próprio dono do carrinho. */
function reservedByOwner(ownerId: string | null, nftId: string, editionId: EditionId) {
  if (!ownerId) return 0;
  return db()
    .orders.filter((o) => o.userId === ownerId && o.status === "pending" && o.reserved)
    .reduce((sum, o) => sum + o.lines.filter((l) => l.nftId === nftId && l.editionId === editionId).reduce((s, l) => s + l.quantity, 0), 0);
}

export function serializeCart(cart: CartRecord, network: Network = "ethereum"): Cart {
  const items: CartItem[] = [];
  for (const item of cart.items) {
    const { nft, edition: stored } = editionOf(item.nftId, item.editionId);
    if (!nft || !stored) continue;
    // O que o próprio colecionador reservou num pedido pendente segue "disponível" para ele.
    const edition = { ...stored, available: stored.available + reservedByOwner(cart.ownerId, nft.id, stored.id) };
    items.push({
      id: item.id,
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      quantity: item.quantity,
      unitPrice: edition.price,
      lineTotal: eth.mul(edition.price, item.quantity),
      available: edition.available,
      maxPerOrder: edition.maxPerOrder,
      notices: itemNotices(item, edition.price, edition.available),
    });
  }
  const subtotal = eth.add(...items.map((i) => i.lineTotal));
  const coupon = couponDefinition(cart.couponCode);
  const discount = computeDiscount(subtotal, coupon);
  const networkFee = items.length ? NETWORK_FEES[network] : "0";
  return {
    id: cart.id,
    ownerType: cart.ownerId ? "user" : "guest",
    items,
    coupon: coupon ? { code: coupon.code, description: coupon.description } : null,
    summary: {
      subtotal,
      discount,
      networkFee,
      total: eth.add(eth.sub(subtotal, discount), networkFee),
      network,
      feeEstimated: true,
    },
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    hasBlockingIssues: items.some((i) => i.notices.some((n) => n.type !== "price_changed")),
    version: cart.version,
    updatedAt: cart.updatedAt,
  };
}

function assertQuantity(nftName: string, editionLabel: string, available: number, maxPerOrder: number, quantity: number) {
  if (available === 0) {
    throw new DomainError(409, "EDITION_UNAVAILABLE", `A edição ${editionLabel} de ${nftName} está esgotada.`);
  }
  const limit = Math.min(available, maxPerOrder);
  if (quantity > limit) {
    throw new DomainError(409, "QUANTITY_LIMIT", `Limite de ${limit} unidade(s) para a edição ${editionLabel} de ${nftName}.`, {
      details: { max: limit },
    });
  }
}

export function addCartItem(cart: CartRecord, input: { nftId: string; editionId: EditionId; quantity: number }) {
  const { nft, edition } = editionOf(input.nftId, input.editionId);
  if (!nft) throw new DomainError(404, "NOT_FOUND", "NFT não encontrado");
  if (!edition) throw new DomainError(404, "NOT_FOUND", "Edição não encontrada");
  const existing = cart.items.find((i) => i.nftId === input.nftId && i.editionId === input.editionId);
  const quantity = (existing?.quantity ?? 0) + input.quantity;
  assertQuantity(nft.name, edition.label, edition.available, edition.maxPerOrder, quantity);
  if (existing) {
    existing.quantity = quantity;
    existing.acknowledgedPrice = edition.price;
  } else {
    cart.items.push({ id: nextId("item"), nftId: nft.id, editionId: edition.id, quantity, acknowledgedPrice: edition.price });
  }
  touch(cart);
}

export function updateCartItem(cart: CartRecord, itemId: string, quantity: number) {
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new DomainError(404, "NOT_FOUND", "Item não está mais no carrinho");
  const { nft, edition } = editionOf(item.nftId, item.editionId);
  if (!nft || !edition) throw new DomainError(404, "NOT_FOUND", "NFT não encontrado");
  // Reduzir sempre é permitido (resolve conflitos de disponibilidade).
  if (quantity > item.quantity) assertQuantity(nft.name, edition.label, edition.available, edition.maxPerOrder, quantity);
  item.quantity = quantity;
  touch(cart);
}

export function removeCartItem(cart: CartRecord, itemId: string) {
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.id !== itemId);
  if (cart.items.length === before) throw new DomainError(404, "NOT_FOUND", "Item não está mais no carrinho");
  touch(cart);
}

export function acknowledgeCart(cart: CartRecord) {
  for (const item of cart.items) {
    const { edition } = editionOf(item.nftId, item.editionId);
    if (edition) item.acknowledgedPrice = edition.price;
  }
  touch(cart);
}

export function applyCoupon(cart: CartRecord, code: string) {
  const coupon = couponDefinition(code.trim());
  if (!coupon) {
    throw new DomainError(422, "COUPON_INVALID", "Código promocional inválido.", { fields: { code: "Código promocional inválido" } });
  }
  if (new Date(coupon.expiresAt).getTime() < Date.now()) {
    throw new DomainError(422, "COUPON_EXPIRED", "Este código promocional expirou.", {
      fields: { code: "Este código promocional expirou" },
    });
  }
  cart.couponCode = coupon.code;
  touch(cart);
}

export function removeCoupon(cart: CartRecord) {
  cart.couponCode = null;
  touch(cart);
}

/** Preserva os itens do visitante ao autenticar (respeitando limites). */
export function mergeGuestCart(userCart: CartRecord, guestCartId: string) {
  const state = db();
  const guest = state.carts.find((c) => c.id === guestCartId && c.ownerId === null);
  if (!guest) return;
  for (const item of guest.items) {
    const { edition } = editionOf(item.nftId, item.editionId);
    if (!edition) continue;
    const limit = Math.min(edition.available, edition.maxPerOrder);
    const existing = userCart.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId);
    if (existing) existing.quantity = Math.max(1, Math.min(limit || existing.quantity, existing.quantity + item.quantity));
    else userCart.items.push({ ...item, id: nextId("item"), quantity: Math.max(1, Math.min(limit || item.quantity, item.quantity)) });
  }
  if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode;
  state.carts = state.carts.filter((c) => c.id !== guest.id);
  touch(userCart);
}

/* ------------------------------------------------------------------------ */
/* Cotação                                                                  */
/* ------------------------------------------------------------------------ */

/** FNV-1a 32 bits — identifica deterministicamente o conteúdo da cotação. */
function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeQuote(cart: CartRecord, network: Network): Quote {
  const serialized = serializeCart(cart, network);
  const lines: QuoteLine[] = serialized.items.map((i) => ({
    cartItemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    editionLabel: i.editionLabel,
    name: i.name,
    tokenId: i.tokenId,
    image: i.image,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  }));
  const issues: QuoteIssue[] = [];
  for (const item of serialized.items) {
    for (const notice of item.notices) {
      if (notice.type === "sold_out") {
        issues.push({ cartItemId: item.id, nftId: item.nftId, type: "sold_out", message: `${item.name} (${item.editionLabel}) esgotou.` });
      } else if (notice.type === "insufficient_availability") {
        issues.push({
          cartItemId: item.id,
          nftId: item.nftId,
          type: "insufficient_availability",
          message: `Restam apenas ${notice.available} unidade(s) de ${item.name} (${item.editionLabel}).`,
        });
      }
    }
  }
  const { subtotal, discount, networkFee, total } = serialized.summary;
  const fingerprint = JSON.stringify([
    lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]),
    serialized.coupon?.code ?? null,
    network,
    discount,
    networkFee,
    total,
  ]);
  const now = Date.now();
  return {
    id: `q_${fnv1a(fingerprint)}`,
    network,
    lines,
    coupon: serialized.coupon,
    subtotal,
    discount,
    networkFee,
    total,
    issues,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
  };
}

/* ------------------------------------------------------------------------ */
/* Pedidos                                                                  */
/* ------------------------------------------------------------------------ */

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function serializeOrder(order: OrderRecord): Order {
  const {
    userId: _userId,
    cartId: _cartId,
    idempotencyKey: _key,
    fingerprint: _fp,
    resolveAt: _resolveAt,
    reserved: _reserved,
    ...publicOrder
  } = order;
  return publicOrder;
}

/** Gatilhos dos cenários de corrida na confirmação (disparam uma vez por reset). */
function runCheckoutScenarioTriggers(cart: CartRecord) {
  const state = db();
  const { scenario } = getConfig();
  const first = cart.items[0];
  if (!first) return;
  if (scenario === "price-change-checkout" && !state.triggers.priceChange) {
    state.triggers.priceChange = true;
    const { edition } = editionOf(first.nftId, first.editionId);
    if (edition) updateNft(first.nftId, [{ editionId: first.editionId, price: eth.add(edition.price, "0.10") }]);
  }
  if (scenario === "sold-out-checkout" && !state.triggers.soldOut) {
    state.triggers.soldOut = true;
    updateNft(first.nftId, [{ editionId: first.editionId, available: 0 }]);
  }
}

export function createOrder(params: {
  userId: string;
  cart: CartRecord;
  input: CreateOrderInput;
  idempotencyKey: string;
  fingerprint: string;
}): { order: OrderRecord; replayed: boolean } {
  const state = db();
  const { userId, cart, input, idempotencyKey, fingerprint } = params;

  // Idempotência: mesma chave + mesmo conteúdo → mesmo pedido; conteúdo diferente → conflito.
  const previous = state.orders.find((o) => o.userId === userId && o.idempotencyKey === idempotencyKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "Esta chave de idempotência já foi usada com outro conteúdo.");
    }
    return { order: previous, replayed: true };
  }

  const pending = state.orders.find((o) => o.userId === userId && o.status === "pending");
  if (pending) {
    throw new DomainError(409, "CONFLICT", "Você já tem um pedido em processamento. Aguarde a confirmação.", {
      details: { orderId: pending.id },
    });
  }

  const connection = state.connections.find((c) => c.id === input.walletConnectionId && c.userId === userId && c.active);
  if (!connection) {
    throw new DomainError(409, "WALLET_NOT_CONNECTED", "A carteira foi desconectada. Conecte novamente para confirmar a compra.");
  }

  runCheckoutScenarioTriggers(cart);

  const quote = computeQuote(cart, input.network);
  if (!quote.lines.length) throw new DomainError(422, "VALIDATION_ERROR", "Seu carrinho está vazio.");
  if (quote.issues.length) {
    throw new DomainError(409, "AVAILABILITY_CONFLICT", "A disponibilidade de alguns itens mudou.", { details: { quote } });
  }
  if (quote.id !== input.quoteId) {
    throw new DomainError(409, "QUOTE_STALE", "Os valores da compra mudaram. Revise e confirme novamente.", { details: { quote } });
  }

  // Reserva o estoque enquanto o pedido está pendente.
  const touched = new Set<string>();
  for (const line of quote.lines) {
    const { edition } = editionOf(line.nftId, line.editionId);
    if (edition) {
      edition.available -= line.quantity;
      touched.add(line.nftId);
    }
  }

  const now = new Date().toISOString();
  const { scenario, orderProcessingMs } = getConfig();
  const order: OrderRecord = {
    id: nextId("ord"),
    status: "pending",
    quoteId: quote.id,
    lines: quote.lines.map(({ cartItemId: _id, ...line }) => line),
    coupon: quote.coupon,
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
    network: input.network,
    wallet: { type: input.walletType, address: input.walletAddress },
    buyer: input.buyer,
    txHash: null,
    explorerUrl: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
    version: 1,
    userId,
    cartId: cart.id,
    idempotencyKey,
    fingerprint,
    resolveAt: scenario === "manual-orders" ? null : Date.now() + orderProcessingMs,
    reserved: true,
  };
  state.orders.push(order);
  for (const nftId of touched) {
    const nft = findNft(nftId)!;
    nft.version += 1;
    publishNftUpdated(nft, "availability");
  }
  commit();
  scheduleResolution(order);
  return { order, replayed: false };
}

export function scheduleResolution(order: OrderRecord) {
  if (order.status !== "pending" || order.resolveAt === null || timers.has(order.id)) return;
  const wait = Math.max(0, order.resolveAt - Date.now());
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id);
      resolveOrder(order.id, getConfig().scenario === "payment-declined" ? "rejected" : "confirmed");
    }, wait),
  );
}

/** Reagenda pedidos pendentes após refresh (o timer anterior se perdeu). */
export function resumePendingOrders() {
  for (const order of db().orders) scheduleResolution(order);
}

function explorerUrl(network: Network, txHash: string) {
  if (network === "polygon") return `https://polygonscan.com/tx/${txHash}`;
  if (network === "solana") return `https://solscan.io/tx/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}

export function resolveOrder(orderId: string, outcome: Exclude<OrderStatus, "pending">) {
  const state = db();
  const order = state.orders.find((o) => o.id === orderId);
  // Estados terminais são imutáveis.
  if (!order || order.status !== "pending") return order;

  const now = new Date().toISOString();
  if (outcome === "confirmed") {
    const txHash = `0x${Array.from({ length: 8 }, (_, i) => fnv1a(`${order.id}:${order.quoteId}:${i}`)).join("")}`;
    order.status = "confirmed";
    order.txHash = txHash;
    order.explorerUrl = explorerUrl(order.network, txHash);
    order.confirmedAt = now;
    // Remove do carrinho apenas os itens e quantidades comprados.
    const cart = state.carts.find((c) => c.ownerId === order.userId);
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId);
        if (!item) continue;
        item.quantity -= line.quantity;
      }
      cart.items = cart.items.filter((i) => i.quantity > 0);
      if (!cart.items.length) cart.couponCode = null;
      touch(cart);
    }
  } else {
    order.status = "rejected";
    order.failureReason = "A rede recusou o pagamento: a assinatura da transação não foi autorizada.";
    // Libera a reserva.
    const touched = new Set<string>();
    for (const line of order.lines) {
      const { edition } = editionOf(line.nftId, line.editionId);
      if (edition) {
        edition.available = Math.min(edition.supply, edition.available + line.quantity);
        touched.add(line.nftId);
      }
    }
    for (const nftId of touched) {
      const nft = findNft(nftId)!;
      nft.version += 1;
      publishNftUpdated(nft, "availability");
    }
  }
  order.reserved = false;
  order.updatedAt = now;
  order.version += 1;
  commit();

  publish({
    id: nextId("evt"),
    type: "order.updated",
    resource: { type: "order", id: order.id },
    version: order.version,
    occurredAt: now,
    userId: order.userId,
    data: {
      orderId: order.id,
      status: order.status,
      txHash: order.txHash,
      explorerUrl: order.explorerUrl,
      failureReason: order.failureReason,
    },
  });
  return order;
}

export function clearOrderTimers() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
