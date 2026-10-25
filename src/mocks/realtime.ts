import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import type { RealtimeEvent } from "@/contracts";
import { db } from "./db";
import { getConfig } from "./config";

/**
 * Servidor Socket.IO simulado.
 *
 * Transporte: o `socket.io-client` da aplicação conecta via WebSocket em
 * `${NEXT_PUBLIC_REALTIME_URL}/socket.io/`. O MSW intercepta o WebSocket no
 * main thread (`ws.link`) e o `@mswjs/socket.io-binding` codifica/decodifica
 * os pacotes Engine.IO/Socket.IO. Nenhum servidor real é contatado.
 *
 * Limitações compensadas aqui:
 * - o binding responde ao handshake mas não envia heartbeats; enviamos pings
 *   Engine.IO ("2") periodicamente para o cliente não encerrar por ping timeout;
 * - não há rooms/namespaces: o isolamento por usuário é feito filtrando as
 *   conexões pelo token da sessão (query `token`) no momento de cada emissão.
 */

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "wss://realtime.kurio.test";
const PING_INTERVAL_MS = 20_000;

// O MSW remove o prefixo "/socket.io/" do caminho antes do match: o link aponta para a raiz.
export const realtimeLink = ws.link(`${REALTIME_URL}/*`);

interface ConnectionEntry {
  id: string;
  token: string | null;
  io: ReturnType<typeof toSocketIo>;
  close: (code: number, reason: string) => void;
}

const connections = new Map<string, ConnectionEntry>();
const eventLog: RealtimeEvent[] = [];
let blockedUntil = 0;

function userIdForToken(token: string | null) {
  if (!token) return null;
  const session = db().sessions.find((s) => s.token === token);
  if (!session || session.expiresAt <= Date.now()) return null;
  return session.userId;
}

export const realtimeHandler = realtimeLink.addEventListener("connection", (connection) => {
  const { client } = connection;

  // Rede indisponível (cenário offline ou queda simulada): recusa a conexão.
  if (getConfig().scenario === "offline" || Date.now() < blockedUntil) {
    queueMicrotask(() => client.close(4000, "network unavailable"));
    return;
  }

  const url = new URL(client.url);
  const io = toSocketIo(connection);
  const entry: ConnectionEntry = {
    id: client.id,
    token: url.searchParams.get("token"),
    io,
    close: (code, reason) => client.close(code, reason),
  };
  connections.set(client.id, entry);

  const ping = setInterval(() => client.send("2"), PING_INTERVAL_MS);

  client.addEventListener("close", () => {
    clearInterval(ping);
    connections.delete(client.id);
  });
});

/**
 * Publica um evento. Eventos privados (`userId`) só chegam às conexões cuja
 * sessão pertence ao mesmo usuário — sessões anteriores/expiradas não recebem.
 */
export function publish(event: RealtimeEvent, options: { log?: boolean } = {}) {
  if (options.log !== false) {
    eventLog.push(event);
    if (eventLog.length > 200) eventLog.shift();
  }
  for (const entry of connections.values()) {
    if (event.userId && userIdForToken(entry.token) !== event.userId) continue;
    entry.io.client.emit(event.type, event);
  }
}

export function getEventLog() {
  return [...eventLog];
}

/** Derruba todas as conexões; novas tentativas são recusadas por `blockMs`. */
export function dropConnections(blockMs = 0) {
  blockedUntil = Date.now() + blockMs;
  for (const entry of [...connections.values()]) entry.close(4001, "simulated disconnect");
}

export function activeConnectionCount() {
  return connections.size;
}
