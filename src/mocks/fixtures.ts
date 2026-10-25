import type { Category, Edition, EditionId, GalleryItem, Network, WalletType } from "@/contracts";
import { CATEGORY_LABEL, EDITION_LABEL, NETWORK_LABEL } from "@/contracts";
import { eth } from "@/lib/eth";

/**
 * Fixtures determinísticas do cenário padrão. Os 9 primeiros NFTs reproduzem
 * a vitrine do layout (mesma ordem em "Listados recentemente").
 */

type ArtKey = "emerald" | "sage" | "ivory" | "golden";

const ART: Record<ArtKey, { src: string; alt: string; collection: string; attributes: string[] }> = {
  emerald: {
    src: "/nfts/emerald-ape.png",
    alt: "Macaco de pelo castanho com óculos redondos de lentes verdes, corrente dourada e jaqueta college verde",
    collection: "Kurio Apes",
    attributes: ["Óculos", "Esmeralda", "Raro"],
  },
  sage: {
    src: "/nfts/sage-nomad.png",
    alt: "Gorila de pelo cinza com chapéu bucket verde-oliva e moletom roxo",
    collection: "Kurio Nomads",
    attributes: ["Chapéu bucket", "Moletom", "Sereno"],
  },
  ivory: {
    src: "/nfts/ivory-baron.png",
    alt: "Chimpanzé de pelo preto com brinco dourado, gola alta verde e blazer bege",
    collection: "Kurio Barons",
    attributes: ["Brinco", "Blazer", "Elegante"],
  },
  golden: {
    src: "/nfts/golden-beat.png",
    alt: "Orangotango dourado com fones de ouvido verdes e jaqueta bomber creme",
    collection: "Kurio Frequencies",
    attributes: ["Fones", "Bomber", "Musical"],
  },
};

export interface NftSeed {
  id: string;
  name: string;
  tokenId: string;
  art: ArtKey;
  category: Category;
  network: Network;
  price: string;
  compareAtPrice: string | null;
  rare: boolean;
  isNew: boolean;
  trending: boolean;
  rating: number;
  reviewCount: number;
  /** Disponibilidade por edição na ordem 1/1, 1/10, 1/50, aberta. */
  availability: [number, number, number, number];
}

const LAYOUT_NFTS: NftSeed[] = [
  {
    id: "emerald-ape-042",
    name: "Emerald Ape #042",
    tokenId: "#0042",
    art: "emerald",
    category: "arte-digital",
    network: "ethereum",
    price: "1.19",
    compareAtPrice: null,
    rare: false,
    isNew: true,
    trending: true,
    rating: 4.8,
    reviewCount: 19,
    availability: [0, 6, 48, 500],
  },
  {
    id: "sage-nomad-009",
    name: "Sage Nomad #009",
    tokenId: "#0009",
    art: "sage",
    category: "fotografia",
    network: "polygon",
    price: "1.69",
    compareAtPrice: null,
    rare: false,
    isNew: true,
    trending: false,
    rating: 4.6,
    reviewCount: 12,
    availability: [1, 8, 40, 500],
  },
  {
    id: "neon-vessel-552",
    name: "Neon Vessel #552",
    tokenId: "#0552",
    art: "ivory",
    category: "arte-digital",
    network: "ethereum",
    price: "1.99",
    compareAtPrice: "2.29",
    rare: true,
    isNew: false,
    trending: true,
    rating: 4.9,
    reviewCount: 27,
    availability: [1, 3, 22, 500],
  },
  {
    id: "cosmic-bloom-118",
    name: "Cosmic Bloom #118",
    tokenId: "#0118",
    art: "sage",
    category: "generativa",
    network: "solana",
    price: "1.29",
    compareAtPrice: null,
    rare: false,
    isNew: true,
    trending: false,
    rating: 4.4,
    reviewCount: 9,
    availability: [1, 10, 35, 500],
  },
  {
    id: "violet-nomad-314",
    name: "Violet Nomad #314",
    tokenId: "#0314",
    art: "sage",
    category: "arte-digital",
    network: "ethereum",
    price: "1.39",
    compareAtPrice: null,
    rare: false,
    isNew: false,
    trending: true,
    rating: 4.7,
    reviewCount: 21,
    availability: [1, 7, 30, 500],
  },
  {
    id: "ivory-baron-088",
    name: "Ivory Baron #088",
    tokenId: "#0088",
    art: "ivory",
    category: "colecionaveis",
    network: "ethereum",
    price: "1.79",
    compareAtPrice: null,
    rare: false,
    isNew: false,
    trending: false,
    rating: 4.5,
    reviewCount: 14,
    availability: [0, 9, 45, 500],
  },
  {
    id: "golden-beat-207",
    name: "Golden Beat #207",
    tokenId: "#0207",
    art: "golden",
    category: "musica",
    network: "polygon",
    price: "0.99",
    compareAtPrice: null,
    rare: false,
    isNew: true,
    trending: true,
    rating: 4.3,
    reviewCount: 8,
    availability: [1, 5, 26, 500],
  },
  {
    id: "golden-frequency-071",
    name: "Golden Frequency #071",
    tokenId: "#0071",
    art: "golden",
    category: "musica",
    network: "ethereum",
    price: "0.59",
    compareAtPrice: null,
    rare: false,
    isNew: false,
    trending: false,
    rating: 4.2,
    reviewCount: 6,
    availability: [1, 4, 18, 500],
  },
  {
    id: "golden-signal-160",
    name: "Golden Signal #160",
    tokenId: "#0160",
    art: "golden",
    category: "musica",
    network: "solana",
    price: "0.39",
    compareAtPrice: null,
    rare: false,
    isNew: false,
    trending: true,
    rating: 4.1,
    reviewCount: 11,
    availability: [1, 2, 3, 500],
  },
];

