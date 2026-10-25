import type { Socket } from "socket.io-client";
import { RealtimeEvent, REALTIME_EVENTS, type RealtimeEvent as RealtimeEventType } from "@/contracts";
import { whenNetworkReady } from "@/lib/network-gate";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

export interface RealtimeHandlers {
  /** Recebe somente eventos novos (deduplicados e com versão superior). */
  onEvent: (event: RealtimeEventType) => void;
  /** Versão já conhecida pelo cache (REST) — evita regredir estado. */
  knownVersion: (event: RealtimeEventType) => number;
  /** Chamado após uma reconexão: reconciliar recursos ativos via REST. */
  onReconnect: () => void;
}

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "wss://realtime.kurio.test";
const MAX_SEEN = 500;

/**
 * Wrapper do socket.io-client com:
 * - uma conexão por sessão ("época"); trocar de sessão descarta a anterior,
 *   seus listeners e qualquer evento que ainda chegue por ela;
 * - deduplicação por id do evento e ordenação por versão do recurso;
 * - reconciliação via REST a cada reconexão.
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private epoch = 0;
  private seen = new Set<string>();
  private versions = new Map<string, number>();
  private status: RealtimeStatus = "idle";
  private statusListeners = new Set<() => void>();

  constructor(private readonly handlers: RealtimeHandlers) {}

  getStatus = () => this.status;

  subscribeStatus = (listener: () => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const l of this.statusListeners) l();
  }

  connect(token: string | null) {
    this.disconnect();
    const epoch = ++this.epoch;
    this.setStatus("connecting");
    // Import tardio, após o portão de rede: o engine.io-client captura o
    // construtor WebSocket ao ser avaliado (precisa vir depois da interceptação).
    void whenNetworkReady()
      .then(() => import("socket.io-client"))
      .then(({ io }) => {
        if (epoch !== this.epoch) return;
        this.open(io, token, epoch);
      });
  }

  private open(io: typeof import("socket.io-client").io, token: string | null, epoch: number) {
    let hasConnected = false;
    const socket = io(REALTIME_URL, {
      // O MSW intercepta WebSocket; long-polling não é usado.
      transports: ["websocket"],
      query: token ? { token } : {},
      reconnectionDelay: 800,
      reconnectionDelayMax: 4_000,
      timeout: 8_000,
    });
    this.socket = socket;

    socket.on("connect", () => {
      if (epoch !== this.epoch) return;
      this.setStatus("connected");
      if (hasConnected) this.handlers.onReconnect();
      hasConnected = true;
    });
    socket.on("disconnect", () => {
      if (epoch !== this.epoch) return;
      this.setStatus("reconnecting");
    });
    socket.on("connect_error", () => {
      if (epoch !== this.epoch) return;
      this.setStatus(hasConnected ? "reconnecting" : "offline");
    });

    for (const type of REALTIME_EVENTS) {
      socket.on(type, (payload: unknown) => {
        if (epoch !== this.epoch) return;
        this.receive(payload);
      });
    }
  }

  disconnect() {
    this.epoch += 1;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.seen.clear();
    this.versions.clear();
    this.setStatus("idle");
  }

  private receive(payload: unknown) {
    const parsed = RealtimeEvent.safeParse(payload);
    if (!parsed.success) return;
    const event = parsed.data;

    // Duplicata: mesmo id já processado.
    if (this.seen.has(event.id)) return;
    this.seen.add(event.id);
    if (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value!);

    // Evento antigo: versão menor ou igual à já conhecida (socket ou REST).
    const key = `${event.resource.type}:${event.resource.id}`;
    const known = Math.max(this.versions.get(key) ?? 0, this.handlers.knownVersion(event));
    if (event.version <= known) return;
    this.versions.set(key, event.version);

    this.handlers.onEvent(event);
  }
}
