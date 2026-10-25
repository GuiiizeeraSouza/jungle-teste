"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FieldControlProps {
  id: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
  "aria-required": boolean | undefined;
}

interface FormFieldProps {
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  /** Oculta visualmente o label (mantém acessível). */
  srOnlyLabel?: boolean;
  children: (control: FieldControlProps) => React.ReactNode;
}

/** Label + controle + erro associados por id (aria-describedby / aria-invalid). */
export function FormField({ label, required, error, hint, className, srOnlyLabel, children }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm text-foreground", srOnlyLabel && "sr-only")}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-base leading-none text-destructive">
            *
          </span>
        )}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": required || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[3px] text-muted-foreground hover:text-primary"
      >
        {visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** Mensagem de erro geral do formulário (anunciada). */
export function FormAlert({ message, tone = "error" }: { message?: string | null; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[3px] border px-3 py-2 text-sm",
        tone === "error" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/10 text-foreground",
      )}
    >
      {message}
    </p>
  );
}
