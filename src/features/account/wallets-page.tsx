"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  NETWORK_LABEL,
  Network,
  WALLET_TYPE_LABEL,
  WalletType,
  displayNameField,
  emailField,
  ensNameField,
  isValidAddress,
  referralCodeField,
  walletNicknameField,
  type Wallet,
  type WalletInput,
} from "@/contracts";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { shortAddress } from "@/components/shared/misc";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallets } from "@/features/checkout/use-checkout";
import { announce } from "@/lib/announce";
import { toApiError } from "@/lib/api/errors";
import { applyServerErrors, zodResolver } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useRemoveSecondaryWallet, useSavePrimaryWallet, useSaveSecondaryWallet } from "./use-account";

const WalletFormSchema = z
  .object({
    displayName: displayNameField,
    nickname: walletNicknameField,
    network: z.union([Network, z.literal("")]).refine((v) => v !== "", "Selecione uma rede"),
    profileName: z.string().trim().min(2, "Informe o nome do perfil").max(40, "Use no máximo 40 caracteres"),
    address: z.string().trim().min(1, "Informe o endereço da carteira"),
    secondaryAddress: z.string().trim().max(64, "Valor muito longo"),
    walletType: z.union([WalletType, z.literal("")]).refine((v) => v !== "", "Selecione uma carteira"),
    referralCode: referralCodeField,
    email: emailField,
    ensName: ensNameField,
  })
  .superRefine((v, ctx) => {
    if (v.network && v.address && !isValidAddress(v.address, v.network)) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message:
          v.network === "solana"
            ? "Endereço Solana inválido (base58, 32 a 44 caracteres)"
            : "Endereço inválido: use 0x seguido de 40 caracteres hexadecimais",
      });
    }
  });
type WalletFormValues = z.input<typeof WalletFormSchema>;

const FIELDS = [
  "displayName",
  "nickname",
  "network",
  "profileName",
  "address",
  "secondaryAddress",
  "walletType",
  "referralCode",
  "email",
  "ensName",
] as const;

const EMPTY: WalletFormValues = {
  displayName: "",
  nickname: "",
  network: "",
  profileName: "",
  address: "",
  secondaryAddress: "",
  walletType: "",
  referralCode: "",
  email: "",
  ensName: "",
};

