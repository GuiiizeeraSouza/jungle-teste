import { AxiosError, isCancel } from "axios";
import { ApiErrorBody, type ErrorCode } from "@/contracts";

export type ClientErrorCode = ErrorCode | "NETWORK_ERROR" | "TIMEOUT" | "CANCELED" | "INVALID_RESPONSE" | "UNKNOWN";

/** Erro normalizado da camada HTTP — a UI só conhece este formato. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ClientErrorCode;
  readonly fields: Record<string, string>;
  readonly details: unknown;

  constructor(params: {
    status: number | null;
    code: ClientErrorCode;
    message: string;
    fields?: Record<string, string>;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.fields = params.fields ?? {};
    this.details = params.details;
  }

  /** Falhas transitórias: seguras para nova tentativa automática em consultas. */
  get retryable() {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT" || (this.status !== null && this.status >= 500);
  }

  get isSessionError() {
    return this.code === "SESSION_EXPIRED" || this.code === "SESSION_INVALID" || this.code === "UNAUTHENTICATED";
  }

  get isNotFound() {
    return this.code === "NOT_FOUND";
  }
}

const NETWORK_MESSAGE = "Não foi possível conectar. Verifique sua conexão e tente novamente.";

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isCancel(error)) return new ApiError({ status: null, code: "CANCELED", message: "Requisição cancelada." });
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ status: null, code: "TIMEOUT", message: "O servidor demorou para responder. Tente novamente." });
    }
    if (!error.response) return new ApiError({ status: null, code: "NETWORK_ERROR", message: NETWORK_MESSAGE });
    const parsed = ApiErrorBody.safeParse(error.response.data);
    if (parsed.success) {
      const { code, message, fields, details } = parsed.data.error;
      return new ApiError({ status: error.response.status, code, message, fields, details });
    }
    return new ApiError({
      status: error.response.status,
      code: error.response.status >= 500 ? "INTERNAL_ERROR" : "UNKNOWN",
      message: "Algo deu errado. Tente novamente em instantes.",
    });
  }
  return new ApiError({ status: null, code: "UNKNOWN", message: "Algo deu errado. Tente novamente em instantes." });
}

export function errorMessage(error: unknown) {
  return toApiError(error).message;
}
