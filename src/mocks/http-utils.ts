import { HttpResponse, delay, type DefaultBodyType, type HttpResponseResolver, type PathParams } from "msw";
import type { ZodType } from "zod";
import type { ApiErrorBody, ErrorCode } from "@/contracts";
import { countRequest, getConfig, nextLatency, takeOverride } from "./config";
import { commit, db } from "./db";
import { DomainError } from "./domain";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
export const api = (path: string) => `${API_BASE}${path}`;

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown } = {},
) {
  const body: ApiErrorBody = { error: { code, message, ...extra } };
  return HttpResponse.json(body, { status });
}

const STATUS_CODE: Record<number, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  500: "INTERNAL_ERROR",
  502: "SERVICE_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
  504: "SERVICE_UNAVAILABLE",
};

/** Timeout simulado: segura a resposta muito além do timeout do Axios. */
const HANG_MS = 60_000;

/**
 * Envolve um resolver aplicando as condições de rede configuradas
 * (offline, overrides por rota, latência, falhas por cenário) e convertendo
 * erros de domínio em respostas HTTP padronizadas.
 */
export function withConditions<Params extends PathParams>(
  resolver: HttpResponseResolver<Params, DefaultBodyType, DefaultBodyType>,
): HttpResponseResolver<Params, DefaultBodyType, DefaultBodyType> {
  return async (info) => {
    const { request } = info;
    const url = new URL(request.url);
    const config = getConfig();

    if (config.scenario === "offline") {
      await delay(nextLatency());
      return HttpResponse.error();
    }

    const override = takeOverride(request.method, url.pathname);
    if (override) {
      if (override.delayMs) await delay(override.delayMs);
      if (override.failure === "network") return HttpResponse.error();
      if (override.failure === "timeout") {
        await delay(HANG_MS);
        return HttpResponse.error();
      }
      if (override.status) {
        return errorResponse(override.status, STATUS_CODE[override.status] ?? "INTERNAL_ERROR", `Falha simulada (${override.status}).`);
      }
    }

    const isCatalogList = request.method === "GET" && url.pathname === api("/nfts");
    if (config.scenario === "out-of-order" && isCatalogList) {
      // Requisições ímpares lentas, pares rápidas: a resposta antiga chega depois da nova.
      const n = countRequest("catalog-list");
      await delay(n % 2 === 1 ? 2200 : 150);
    } else {
      await delay(nextLatency());
    }

    if (config.scenario === "server-error" && request.method === "GET" && url.pathname.startsWith(api("/nfts"))) {
      return errorResponse(500, "INTERNAL_ERROR", "Erro interno simulado no catálogo.");
    }
    if (config.scenario === "flaky" && request.method === "GET" && countRequest(`flaky:${url.pathname}${url.search}`) === 1) {
      return errorResponse(503, "SERVICE_UNAVAILABLE", "Serviço temporariamente indisponível.");
    }

    try {
      return await resolver(info);
    } catch (error) {
      if (error instanceof DomainError) return errorResponse(error.status, error.code, error.message, error.extra);
      console.error("[mock] erro inesperado", error);
      return errorResponse(500, "INTERNAL_ERROR", "Erro interno inesperado.");
    }
  };
}

/** Valida o corpo com o mesmo schema zod do contrato. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new DomainError(400, "VALIDATION_ERROR", "Corpo da requisição inválido.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    throw new DomainError(422, "VALIDATION_ERROR", "Verifique os campos destacados.", { fields });
  }
  return result.data;
}

/* ------------------------------ autenticação ------------------------------ */

export function readToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export function authenticate(request: Request) {
  const token = readToken(request);
  if (!token) return null;
  const state = db();
  const session = state.sessions.find((s) => s.token === token);
  if (!session) throw new DomainError(401, "SESSION_INVALID", "Sessão inválida. Entre novamente.");
  if (session.expiresAt <= Date.now()) {
    state.sessions = state.sessions.filter((s) => s.token !== token);
    commit();
    throw new DomainError(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente para continuar.");
  }
  const record = state.users.find((u) => u.user.id === session.userId);
  if (!record) throw new DomainError(401, "SESSION_INVALID", "Sessão inválida. Entre novamente.");
  return { session, record };
}

export function requireAuth(request: Request) {
  const auth = authenticate(request);
  if (!auth) throw new DomainError(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.");
  return auth;
}
