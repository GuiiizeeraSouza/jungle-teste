import type { FieldErrors, FieldValues, Path, Resolver, UseFormSetError } from "react-hook-form";
import type { ZodType } from "zod";
import { toApiError } from "@/lib/api/errors";

/** Resolver zod mínimo para react-hook-form (mesmos schemas da API). */
export function zodResolver<TIn extends FieldValues, TOut = TIn>(schema: ZodType<TOut, TIn>): Resolver<TIn, unknown, TOut> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (key && !errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<TIn> };
  };
}

/**
 * Aplica erros por campo retornados pela API no formulário.
 * Retorna a mensagem geral quando nenhum campo conhecido foi afetado.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, known: readonly string[]) {
  const apiError = toApiError(error);
  let applied = false;
  for (const [field, message] of Object.entries(apiError.fields)) {
    if (known.includes(field)) {
      setError(field as Path<T>, { type: "server", message }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied ? null : apiError.message;
}
