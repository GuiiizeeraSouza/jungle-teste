import { AlertTriangle, PackageOpen, RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
  className?: string;
}

export function ErrorState({ error, onRetry, retrying, title, className }: ErrorStateProps) {
  const apiError = toApiError(error);
  const offline = apiError.code === "NETWORK_ERROR" || apiError.code === "TIMEOUT";
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 rounded-md border border-border bg-card px-6 py-10 text-center", className)}
    >
      <Icon className="size-8 text-primary" aria-hidden />
      <h2 className="text-base font-bold">{title ?? (offline ? "Sem conexão com o servidor" : "Não foi possível carregar")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{apiError.message}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} className="mt-1">
          <RotateCw className={cn(retrying && "animate-spin")} aria-hidden />
          {retrying ? "Tentando novamente…" : "Tentar novamente"}
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center", className)}>
      <PackageOpen className="size-9 text-primary" aria-hidden />
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

/** Indicador discreto de atualização em segundo plano. */
export function BackgroundRefresh({ active, label = "Atualizando…" }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <RotateCw className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </span>
  );
}
