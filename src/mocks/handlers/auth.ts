import { HttpResponse, http } from "msw";
import { LoginInput, RegisterInput, type CurrentSessionResponse, type SessionResponse } from "@/contracts";
import { getConfig } from "../config";
import { commit, db, hashPassword, nextId, randomHex, verifyPassword } from "../db";
import { DomainError } from "../domain";
import { api, parseBody, readToken, requireAuth, withConditions } from "../http-utils";

function createSession(userId: string) {
  const state = db();
  const now = Date.now();
  const session = { token: `tok_${randomHex(24)}`, userId, createdAt: now, expiresAt: now + getConfig().sessionTtlMs };
  state.sessions.push(session);
  commit();
  return session;
}

export const authHandlers = [
  http.post(
    api("/auth/register"),
    withConditions(async ({ request }) => {
      const input = await parseBody(request, RegisterInput);
      const state = db();
      const email = input.email.toLowerCase();
      const username = input.username.toLowerCase();
      const fields: Record<string, string> = {};
      if (state.users.some((u) => u.user.email.toLowerCase() === email)) fields.email = "Este e-mail já está cadastrado";
      if (state.users.some((u) => u.user.username.toLowerCase() === username)) fields.username = "Este nome de usuário já está em uso";
      if (Object.keys(fields).length) {
        throw new DomainError(409, fields.email ? "EMAIL_TAKEN" : "USERNAME_TAKEN", "Já existe uma conta com esses dados.", { fields });
      }
      const salt = randomHex(16);
      const user = {
        id: nextId("usr"),
        username: input.username,
        email,
        displayName: input.username,
        avatarUrl: null,
        ensName: null,
        walletNickname: null,
        createdAt: new Date().toISOString(),
      };
      state.users.push({ user, salt, passwordHash: await hashPassword(input.password, salt) });
      state.favorites[user.id] = [];
      state.wallets[user.id] = { primary: null, secondary: null };
      const session = createSession(user.id);
      const body: SessionResponse = { token: session.token, expiresAt: new Date(session.expiresAt).toISOString(), user };
      return HttpResponse.json(body, { status: 201 });
    }),
  ),

  http.post(
    api("/auth/login"),
    withConditions(async ({ request }) => {
      const input = await parseBody(request, LoginInput);
      const record = db().users.find((u) => u.user.email.toLowerCase() === input.email.toLowerCase());
      if (!record || !(await verifyPassword(record, input.password))) {
        throw new DomainError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
      }
      const session = createSession(record.user.id);
      const body: SessionResponse = { token: session.token, expiresAt: new Date(session.expiresAt).toISOString(), user: record.user };
      return HttpResponse.json(body);
    }),
  ),

  http.get(
    api("/auth/session"),
    withConditions(({ request }) => {
      const { session, record } = requireAuth(request);
      const body: CurrentSessionResponse = { user: record.user, expiresAt: new Date(session.expiresAt).toISOString() };
      return HttpResponse.json(body);
    }),
  ),

  http.post(
    api("/auth/logout"),
    withConditions(({ request }) => {
      const token = readToken(request);
      const state = db();
      const session = state.sessions.find((s) => s.token === token);
      if (session) {
        state.sessions = state.sessions.filter((s) => s.token !== token);
        for (const c of state.connections) if (c.userId === session.userId) c.active = false;
        commit();
      }
      return new HttpResponse(null, { status: 204 });
    }),
  ),
];
