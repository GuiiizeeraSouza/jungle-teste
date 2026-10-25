"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import type { FavoritesResponse } from "@/contracts";
import { favoritesApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { announce } from "@/lib/announce";
import { qk } from "@/lib/query/keys";
import { useSession } from "@/features/session/use-session";

export function useFavorites() {
  const session = useSession();
  const userId = session.status === "authenticated" ? session.user.id : null;
  return useQuery({
    queryKey: qk.favorites(userId ?? "anonymous"),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: Boolean(userId),
  });
}

/**
 * Favoritar com atualização otimista: a UI muda na hora e, se a API falhar,
 * o estado anterior é restaurado (rollback) com feedback acessível.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const session = useSession();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const userId = session.status === "authenticated" ? session.user.id : null;

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; name: string; favorite: boolean }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = qk.favorites(userId!);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoritesResponse>(key);
      const ids = previous?.nftIds ?? [];
      queryClient.setQueryData<FavoritesResponse>(key, {
        nftIds: favorite ? [...ids.filter((id) => id !== nftId), nftId] : ids.filter((id) => id !== nftId),
      });
      return { previous, key };
    },
    onError: (error, { name }, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      const message = `Não foi possível atualizar “${name}” nos favoritos. ${toApiError(error).message}`;
      toast.error("Favoritos não atualizados", { description: message });
      announce(message, "assertive");
    },
    onSuccess: (data, { favorite, name }, context) => {
      queryClient.setQueryData(context.key, data);
      announce(favorite ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`);
    },
  });

  return {
    ...mutation,
    toggle(nftId: string, name: string, favorite: boolean) {
      if (!userId) {
        toast.info("Entre para salvar favoritos", { description: "Seus favoritos ficam salvos na sua conta." });
        void navigate({ to: "/entrar", search: { redirect: href } });
        return;
      }
      mutation.mutate({ nftId, name, favorite });
    },
  };
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites();
  return data?.nftIds.includes(nftId) ?? false;
}