const ADJECTIVES = [
  "Amber",
  "Copper",
  "Onyx",
  "Jade",
  "Crimson",
  "Silver",
  "Midnight",
  "Solar",
  "Lunar",
  "Velvet",
  "Rust",
  "Cobalt",
  "Saffron",
  "Obsidian",
  "Coral",
];
const NOUNS: Array<[string, ArtKey]> = [
  ["Ape", "emerald"],
  ["Monk", "sage"],
  ["Pilot", "ivory"],
  ["Echo", "golden"],
  ["Drifter", "sage"],
  ["Duke", "ivory"],
  ["Rider", "golden"],
  ["Scholar", "emerald"],
  ["Wanderer", "sage"],
];
const CATEGORIES: Category[] = [
  "arte-3d",
  "jogos",
  "assinaturas",
  "utilidade",
  "fotografia",
  "colecionaveis",
  "generativa",
  "arte-digital",
  "musica",
];
const NETWORKS: Network[] = ["ethereum", "polygon", "solana", "ethereum", "polygon"];

/** PRNG determinístico (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatedNfts(): NftSeed[] {
  const rand = mulberry32(20260729);
  const result: NftSeed[] = [];
  for (let i = 0; i < 27; i++) {
    const [noun, art] = NOUNS[i % NOUNS.length]!;
    const adjective = ADJECTIVES[(i * 7) % ADJECTIVES.length]!;
    const number = String(Math.floor(rand() * 899) + 100);
    const name = `${adjective} ${noun} #${number}`;
    // Extremos da faixa de preço do layout: 0,02 e 12,30 ETH.
    const price = i === 5 ? "12.30" : i === 17 ? "0.02" : (0.05 + rand() * 6.5).toFixed(2);
    result.push({
      id: `${adjective}-${noun}-${number}`.toLowerCase(),
      name,
      tokenId: `#${number.padStart(4, "0")}`,
      art,
      category: CATEGORIES[i % CATEGORIES.length]!,
      network: NETWORKS[i % NETWORKS.length]!,
      price,
      compareAtPrice: i % 8 === 3 ? eth.round(eth.mul(price, "1.15")) : null,
      rare: i % 6 === 2,
      isNew: i % 3 === 0,
      trending: i % 4 === 1,
      rating: Math.round((4 + rand() * 0.9) * 10) / 10,
      reviewCount: 4 + Math.floor(rand() * 30),
      availability: [i % 5 === 0 ? 0 : 1, Math.floor(rand() * 11), 5 + Math.floor(rand() * 45), i % 9 === 4 ? 0 : 500],
    });
  }
  return result;
}

export const NFT_SEEDS: NftSeed[] = [...LAYOUT_NFTS, ...generatedNfts()];

const EDITION_IDS: EditionId[] = ["1-1", "1-10", "1-50", "open"];
const EDITION_SUPPLY: Record<EditionId, number> = { "1-1": 1, "1-10": 10, "1-50": 50, open: 500 };
const EDITION_MAX_PER_ORDER: Record<EditionId, number> = { "1-1": 1, "1-10": 5, "1-50": 10, open: 20 };
const EDITION_MULTIPLIER: Record<EditionId, string> = { "1-1": "4", "1-10": "1.8", "1-50": "1", open: "0.6" };

export function buildEditions(seed: NftSeed): Edition[] {
  return EDITION_IDS.map((id, index) => ({
    id,
    label: EDITION_LABEL[id],
    price: id === "1-50" ? seed.price : eth.round(eth.mul(seed.price, EDITION_MULTIPLIER[id])),
    supply: EDITION_SUPPLY[id],
    available: seed.availability[index]!,
    maxPerOrder: EDITION_MAX_PER_ORDER[id],
  }));
}

export function buildNftContent(seed: NftSeed, index: number) {
  const art = ART[seed.art];
  const networkLabel = NETWORK_LABEL[seed.network];
  const hex = (index * 2654435761).toString(16).padStart(8, "0").slice(0, 8);
  const gallery: GalleryItem[] = [
    { src: art.src, alt: art.alt, focus: "full" },
    { src: art.src, alt: `Detalhe do rosto — ${seed.name}`, focus: "face" },
    { src: art.src, alt: `Detalhe dos acessórios — ${seed.name}`, focus: "detail" },
    { src: art.src, alt: `Detalhe do figurino — ${seed.name}`, focus: "torso" },
  ];
  return {
    image: { src: art.src, alt: art.alt },
    collection: art.collection,
    attributes: index === 0 ? ["Óculos", "Esmeralda", "Raro"] : art.attributes,
    description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${networkLabel}, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${seed.name} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabel}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
    ],
    creator: "Nova Sato",
    royaltyPercent: 5,
    contractAddress: `0x7A42${(hex + "c0ffee".repeat(4)).slice(0, 32)}19E8`,
    contractStandard: "ERC-721",
    storage: "IPFS",
    gallery,
    categoryLabel: CATEGORY_LABEL[seed.category],
  };
}

/** Datas de listagem decrescentes — a ordem do array é a ordem "Listados recentemente". */
export function listedAtFor(index: number) {
  const base = Date.UTC(2026, 8, 30, 12, 0, 0);
  return new Date(base - index * 3_600_000 * 7).toISOString();
}

