import { HttpResponse, http } from "msw";
import {
  AvatarInput,
  PasswordChangeInput,
  ProfileUpdateInput,
  SecondaryWalletInput,
  WalletInput,
  type Wallet,
  type WalletSlot,
} from "@/contracts";
import { commit, db, hashPassword, randomHex, verifyPassword } from "../db";
import { DomainError } from "../domain";
import { api, parseBody, requireAuth, withConditions } from "../http-utils";

function walletsOf(userId: string) {
  const state = db();
  state.wallets[userId] ??= { primary: null, secondary: null };
  return state.wallets[userId];
}

function toWallet(userId: string, slot: WalletSlot, input: WalletInput, sameAsPrimary = false): Wallet {
  return {
    id: `wal_${userId}_${slot}`,
    slot,
    ...input,
    secondaryAddress: input.secondaryAddress || null,
    sameAsPrimary,
    updatedAt: new Date().toISOString(),
  };
}

export const accountHandlers = [
  /* --------------------------------- perfil ------------------------------- */

  http.get(
    api("/me/profile"),
    withConditions(({ request }) => HttpResponse.json(requireAuth(request).record.user)),
  ),

  http.patch(
    api("/me/profile"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const input = await parseBody(request, ProfileUpdateInput);
      const others = db().users.filter((u) => u.user.id !== record.user.id);
      const fields: Record<string, string> = {};
      if (others.some((u) => u.user.email.toLowerCase() === input.email.toLowerCase())) fields.email = "Este e-mail já está em uso";
      if (others.some((u) => u.user.username.toLowerCase() === input.username.toLowerCase()))
        fields.username = "Este nome de usuário já está em uso";
      if (Object.keys(fields).length) {
        throw new DomainError(409, fields.email ? "EMAIL_TAKEN" : "USERNAME_TAKEN", "Alguns dados já estão em uso.", { fields });
      }
      record.user = { ...record.user, ...input, email: input.email.toLowerCase() };
      commit();
      return HttpResponse.json(record.user);
    }),
  ),

  http.put(
    api("/me/avatar"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const { dataUrl } = await parseBody(request, AvatarInput);
      record.user = { ...record.user, avatarUrl: dataUrl };
      commit();
      return HttpResponse.json(record.user);
    }),
  ),

  http.delete(
    api("/me/avatar"),
    withConditions(({ request }) => {
      const { record } = requireAuth(request);
      record.user = { ...record.user, avatarUrl: null };
      commit();
      return HttpResponse.json(record.user);
    }),
  ),

  http.post(
    api("/me/password"),
    withConditions(async ({ request }) => {
      const { record, session } = requireAuth(request);
      const input = await parseBody(request, PasswordChangeInput);
      if (!(await verifyPassword(record, input.currentPassword))) {
        throw new DomainError(422, "VALIDATION_ERROR", "Senha atual incorreta.", { fields: { currentPassword: "Senha atual incorreta" } });
      }
      if (input.currentPassword === input.newPassword) {
        throw new DomainError(422, "VALIDATION_ERROR", "A nova senha deve ser diferente da atual.", {
          fields: { newPassword: "A nova senha deve ser diferente da atual" },
        });
      }
      record.salt = randomHex(16);
      record.passwordHash = await hashPassword(input.newPassword, record.salt);
      // Encerra as demais sessões do usuário, mantendo a atual.
      const state = db();
      state.sessions = state.sessions.filter((s) => s.userId !== record.user.id || s.token === session.token);
      commit();
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  /* -------------------------------- carteiras ----------------------------- */

  http.get(
    api("/me/wallets"),
    withConditions(({ request }) => {
      const { record } = requireAuth(request);
      return HttpResponse.json(walletsOf(record.user.id));
    }),
  ),

  http.put(
    api("/me/wallets/primary"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const input = await parseBody(request, WalletInput);
      const wallets = walletsOf(record.user.id);
      wallets.primary = toWallet(record.user.id, "primary", input);
      if (wallets.secondary?.sameAsPrimary) {
        wallets.secondary = { ...wallets.primary, id: `wal_${record.user.id}_secondary`, slot: "secondary", sameAsPrimary: true };
      }
      commit();
      return HttpResponse.json(wallets);
    }),
  ),

  http.put(
    api("/me/wallets/secondary"),
    withConditions(async ({ request }) => {
      const { record } = requireAuth(request);
      const input = await parseBody(request, SecondaryWalletInput);
      const wallets = walletsOf(record.user.id);
      if ("sameAsPrimary" in input) {
        if (!wallets.primary) {
          throw new DomainError(409, "CONFLICT", "Cadastre a carteira principal antes de replicá-la.");
        }
        wallets.secondary = {
          ...wallets.primary,
          id: `wal_${record.user.id}_secondary`,
          slot: "secondary",
          sameAsPrimary: true,
          updatedAt: new Date().toISOString(),
        };
      } else {
        if (wallets.primary && wallets.primary.address.toLowerCase() === input.address.toLowerCase()) {
          throw new DomainError(422, "VALIDATION_ERROR", "Use “Igual à carteira principal” para repetir o mesmo endereço.", {
            fields: { address: "Este endereço já é a sua carteira principal" },
          });
        }
        wallets.secondary = toWallet(record.user.id, "secondary", input);
      }
      commit();
      return HttpResponse.json(wallets);
    }),
  ),

  http.delete(
    api("/me/wallets/secondary"),
    withConditions(({ request }) => {
      const { record } = requireAuth(request);
      const wallets = walletsOf(record.user.id);
      wallets.secondary = null;
      commit();
      return HttpResponse.json(wallets);
    }),
  ),
];
