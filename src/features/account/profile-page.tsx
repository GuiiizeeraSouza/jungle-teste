"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ProfileUpdateInput, passwordField, type User } from "@/contracts";
import { UserAvatar } from "@/components/layout/user-avatar";
import { FormAlert, FormField, PasswordInput } from "@/components/shared/form-field";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { announce } from "@/lib/announce";
import { toApiError } from "@/lib/api/errors";
import { applyServerErrors, zodResolver } from "@/lib/forms";
import { useChangePassword, useProfile, useRemoveAvatar, useSetAvatar, useUpdateProfile } from "./use-account";

const PROFILE_FIELDS = ["displayName", "username", "email", "ensName", "walletNickname"] as const;

const PasswordFormSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    // Seção opcional: só valida quando algum campo de senha foi preenchido.
    if (!v.currentPassword && !v.newPassword && !v.confirmPassword) return;
    if (!v.currentPassword) ctx.addIssue({ code: "custom", path: ["currentPassword"], message: "Informe sua senha atual" });
    const parsed = passwordField.safeParse(v.newPassword);
    if (!parsed.success) ctx.addIssue({ code: "custom", path: ["newPassword"], message: parsed.error.issues[0]!.message });
    if (v.newPassword !== v.confirmPassword)
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As senhas não coincidem" });
  });
type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

const MAX_AVATAR_INPUT = 5 * 1024 * 1024;

/** Redimensiona a imagem no cliente (256 px, WebP) antes do envio. */
async function toAvatarDataUrl(file: File) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use uma imagem PNG, JPEG ou WebP.");
  if (file.size > MAX_AVATAR_INPUT) throw new Error("A imagem deve ter no máximo 5 MB.");
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.85);
}