/* ------------------------------------------------------------------------- */

export interface UserSeed {
  id: string;
  username: string;
  email: string;
  /** PBKDF2-SHA256 (60 000 iterações, sal "seed-<id>") — a senha nunca fica em claro. */
  passwordHash: string;
  displayName: string;
  ensName: string;
  walletNickname: string;
  favorites: string[];
  wallets: {
    primary: WalletSeed;
    secondary: WalletSeed | null;
  };
}

export interface WalletSeed {
  displayName: string;
  nickname: string;
  network: Network;
  profileName: string;
  address: string;
  secondaryAddress: string | null;
  walletType: WalletType;
  referralCode: string;
  email: string;
  ensName: string;
}

/** Usuários de demonstração. Senha de ambos: "Kurio2026" (documentada no README). */
export const USER_SEEDS: UserSeed[] = [
  {
    id: "usr_nova",
    username: "nova.sato",
    email: "nova@kurio.test",
    passwordHash: "48dbd5eaad2c5a7fd2dded7f80e8c2735ea02a438a2c802011bc26f06ba52972",
    displayName: "Nova Sato",
    ensName: "nova",
    walletNickname: "Principal",
    favorites: ["sage-nomad-009", "golden-beat-207"],
    wallets: {
      primary: {
        displayName: "Nova Sato",
        nickname: "Principal",
        network: "ethereum",
        profileName: "nova.sato",
        address: "0xA91F3c5D7e2B4a6F8c1D3e5F7a9B2c4D6e8FE82C",
        secondaryAddress: null,
        walletType: "metamask",
        referralCode: "KURIO-NOVA",
        email: "nova@kurio.test",
        ensName: "nova",
      },
      secondary: {
        displayName: "Nova Sato",
        nickname: "Reserva",
        network: "polygon",
        profileName: "nova.sato",
        address: "0x5B2e9A7c4D1f3E6b8A0c2D4e6F8a1B3c5D7e9F10",
        secondaryAddress: "nova.kurio.eth",
        walletType: "coinbase",
        referralCode: "KURIO-NOVA",
        email: "nova@kurio.test",
        ensName: "nova.kurio",
      },
    },
  },
  {
    id: "usr_leo",
    username: "leo.prado",
    email: "leo@kurio.test",
    passwordHash: "8377c058c225439d88e31ff220d1787b13053dc19e190e0876df1c6b05188d44",
    displayName: "Leo Prado",
    ensName: "leoprado",
    walletNickname: "Principal",
    favorites: [],
    wallets: {
      primary: {
        displayName: "Leo Prado",
        nickname: "Principal",
        network: "ethereum",
        profileName: "leo.prado",
        address: "0x3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2D",
        secondaryAddress: null,
        walletType: "coinbase",
        referralCode: "KURIO-LEO",
        email: "leo@kurio.test",
        ensName: "leoprado",
      },
      secondary: null,
    },
  },
];

