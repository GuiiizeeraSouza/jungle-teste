import type { User } from "@/contracts";

/**
 * Estado da sessão fora do React (consumido pelo Axios, pelo Router e pelo
 * Socket.IO). O token é persistido para recuperar a sessão após refresh;
 * a validade é sempre confirmada pela API (`GET /auth/session`).
 */

export type SessionState =
  | { status: "anonymous"; reason: "initial" | "logout" | "expired" }
  | { status: "authenticated"; token: string; user: User; expiresAt: string; verified: boolean };

const STORAGE_KEY = "kurio.session";

type Listener = (next: SessionState, previous: SessionState) => void;

function readPersisted(): SessionState {
  if (typeof window === "undefined") return { status: "anonymous", reason: "initial" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "anonymous", reason: "initial" };
    const { token, user, expiresAt } = JSON.parse(raw) as { token: string; user: User; expiresAt: string };
    if (!token || !user) return { status: "anonymous", reason: "initial" };
    return { status: "authenticated", token, user, expiresAt, verified: false };
  } catch {
    return { status: "anonymous", reason: "initial" };
  }
}

let state: SessionState = readPersisted();
const listeners = new Set<Listener>();

function set(next: SessionState) {
  const previous = state;
  state = next;
  try {
    if (next.status === "authenticated") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: next.token, user: next.user, expiresAt: next.expiresAt }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* armazenamento indisponível */
  }
  for (const listener of listeners) listener(next, previous);
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  token: () => (state.status === "authenticated" ? state.token : null),
  userId: () => (state.status === "authenticated" ? state.user.id : null),
  signIn(params: { token: string; user: User; expiresAt: string }) {
    set({ status: "authenticated", ...params, verified: true });
  },
  verify(params: { user: User; expiresAt: string }) {
    if (state.status !== "authenticated") return;
    set({ ...state, ...params, verified: true });
  },
  updateUser(user: User) {
    if (state.status !== "authenticated") return;
    set({ ...state, user });
  },
  signOut() {
    set({ status: "anonymous", reason: "logout" });
  },
  /** Chamado quando a API rejeita o token (expirado/inválido). */
  expire(token: string) {
    if (state.status !== "authenticated" || state.token !== token) return;
    set({ status: "anonymous", reason: "expired" });
  },
};

/* ------------------------- carrinho do visitante ------------------------- */

const CART_KEY = "kurio.cartId";

export const guestCart = {
  get: () => {
    try {
      return localStorage.getItem(CART_KEY);
    } catch {
      return null;
    }
  },
  /**
   * Id do carrinho do visitante gerado no cliente (UUID) antes da primeira
   * requisição: requisições concorrentes nunca criam carrinhos diferentes.
   */
  getOrCreate: () => {
    try {
      let id = localStorage.getItem(CART_KEY);
      if (!id) {
        id = `guest_${crypto.randomUUID()}`;
        localStorage.setItem(CART_KEY, id);
      }
      return id;
    } catch {
      return null;
    }
  },
  set: (id: string) => {
    try {
      localStorage.setItem(CART_KEY, id);
    } catch {
      /* ignora */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(CART_KEY);
    } catch {
      /* ignora */
    }
  },
};
