import type { Edition, EditionId, Network, Order, User, WalletType } from "@/contracts";
import type { Wallet } from "@/contracts";
import { NFT_SEEDS, USER_SEEDS, buildEditions, buildNftContent, listedAtFor } from "./fixtures";

/**
 * "Banco de dados" do backend simulado. Vive no main thread (onde o MSW executa
 * os handlers), é persistido no localStorage para sobreviver a refresh e pode
 * ser restaurado integralmente para o cenário conhecido com `resetDb()`.
 */

export interface NftRecord {
  id: string;
  name: string;
  tokenId: string;
  category: import("@/contracts").Category;
  network: Network;
  image: { src: string; alt: string };
  collection: string;
  attributes: string[];
  description: string;
  longDescription: string[];
  creator: string;
  royaltyPercent: number;
  contractAddress: string;
  contractStandard: string;
  storage: string;
  gallery: import("@/contracts").GalleryItem[];
  compareAtPrice: string | null;
  defaultEditionId: EditionId;
  rare: boolean;
  isNew: boolean;
  trending: boolean;
  rating: number;
  reviewCount: number;
  listedAt: string;
  editions: Edition[];
  version: number;
}

export interface UserRecord {
  user: User;
  passwordHash: string;
  salt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface CartItemRecord {
  id: string;
  nftId: string;
  editionId: EditionId;
  quantity: number;
  /** Último preço que o colecionador viu/aceitou — base do aviso de alteração. */
  acknowledgedPrice: string;
}

export interface CartRecord {
  id: string;
  ownerId: string | null;
  items: CartItemRecord[];
  couponCode: string | null;
  version: number;
  updatedAt: string;
}

export interface OrderRecord extends Order {
  userId: string;
  cartId: string;
  idempotencyKey: string;
  fingerprint: string;
  /** Epoch (ms) em que a simulação resolve o pedido; null = resolução manual. */
  resolveAt: number | null;
  /** Quantidades reservadas por item até o pedido terminar. */
  reserved: boolean;
}

export interface WalletConnectionRecord {
  id: string;
  userId: string;
  walletType: WalletType;
  network: Network;
  address: string;
  connectedAt: string;
  active: boolean;
}

export interface DbState {
  schema: number;
  seq: number;
  nfts: NftRecord[];
  users: UserRecord[];
  sessions: SessionRecord[];
  carts: CartRecord[];
  favorites: Record<string, string[]>;
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>;
  orders: OrderRecord[];
  connections: WalletConnectionRecord[];
  /** Gatilhos de cenário que só disparam uma vez por reset. */
  triggers: Record<string, boolean>;
}

const STORAGE_KEY = "kurio.mock.db";
const SCHEMA = 3;

let state: DbState | null = null;

export function db(): DbState {
  if (!state) throw new Error("Mock DB não inicializado");
  return state;
}

export function nextId(prefix: string) {
  const s = db();
  s.seq += 1;
  return `${prefix}_${String(s.seq).padStart(4, "0")}`;
}

let pendingCommit = false;

function persistNow() {
  pendingCommit = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota/indisponível — mantém em memória */
  }
}

/**
 * Persiste o banco no localStorage. Várias escritas no mesmo tick (uma
 * requisição) viram uma única serialização; `pagehide` garante o flush.
 */
export function commit() {
  if (pendingCommit) return;
  pendingCommit = true;
  queueMicrotask(persistNow);
}

if (typeof window !== "undefined") window.addEventListener("pagehide", () => pendingCommit && persistNow());

/* -------------------------------- senhas -------------------------------- */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes = 16) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

/** PBKDF2-SHA256 — a senha nunca é persistida em claro. */
export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 60_000 },
    key,
    256,
  );
  return toHex(bits);
}

export async function verifyPassword(record: UserRecord, password: string) {
  return (await hashPassword(password, record.salt)) === record.passwordHash;
}

/* --------------------------------- seed --------------------------------- */

function seed(): DbState {
  const nfts: NftRecord[] = NFT_SEEDS.map((s, index) => {
    const content = buildNftContent(s, index);
    return {
      id: s.id,
      name: s.name,
      tokenId: s.tokenId,
      category: s.category,
      network: s.network,
      image: content.image,
      collection: content.collection,
      attributes: content.attributes,
      description: content.description,
      longDescription: content.longDescription,
      creator: content.creator,
      royaltyPercent: content.royaltyPercent,
      contractAddress: content.contractAddress,
      contractStandard: content.contractStandard,
      storage: content.storage,
      gallery: content.gallery,
      compareAtPrice: s.compareAtPrice,
      defaultEditionId: "1-50",
      rare: s.rare,
      isNew: s.isNew,
      trending: s.trending,
      rating: s.rating,
      reviewCount: s.reviewCount,
      listedAt: listedAtFor(index),
      editions: buildEditions(s),
      version: 1,
    };
  });

  const createdAt = "2026-01-15T12:00:00.000Z";
  const users: UserRecord[] = [];
  const favorites: DbState["favorites"] = {};
  const wallets: DbState["wallets"] = {};

  for (const u of USER_SEEDS) {
    // Hash pré-computado com sal determinístico: o seed é reproduzível e barato.
    const salt = `seed-${u.id}`;
    users.push({
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: null,
        ensName: u.ensName,
        walletNickname: u.walletNickname,
        createdAt,
      },
      salt,
      passwordHash: u.passwordHash,
    });
    favorites[u.id] = [...u.favorites];
    const toWallet = (slot: "primary" | "secondary", w: NonNullable<typeof u.wallets.secondary>): Wallet => ({
      id: `wal_${u.id}_${slot}`,
      slot,
      ...w,
      ensSuffix: ".eth",
      sameAsPrimary: false,
      updatedAt: createdAt,
    });
    wallets[u.id] = {
      primary: toWallet("primary", u.wallets.primary),
      secondary: u.wallets.secondary ? toWallet("secondary", u.wallets.secondary) : null,
    };
  }

  return {
    schema: SCHEMA,
    seq: 0,
    nfts,
    users,
    sessions: [],
    carts: [],
    favorites,
    wallets,
    orders: [],
    connections: [],
    triggers: {},
  };
}

export async function initDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.schema === SCHEMA) {
        state = parsed;
        return state;
      }
    }
  } catch {
    /* estado corrompido: recria a partir do seed */
  }
  state = seed();
  persistNow();
  return state;
}

export async function resetDb() {
  state = seed();
  persistNow();
  return state;
}

/** Recarrega o estado se outra aba alterou o banco (mantém abas coerentes). */
export function syncFromStorage(raw: string | null) {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as DbState;
    if (parsed.schema === SCHEMA) state = parsed;
  } catch {
    /* ignora */
  }
}

export const DB_STORAGE_KEY = STORAGE_KEY;
