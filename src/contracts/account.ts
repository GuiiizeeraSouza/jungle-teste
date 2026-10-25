import { z } from "zod";
import { Network, WalletType } from "./common";

/* ----------------------------------------------------------------------------
 * Regras de validação compartilhadas entre formulários (cliente) e API (mock).
 * ------------------------------------------------------------------------- */

export const emailField = z.string().trim().min(1, "Informe seu e-mail").email("Informe um e-mail válido").max(120, "E-mail muito longo");

export const usernameField = z
  .string()
  .trim()
  .min(3, "Use pelo menos 3 caracteres")
  .max(24, "Use no máximo 24 caracteres")
  .regex(/^[a-z0-9._]+$/i, "Use apenas letras, números, ponto ou sublinhado");

export const passwordField = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres")
  .regex(/[A-Za-z]/, "Inclua pelo menos uma letra")
  .regex(/\d/, "Inclua pelo menos um número");

export const displayNameField = z.string().trim().min(2, "Informe o nome de exibição").max(40, "Use no máximo 40 caracteres");

export const ensNameField = z
  .string()
  .trim()
  .min(3, "O nome ENS precisa ter pelo menos 3 caracteres")
  .max(32, "Use no máximo 32 caracteres")
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, "Use letras minúsculas, números, hífen ou ponto");

export const walletNicknameField = z.string().trim().min(2, "Informe o apelido da carteira").max(30, "Use no máximo 30 caracteres");

export const referralCodeField = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{4,16}$/, "Código de indicação inválido (4 a 16 letras, números ou hífen)");

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidAddress(address: string, network: Network) {
  return network === "solana" ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address);
}

/* ----------------------------------------------------------------------------
 * Sessão e conta
 * ------------------------------------------------------------------------- */

export const User = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof User>;

export const LoginInput = z.object({
  email: emailField,
  password: z.string().min(1, "Informe sua senha"),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RegisterInput = z.object({
  username: usernameField,
  email: emailField,
  password: passwordField,
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const SessionResponse = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: User,
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const CurrentSessionResponse = z.object({
  expiresAt: z.string(),
  user: User,
});
export type CurrentSessionResponse = z.infer<typeof CurrentSessionResponse>;

/* ----------------------------------------------------------------------------
 * Perfil
 * ------------------------------------------------------------------------- */

export const ProfileUpdateInput = z.object({
  displayName: displayNameField,
  username: usernameField,
  email: emailField,
  ensName: ensNameField,
  walletNickname: walletNicknameField,
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInput>;

export const AvatarInput = z.object({
  /** Data URL (PNG/JPEG/WebP) já redimensionada pelo cliente. */
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Formato de imagem não suportado")
    .max(400_000, "A imagem deve ter no máximo 300 KB"),
});
export type AvatarInput = z.infer<typeof AvatarInput>;

export const PasswordChangeInput = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual"),
  newPassword: passwordField,
});
export type PasswordChangeInput = z.infer<typeof PasswordChangeInput>;

/* ----------------------------------------------------------------------------
 * Carteiras cadastradas
 * ------------------------------------------------------------------------- */

export const WalletSlot = z.enum(["primary", "secondary"]);
export type WalletSlot = z.infer<typeof WalletSlot>;

export const WalletInput = z
  .object({
    displayName: displayNameField,
    nickname: walletNicknameField,
    network: Network,
    profileName: z.string().trim().min(2, "Informe o nome do perfil").max(40, "Use no máximo 40 caracteres"),
    address: z.string().trim().min(1, "Informe o endereço da carteira"),
    secondaryAddress: z.string().trim().max(64, "Valor muito longo").nullable(),
    walletType: WalletType,
    referralCode: referralCodeField,
    email: emailField,
    ensName: ensNameField,
    ensSuffix: z.literal(".eth"),
  })
  .superRefine((value, ctx) => {
    if (!isValidAddress(value.address, value.network)) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message:
          value.network === "solana"
            ? "Endereço Solana inválido (base58, 32 a 44 caracteres)"
            : "Endereço inválido: use 0x seguido de 40 caracteres hexadecimais",
      });
    }
  });
export type WalletInput = z.infer<typeof WalletInput>;

export const Wallet = z.object({
  id: z.string(),
  slot: WalletSlot,
  displayName: z.string(),
  nickname: z.string(),
  network: Network,
  profileName: z.string(),
  address: z.string(),
  secondaryAddress: z.string().nullable(),
  walletType: WalletType,
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  ensSuffix: z.literal(".eth"),
  sameAsPrimary: z.boolean(),
  updatedAt: z.string(),
});
export type Wallet = z.infer<typeof Wallet>;

export const WalletsResponse = z.object({
  primary: Wallet.nullable(),
  secondary: Wallet.nullable(),
});
export type WalletsResponse = z.infer<typeof WalletsResponse>;

export const SecondaryWalletInput = z.union([z.object({ sameAsPrimary: z.literal(true) }), WalletInput]);
export type SecondaryWalletInput = z.infer<typeof SecondaryWalletInput>;

/* ----------------------------------------------------------------------------
 * Conexão simulada com carteira (extensão/app)
 * ------------------------------------------------------------------------- */

export const WalletConnectionInput = z.object({
  walletType: WalletType,
  network: Network,
  address: z.string().min(1),
});
export type WalletConnectionInput = z.infer<typeof WalletConnectionInput>;

export const WalletConnection = z.object({
  id: z.string(),
  walletType: WalletType,
  network: Network,
  address: z.string(),
  status: z.literal("connected"),
  connectedAt: z.string(),
});
export type WalletConnection = z.infer<typeof WalletConnection>;