/* ------------------------------------------------------------------------- */

export interface CouponDefinition {
  code: string;
  description: string;
  kind: "percent" | "fixed";
  value: string;
  expiresAt: string;
}

export const COUPONS: CouponDefinition[] = [
  { code: "KURIO10", description: "10% de desconto de lançamento", kind: "percent", value: "0.10", expiresAt: "2099-12-31T23:59:59.000Z" },
  { code: "GENESIS5", description: "0.05 ETH de desconto gênesis", kind: "fixed", value: "0.05", expiresAt: "2099-12-31T23:59:59.000Z" },
  { code: "VERAO25", description: "Campanha de verão encerrada", kind: "percent", value: "0.25", expiresAt: "2025-03-01T00:00:00.000Z" },
];

/** Taxas de rede estimadas por rede (string decimal). */
export const NETWORK_FEES: Record<Network, string> = {
  ethereum: "0.016",
  polygon: "0.002",
  solana: "0.0009",
};

const REVIEW_AUTHORS = [
  "Marina V.",
  "Theo K.",
  "Ana Lu",
  "R. Okafor",
  "Bia Tanaka",
  "Caio M.",
  "Lena W.",
  "J. Duarte",
  "Iris P.",
  "Noah F.",
];
const REVIEW_COMMENTS = [
  "Acabamento impecável. A arte em alta resolução vale cada centavo.",
  "Procedência clara e entrega instantânea na carteira.",
  "Uma das minhas peças favoritas da coleção — os detalhes são incríveis.",
  "Comunidade ativa e os lançamentos exclusivos são ótimos.",
  "A edição 1/50 tem uma ótima relação entre raridade e preço.",
  "Metadados completos e contrato verificado. Compra tranquila.",
  "Cores lindas, combina com o resto da minha galeria.",
];

export function buildReviews(nftId: string, count: number, average: number) {
  const rand = mulberry32(nftId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return Array.from({ length: count }, (_, i) => {
    const rating = Math.max(1, Math.min(5, Math.round(average + (rand() - 0.5) * 1.2)));
    return {
      id: `${nftId}-rv-${i + 1}`,
      author: REVIEW_AUTHORS[Math.floor(rand() * REVIEW_AUTHORS.length)]!,
      rating,
      comment: REVIEW_COMMENTS[Math.floor(rand() * REVIEW_COMMENTS.length)]!,
      createdAt: new Date(Date.UTC(2026, 8, 28) - i * 86_400_000 * 2).toISOString(),
    };
  });
}
