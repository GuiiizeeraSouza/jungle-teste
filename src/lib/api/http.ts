import axios, { type AxiosRequestConfig } from "axios";
import type { ZodType } from "zod";
import { guestCart, sessionStore } from "@/lib/session/session-store";
import { whenNetworkReady } from "@/lib/network-gate";
import { ApiError, toApiError } from "./errors";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
export const CART_HEADER = "X-Cart-Id";

/** Cliente HTTP único da aplicação — todas as chamadas REST passam por aqui. */
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

http.interceptors.request.use(async (config) => {
  await whenNetworkReady();
  const token = sessionStore.token();
  if (config.headers.has("Authorization")) {
    // Token explícito (ex.: logout) prevalece.
  } else if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    const cartId = guestCart.getOrCreate();
    if (cartId) config.headers.set(CART_HEADER, cartId);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    // Só expira a sessão se o 401 veio do token ATUAL (respostas atrasadas de
    // uma sessão anterior não derrubam a sessão nova).
    if (apiError.isSessionError && axios.isAxiosError(error)) {
      const header = error.config?.headers?.get?.("Authorization");
      const sentToken = typeof header === "string" ? header.replace(/^Bearer /, "") : null;
      if (sentToken) sessionStore.expire(sentToken);
    }
    return Promise.reject(apiError);
  },
);

/** Valida a resposta contra o contrato; divergências viram erro tipado. */
function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error("[api] resposta fora do contrato", result.error.issues);
    throw new ApiError({ status: null, code: "INVALID_RESPONSE", message: "Recebemos uma resposta inesperada do servidor." });
  }
  return result.data;
}

export async function request<T>(schema: ZodType<T>, config: AxiosRequestConfig): Promise<T> {
  const response = await http.request(config);
  return parse(schema, response.data);
}

export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config);
}
