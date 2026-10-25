"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AddCartItemInput, Cart } from "@/contracts";
import { cartApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { announce } from "@/lib/announce";
import { qk } from "@/lib/query/keys";
import { guestCart } from "@/lib/session/session-store";
import { cartOwnerOf, useSession } from "@/features/session/use-session";

export function useCartOwner() {
  return cartOwnerOf(useSession());
}

export function useCart() {
  const owner = useCartOwner();
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: async ({ signal }) => {
      const cart = await cartApi.get({ signal });
      if (cart.ownerType === "guest") guestCart.set(cart.id);
      return cart;
    },
    staleTime: 15_000,
  });
}

/** Quantidade já no carrinho para uma edição (para limitar novas adições). */
export function useQuantityInCart(nftId: string, editionId: string) {
  const { data } = useCart();
  return data?.items.find((i) => i.nftId === nftId && i.editionId === editionId)?.quantity ?? 0;
}

function useCartMutation<TVariables>(
  mutationFn: (vars: TVariables) => Promise<Cart>,
  options: { success?: (vars: TVariables) => string | null } = {},
) {
  const queryClient = useQueryClient();
  const owner = useCartOwner();
  return useMutation({
    mutationFn,
    onSuccess: (cart, vars) => {
      queryClient.setQueryData(qk.cart(owner), cart);
      void queryClient.invalidateQueries({ queryKey: qk.quotes });
      const message = options.success?.(vars);
      if (message) {
        toast.success(message);
      }
    },
    onError: (error) => {
      const apiError = toApiError(error);
      // Conflito de disponibilidade: recarrega o carrinho com o estado real.
      if (apiError.status === 404 || apiError.status === 409) void queryClient.invalidateQueries({ queryKey: qk.carts });
    },
  });
}

export function useAddToCart() {
  return useCartMutation((input: AddCartItemInput) => cartApi.addItem(input), {
    success: (input) => `${input.quantity > 1 ? `${input.quantity} edições adicionadas` : "Adicionado"} ao carrinho`,
  });
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateItem(itemId, quantity));
}

export function useRemoveCartItem() {
  return useCartMutation(({ itemId }: { itemId: string; name: string }) => cartApi.removeItem(itemId), {
    success: ({ name }) => {
      announce(`${name} removido do carrinho.`);
      return `${name} removido do carrinho`;
    },
  });
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => cartApi.applyCoupon(code), { success: () => "Código promocional aplicado" });
}

export function useRemoveCoupon() {
  return useCartMutation(() => cartApi.removeCoupon(), { success: () => "Código promocional removido" });
}

export function useAcknowledgeCart() {
  return useCartMutation(() => cartApi.acknowledge());
}