function toValues(wallet: Wallet | null): WalletFormValues {
  if (!wallet) return EMPTY;
  return {
    displayName: wallet.displayName,
    nickname: wallet.nickname,
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

function toInput(values: WalletFormValues): WalletInput {
  return {
    displayName: values.displayName.trim(),
    nickname: values.nickname.trim(),
    network: values.network as Network,
    profileName: values.profileName.trim(),
    address: values.address.trim(),
    secondaryAddress: values.secondaryAddress.trim() || null,
    walletType: values.walletType as WalletType,
    referralCode: values.referralCode.trim(),
    email: values.email.trim().toLowerCase(),
    ensName: values.ensName.trim(),
    ensSuffix: ".eth",
  };
}

interface WalletFormProps {
  id: string;
  wallet: Wallet | null;
  submitLabel: string;
  saving: boolean;
  onSubmit: (input: WalletInput, helpers: { setServerErrors: (error: unknown) => void; reset: (w: Wallet | null) => void }) => void;
  extraActions?: React.ReactNode;
}

function WalletForm({ id, wallet, submitLabel, saving, onSubmit, extraActions }: WalletFormProps) {
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(WalletFormSchema),
    defaultValues: toValues(wallet),
    reValidateMode: "onChange",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toValues(wallet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.updatedAt]);

  const submit = form.handleSubmit(
    (values) => {
      setFormError(null);
      onSubmit(toInput(values), {
        setServerErrors: (error) => setFormError(applyServerErrors(error, form.setError, FIELDS)),
        reset: (w) => form.reset(toValues(w)),
      });
    },
    () => setFormError("Revise os campos destacados."),
  );

  const select = <K extends "network" | "walletType">(
    name: K,
    placeholder: string,
    options: readonly string[],
    labels: Record<string, string>,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Select value={field.value || undefined} onValueChange={field.onChange}>
          <SelectTrigger
            id={`${id}-${name}`}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
            aria-required
            onBlur={field.onBlur}
            className="h-9 w-full text-xs data-[placeholder]:text-muted-foreground"
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="border-border bg-card">
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {labels[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-labelledby={`${id}-title`}>
      <FormAlert message={formError} />
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <FormField label="Nome de exibição" required error={errors.displayName?.message}>
          {(c) => <Input {...c} {...form.register("displayName")} />}
        </FormField>
        <FormField label="Apelido da carteira" required error={errors.nickname?.message}>
          {(c) => <Input {...c} {...form.register("nickname")} />}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-network`} className="text-sm">
            Rede
            <span aria-hidden className="ml-1 text-base leading-none text-destructive">
              *
            </span>
          </label>
          {select("network", "Selecione uma rede", Network.options, NETWORK_LABEL)}
          {errors.network && (
            <p id={`${id}-network-error`} className="text-xs font-medium text-destructive">
              {errors.network.message}
            </p>
          )}
        </div>
        <FormField label="Nome do perfil" required error={errors.profileName?.message}>
          {(c) => <Input {...c} {...form.register("profileName")} />}
        </FormField>
        <FormField label="Endereço da carteira" required error={errors.address?.message}>
          {(c) => (
            <Input
              {...c}
              {...form.register("address")}
              placeholder="Endereço 0x da carteira"
              spellCheck={false}
              autoComplete="off"
              className="text-xs"
            />
          )}
        </FormField>
        <FormField
          label="ENS ou carteira secundária (opcional)"
          srOnlyLabel
          error={errors.secondaryAddress?.message}
          className="sm:justify-end"
        >
          {(c) => (
            <Input {...c} {...form.register("secondaryAddress")} placeholder="ENS ou carteira secundária (opcional)" className="text-xs" />
          )}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-walletType`} className="text-sm">
            Tipo de carteira
            <span aria-hidden className="ml-0.5 text-base leading-none text-destructive">
              *
            </span>
          </label>
          {select("walletType", "Selecione uma carteira", WalletType.options, WALLET_TYPE_LABEL)}
          {errors.walletType && (
            <p id={`${id}-walletType-error`} className="text-xs font-medium text-destructive">
              {errors.walletType.message}
            </p>
          )}
        </div>
        <FormField label="Código de indicação" required error={errors.referralCode?.message}>
          {(c) => <Input {...c} {...form.register("referralCode")} autoComplete="off" />}
        </FormField>
        <FormField label="E-mail" required error={errors.email?.message}>
          {(c) => <Input {...c} {...form.register("email")} type="email" autoComplete="email" />}
        </FormField>
        <FormField label="Nome ENS" required error={errors.ensName?.message}>
          {(c) => (
            <div className="flex gap-2">
              <select
                aria-label="Sufixo ENS"
                className="h-9 rounded-[3px] border border-input bg-input-bg px-2 text-sm"
                defaultValue=".eth"
              >
                <option value=".eth">.eth</option>
              </select>
              <Input {...c} {...form.register("ensName")} spellCheck={false} autoComplete="off" />
            </div>
          )}
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-9 px-1.5 text-xs" disabled={saving}>
          {saving ? "Salvando…" : submitLabel}
        </Button>
        {extraActions}
      </div>
    </form>
  );
}

function SecondarySection({ primary, secondary }: { primary: Wallet | null; secondary: Wallet | null }) {
  const save = useSaveSecondaryWallet();
  const remove = useRemoveSecondaryWallet();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const same = secondary?.sameAsPrimary ?? false;

  const setSameAsPrimary = () => {
    setError(null);
    if (!primary) {
      setError("Cadastre a carteira principal antes de replicá-la.");
      return;
    }
    save.mutate(
      { sameAsPrimary: true },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Carteira secundária igual à principal");
          announce("Carteira secundária definida como igual à principal.");
        },
        onError: (e) => setError(toApiError(e).message),
      },
    );
  };

  return (
    <section aria-labelledby="secundaria-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="secundaria-title" className="text-base font-bold">
            Carteira secundária
          </h2>
          <p className="text-xs text-muted-foreground" data-testid="secondary-status">
            {!secondary
              ? "Você ainda não adicionou uma carteira secundária."
              : same
                ? "Usando os mesmos dados da carteira principal."
                : `${secondary.nickname} · ${shortAddress(secondary.address)} · ${NETWORK_LABEL[secondary.network]}`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <label className="relative flex cursor-pointer items-center gap-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input
              type="radio"
              className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
              checked={same}
              onChange={setSameAsPrimary}
              disabled={save.isPending}
              name="secondary-mode"
            />
            <span aria-hidden className="grid size-4 place-items-center rounded-full border border-primary">
              {same && <span className="size-2 rounded-full bg-primary" />}
            </span>
            Igual à carteira principal
          </label>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            className="font-bold text-primary hover:underline"
          >
            {secondary && !same ? "Editar" : "Adicionar"}
          </button>
        </div>
      </div>
      <FormAlert message={error} />
      {editing && (
        <WalletForm
          id="secundaria"
          wallet={same ? null : secondary}
          submitLabel="Salvar carteira secundária"
          saving={save.isPending}
          onSubmit={(input, helpers) =>
            save.mutate(input, {
              onSuccess: (res) => {
                helpers.reset(res.secondary);
                setEditing(false);
                toast.success("Carteira secundária salva");
                announce("Carteira secundária salva.");
              },
              onError: helpers.setServerErrors,
            })
          }
          extraActions={
            secondary && (
              <Button
                variant="ghost"
                className="h-9 text-xs"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => {
                      setEditing(false);
                      toast.success("Carteira secundária removida");
                    },
                  })
                }
              >
                Remover carteira secundária
              </Button>
            )
          }
        />
      )}
    </section>
  );
}

export function WalletsPage() {
  const { data, isPending, error, refetch, isRefetching } = useWallets();
  const savePrimary = useSavePrimaryWallet();
  const [showPrimary, setShowPrimary] = useState(true);

  if (isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="principal-title" className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 id="principal-title" className="text-base font-bold">
              Carteira principal
            </h1>
            <p className="text-xs text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!data.primary && (
            <button type="button" className="text-sm font-bold text-primary hover:underline" onClick={() => setShowPrimary(true)}>
              Adicionar
            </button>
          )}
        </div>
        <div className={cn(!showPrimary && "hidden")}>
          <WalletForm
            id="principal"
            wallet={data.primary}
            submitLabel="Salvar carteira"
            saving={savePrimary.isPending}
            onSubmit={(input, helpers) =>
              savePrimary.mutate(input, {
                onSuccess: (res) => {
                  helpers.reset(res.primary);
                  toast.success("Carteira principal salva");
                  announce("Carteira principal salva.");
                },
                onError: helpers.setServerErrors,
              })
            }
          />
        </div>
      </section>
      <SecondarySection primary={data.primary} secondary={data.secondary} />
    </div>
  );
}
