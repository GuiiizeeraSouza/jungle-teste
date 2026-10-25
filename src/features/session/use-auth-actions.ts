"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { LoginInput, RegisterInput, SessionResponse } from "@/contracts";
import { authApi, cartApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import { guestCart, sessionStore } from "@/lib/session/session-store";

/**
 * Preserva os itens do visitante no carrinho do usuário e só então publica a
 * sessão: a UI (redirecionamentos, cache, socket) nunca vê o usuário logado
 * com o carrinho ainda por mesclar.
 */
async function startSession(session: SessionResponse) {
  const guestCartId = guestCart.get();
  let merged = false;
  if (guestCartId) {
    try {
      await cartApi.merge(guestCartId, session.token);
      merged = true;
    } catch {
      /* falha no merge não impede o login; itens seguem no carrinho do visitante */
    }
  }
  if (merged) guestCart.clear();
  sessionStore.signIn({ token: session.token, user: session.user, expiresAt: session.expiresAt });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const session = await authApi.login(input);
      await startSession(session);
      return session;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.carts }),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const session = await authApi.register(input);
      await startSession(session);
      return session;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.carts }),
  });
}

/**
 * Encerra a sessão e leva ao início. A navegação acontece aqui (e não em um
 * callback do componente) porque a área privada é desmontada ao sair.
 */
export function useLogout() {
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const token = sessionStore.token();
      await router.navigate({ to: "/" });
      // Encerra localmente primeiro: cache privado e socket são limpos na hora.
      sessionStore.signOut();
      guestCart.clear();
      if (token) {
        await authApi.logout(token).catch(() => {
          /* o token expira no servidor de qualquer forma */
        });
      }
    },
  });
}
