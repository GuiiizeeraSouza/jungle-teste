"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PasswordChangeInput, ProfileUpdateInput, SecondaryWalletInput, User, WalletInput, WalletsResponse } from "@/contracts";
import { profileApi, walletsApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import { sessionStore } from "@/lib/session/session-store";
import { useCurrentUser } from "@/features/session/use-session";

function useUserId() {
  return useCurrentUser()?.id ?? "anonymous";
}

export function useProfile() {
  const userId = useUserId();
  return useQuery({ queryKey: qk.profile(userId), queryFn: ({ signal }) => profileApi.get({ signal }) });
}

function useProfileMutation<T>(fn: (vars: T) => Promise<User>) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => {
      queryClient.setQueryData(qk.profile(userId), user);
      sessionStore.updateUser(user);
    },
  });
}

export const useUpdateProfile = () => useProfileMutation((input: ProfileUpdateInput) => profileApi.update(input));
export const useSetAvatar = () => useProfileMutation((dataUrl: string) => profileApi.setAvatar(dataUrl));
export const useRemoveAvatar = () => useProfileMutation(() => profileApi.removeAvatar());

export function useChangePassword() {
  return useMutation({ mutationFn: (input: PasswordChangeInput) => profileApi.changePassword(input) });
}

function useWalletsMutation<T>(fn: (vars: T) => Promise<WalletsResponse>) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: fn,
    onSuccess: (wallets) => queryClient.setQueryData(qk.wallets(userId), wallets),
  });
}

export const useSavePrimaryWallet = () => useWalletsMutation((input: WalletInput) => walletsApi.savePrimary(input));
export const useSaveSecondaryWallet = () => useWalletsMutation((input: SecondaryWalletInput) => walletsApi.saveSecondary(input));
export const useRemoveSecondaryWallet = () => useWalletsMutation(() => walletsApi.removeSecondary());