function AvatarField({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();
  const [error, setError] = useState<string | null>(null);
  const pending = setAvatar.isPending || removeAvatar.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await toAvatarDataUrl(file);
      setAvatar.mutate(dataUrl, {
        onSuccess: () => {
          toast.success("Avatar atualizado");
          announce("Avatar atualizado.");
        },
        onError: (e) => setError(toApiError(e).fields.dataUrl ?? toApiError(e).message),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a imagem.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id="avatar-label" className="text-sm">
        Avatar
      </span>
      <div className="flex items-center gap-5" role="group" aria-labelledby="avatar-label">
        <UserAvatar user={user} className="size-11" />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-input"
          aria-describedby={error ? "avatar-error" : undefined}
          onChange={(e) => void onFile(e.target.files?.[0])}
          data-testid="avatar-input"
        />
        <Button size="sm" className="h-9 px-6 text-xs" disabled={pending} onClick={() => inputRef.current?.click()}>
          {setAvatar.isPending ? "Enviando…" : "Alterar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 text-xs font-normal"
          disabled={pending || !user.avatarUrl}
          onClick={() =>
            removeAvatar.mutate(undefined, {
              onSuccess: () => {
                toast.success("Avatar removido");
                announce("Avatar removido.");
              },
              onError: (e) => setError(toApiError(e).message),
            })
          }
        >
          Remover
        </Button>
      </div>
      {error && (
        <p id="avatar-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);

  const profileForm = useForm<ProfileUpdateInput>({
    resolver: zodResolver(ProfileUpdateInput),
    defaultValues: {
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? "",
      walletNickname: user.walletNickname ?? "",
    },
    reValidateMode: "onChange",
  });
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    reValidateMode: "onChange",
  });

  // Mantém o formulário em sincronia com a versão salva (ex.: após refresh do cache).
  useEffect(() => {
    if (!profileForm.formState.isDirty) {
      profileForm.reset({
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        ensName: user.ensName ?? "",
        walletNickname: user.walletNickname ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const pe = profileForm.formState.errors;
  const pw = passwordForm.formState.errors;
  const saving = updateProfile.isPending || changePassword.isPending;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const [profileOk, passwordOk] = await Promise.all([profileForm.trigger(), passwordForm.trigger()]);
    if (!profileOk || !passwordOk) {
      setFormError("Revise os campos destacados.");
      const first = PROFILE_FIELDS.find((f) => profileForm.formState.errors[f]);
      if (first) profileForm.setFocus(first);
      else {
        const pf = (["currentPassword", "newPassword", "confirmPassword"] as const).find((f) => passwordForm.formState.errors[f]);
        if (pf) passwordForm.setFocus(pf);
      }
      return;
    }

    const messages: string[] = [];
    if (profileForm.formState.isDirty) {
      try {
        const saved = await updateProfile.mutateAsync(ProfileUpdateInput.parse(profileForm.getValues()));
        profileForm.reset({
          displayName: saved.displayName,
          username: saved.username,
          email: saved.email,
          ensName: saved.ensName ?? "",
          walletNickname: saved.walletNickname ?? "",
        });
        messages.push("Perfil atualizado");
      } catch (error) {
        setFormError(applyServerErrors(error, profileForm.setError, PROFILE_FIELDS) ?? "Revise os campos destacados.");
        return;
      }
    }

    const { currentPassword, newPassword } = passwordForm.getValues();
    if (currentPassword || newPassword) {
      try {
        await changePassword.mutateAsync({ currentPassword, newPassword });
        passwordForm.reset();
        messages.push("Senha alterada");
      } catch (error) {
        setFormError(applyServerErrors(error, passwordForm.setError, ["currentPassword", "newPassword"]) ?? "Revise os campos de senha.");
        return;
      }
    }

    const message = messages.length ? `${messages.join(" e ")} com sucesso.` : "Nenhuma alteração para salvar.";
    toast[messages.length ? "success" : "info"](message);
    announce(message);
  };

  return (
    <form onSubmit={save} noValidate aria-labelledby="perfil-title" className="flex flex-col gap-6">
      <h1 id="perfil-title" className="text-sm font-bold">
        Perfil do colecionador
      </h1>
      <FormAlert message={formError} />
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <FormField label="Nome de exibição" required error={pe.displayName?.message}>
          {(c) => <Input {...c} {...profileForm.register("displayName")} autoComplete="name" />}
        </FormField>
        <FormField label="Nome de usuário" required error={pe.username?.message}>
          {(c) => <Input {...c} {...profileForm.register("username")} autoComplete="username" />}
        </FormField>
        <FormField label="E-mail" required error={pe.email?.message}>
          {(c) => <Input {...c} {...profileForm.register("email")} type="email" autoComplete="email" />}
        </FormField>
        <FormField label="Nome ENS" required error={pe.ensName?.message}>
          {(c) => (
            <div className="flex gap-2">
              <select
                aria-label="Sufixo ENS"
                className="h-9 rounded-[3px] border border-input bg-input-bg px-2 text-sm"
                defaultValue=".eth"
              >
                <option value=".eth">.eth</option>
              </select>
              <Input {...c} {...profileForm.register("ensName")} spellCheck={false} autoComplete="off" />
            </div>
          )}
        </FormField>
        <FormField label="Apelido da carteira" required error={pe.walletNickname?.message}>
          {(c) => <Input {...c} {...profileForm.register("walletNickname")} autoComplete="off" />}
        </FormField>
        <AvatarField user={user} />
      </div>

      <fieldset className="flex max-w-[23rem] flex-col gap-4">
        <legend className="mb-4 text-sm font-bold">Alterar senha</legend>
        <FormField label="Senha atual" error={pw.currentPassword?.message}>
          {(c) => <PasswordInput {...c} {...passwordForm.register("currentPassword")} autoComplete="current-password" />}
        </FormField>
        <FormField label="Nova senha" error={pw.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(c) => <PasswordInput {...c} {...passwordForm.register("newPassword")} autoComplete="new-password" />}
        </FormField>
        <FormField label="Confirmar nova senha" error={pw.confirmPassword?.message}>
          {(c) => <PasswordInput {...c} {...passwordForm.register("confirmPassword")} autoComplete="new-password" />}
        </FormField>
      </fieldset>

      <Button type="submit" className="h-9 w-fit px-9 text-sm" disabled={saving}>
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

export function ProfilePage() {
  const { data, isPending, error, refetch, isRefetching } = useProfile();
  if (isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
  return <ProfileForm user={data} />;
}
