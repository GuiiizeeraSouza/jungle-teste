"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoginInput, RegisterInput, emailField, passwordField, usernameField } from "@/contracts";
import { FacebookIcon, GoogleIcon } from "@/components/shared/brand-icons";
import { FormAlert, FormField, PasswordInput } from "@/components/shared/form-field";
import { notAvailable } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin, useRegister } from "@/features/session/use-auth-actions";
import { toApiError } from "@/lib/api/errors";
import { applyServerErrors, zodResolver } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Size = "compact" | "large";

const inputClass = (size: Size) => (size === "large" ? "h-11 rounded-xl px-4 text-base" : "h-8 text-xs");

export function SocialLogin({ size }: { size: Size }) {
  const large = size === "large";
  const button = cn(
    "flex w-full items-center justify-center gap-3 border border-border font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground",
    large ? "h-11 rounded-[4px] text-base" : "h-8 rounded-[3px] text-[0.7rem]",
  );
  return (
    <div className="flex flex-col gap-3">
      <p className={cn("flex items-center justify-center gap-3 text-center", large ? "text-base" : "text-[0.7rem]")}>
        {large && <span aria-hidden className="h-px flex-1 bg-border" />}
        Ou continue com
        {large && <span aria-hidden className="h-px flex-1 bg-border" />}
      </p>
      <button type="button" className={button} onClick={() => notAvailable("O login com Google")}>
        <GoogleIcon className={large ? "size-5" : "size-3.5"} />
        Continuar com Google
      </button>
      <button type="button" className={button} onClick={() => notAvailable("O login com Facebook")}>
        <FacebookIcon className={cn("text-[#3b5998]", large ? "size-5" : "size-3.5")} />
        Continuar com Facebook
      </button>
    </div>
  );
}

export function LoginForm({ size, onSuccess }: { size: Size; onSuccess: () => void }) {
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginInput),
    defaultValues: { email: "", password: "" },
    reValidateMode: "onChange",
  });
  const { errors } = form.formState;
  const large = size === "large";

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess,
      onError: (error) => {
        const apiError = toApiError(error);
        if (apiError.code === "INVALID_CREDENTIALS") {
          setFormError(apiError.message);
          form.setFocus("email");
          return;
        }
        setFormError(applyServerErrors(error, form.setError, ["email", "password"]));
      },
    });
  });

  return (
    <form onSubmit={submit} noValidate aria-label="Entrar" className={cn("flex flex-col", large ? "gap-5" : "gap-3")}>
      <FormAlert message={formError} />
      <FormField label="E-mail" srOnlyLabel error={errors.email?.message} required>
        {(control) => (
          <Input
            {...control}
            {...form.register("email")}
            type="email"
            autoComplete="email"
            placeholder="contato@email.com"
            className={inputClass(size)}
          />
        )}
      </FormField>
      <FormField label="Senha" srOnlyLabel error={errors.password?.message} required>
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register("password")}
            autoComplete="current-password"
            placeholder="Senha"
            className={inputClass(size)}
          />
        )}
      </FormField>
      <button
        type="button"
        onClick={() => notAvailable("A recuperação de senha")}
        className={cn("-mt-1 self-end text-primary hover:underline", large ? "text-base" : "text-[0.7rem]")}
      >
        Esqueceu a senha?
      </button>
      <Button type="submit" disabled={login.isPending} className={large ? "mt-4 h-14 rounded-xl text-base" : "mt-1 h-8 text-xs"}>
        {login.isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

const RegisterFormSchema = z
  .object({
    username: usernameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "As senhas não coincidem" });
type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export function RegisterForm({ size, onSuccess }: { size: Size; onSuccess: () => void }) {
  const register = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
    reValidateMode: "onChange",
  });
  const { errors } = form.formState;
  const large = size === "large";

  const submit = form.handleSubmit(({ confirmPassword: _confirm, ...values }) => {
    setFormError(null);
    register.mutate(RegisterInput.parse(values), {
      onSuccess,
      onError: (error) => setFormError(applyServerErrors(error, form.setError, ["username", "email", "password"])),
    });
  });

  return (
    <form onSubmit={submit} noValidate aria-label="Criar conta" className={cn("flex flex-col", large ? "gap-5" : "gap-2.5")}>
      <FormAlert message={formError} />
      <FormField label="Nome de usuário" srOnlyLabel error={errors.username?.message} required>
        {(control) => (
          <Input
            {...control}
            {...form.register("username")}
            autoComplete="username"
            placeholder="Nome de usuário"
            className={cn(inputClass(size), large && "text-center placeholder:text-center")}
          />
        )}
      </FormField>
      <FormField label="E-mail" srOnlyLabel error={errors.email?.message} required>
        {(control) => (
          <Input
            {...control}
            {...form.register("email")}
            type="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            className={inputClass(size)}
          />
        )}
      </FormField>
      <FormField label="Senha" srOnlyLabel error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números." required>
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register("password")}
            autoComplete="new-password"
            placeholder="Senha"
            className={inputClass(size)}
          />
        )}
      </FormField>
      <FormField label="Confirmar senha" srOnlyLabel error={errors.confirmPassword?.message} required>
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register("confirmPassword")}
            autoComplete="new-password"
            placeholder="Confirmar senha"
            className={inputClass(size)}
          />
        )}
      </FormField>
      <Button type="submit" disabled={register.isPending} className={large ? "mt-5 h-14 rounded-xl text-base" : "mt-2 h-8 text-xs"}>
        {register.isPending ? "Criando…" : large ? "Criar perfil" : "Criar conta"}
      </Button>
    </form>
  );
}
