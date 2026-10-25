import { z } from "zod";
import {
  Network,
  WalletType,
  displayNameField,
  emailField,
  ensNameField,
  isValidAddress,
  referralCodeField,
  usernameField,
  type BuyerInfo,
  type User,
  type Wallet,
} from "@/contracts";

export const WalletChoice = z.enum(["primary", "secondary", "other"]);
export type WalletChoice = z.infer<typeof WalletChoice>;

/** Campos do layout "Perfil do colecionador" (Pagamento). */
export const CheckoutFormSchema = z
  .object({
    walletChoice: WalletChoice,
    displayName: displayNameField,
    username: usernameField,
    network: z.union([Network, z.literal("")]).refine((v) => v !== "", "Selecione uma rede"),
    profileName: z.string().trim().min(2, "Informe o nome do perfil").max(40, "Use no máximo 40 caracteres"),
    address: z.string().trim().min(1, "Informe o endereço da carteira"),
    secondaryAddress: z.string().trim().max(64, "Valor muito longo"),
    walletType: z.union([WalletType, z.literal("")]).refine((v) => v !== "", "Selecione uma carteira"),
    referralCode: referralCodeField,
    email: emailField,
    ensName: ensNameField,
    note: z.string().max(500, "Use no máximo 500 caracteres"),
  })
  .superRefine((value, ctx) => {
    if (value.network && value.address && !isValidAddress(value.address, value.network)) {
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

export type CheckoutFormValues = z.input<typeof CheckoutFormSchema>;

export const CHECKOUT_FIELDS = [
  "displayName",
  "username",
  "network",
  "profileName",
  "address",
  "secondaryAddress",
  "walletType",
  "referralCode",
  "email",
  "ensName",
  "note",
] as const;

export function walletDefaults(wallet: Wallet): Partial<CheckoutFormValues> {
  return {
    displayName: wallet.displayName,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    secondaryAddress: wallet.secondaryAddress ?? "",
    walletType: wallet.walletType,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: wallet.ensName,
  };
}

export function emptyDefaults(user: User, primary: Wallet | null): CheckoutFormValues {
  const base: CheckoutFormValues = {
    walletChoice: primary ? "primary" : "other",
    displayName: user.displayName,
    username: user.username,
    network: "",
    profileName: user.username,
    address: "",
    secondaryAddress: "",
    walletType: "",
    referralCode: "",
    email: user.email,
    ensName: user.ensName ?? "",
    note: "",
  };
  return primary ? { ...base, ...walletDefaults(primary) } : base;
}

export function toBuyer(values: CheckoutFormValues): BuyerInfo {
  return {
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    email: values.email.trim().toLowerCase(),
    profileName: values.profileName.trim(),
    referralCode: values.referralCode.trim(),
    ensName: `${values.ensName.trim()}.eth`,
    secondaryAddress: values.secondaryAddress.trim() || null,
    note: values.note.trim() || null,
  };
}
