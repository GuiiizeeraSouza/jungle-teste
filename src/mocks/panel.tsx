"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import type { EditionId } from "@/contracts";
import { eth } from "@/lib/eth";
import { SCENARIOS, type ScenarioId } from "./config";

const FLAG = "kurio.mockPanel";

/**
 * Painel de demonstração da camada de mocks. Todas as ações passam pelo
 * backend simulado (`window.__kurioMock`): alteram o banco do mock, que
 * responde via REST e publica os eventos Socket.IO correspondentes.
 *
 * Opt-in: `?mocks=painel` (persistido) ou Alt+Shift+M.
 */
export function MockPanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("default");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    try {
      if (params.get("mocks") === "painel") localStorage.setItem(FLAG, "1");
      if (params.get("mocks") === "off") localStorage.removeItem(FLAG);
      setEnabled(localStorage.getItem(FLAG) === "1");
    } catch {
      /* sem storage */
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyM") {
        setEnabled(true);
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open && window.__kurioMock) setScenario(window.__kurioMock.getConfig().scenario);
  }, [open]);

  if (!enabled) return null;
  const mock = window.__kurioMock;
  if (!mock) return null;

  const note = (text: string) => setLog((l) => [`${new Date().toLocaleTimeString("pt-BR")} — ${text}`, ...l].slice(0, 6));

  /** Primeiro item do carrinho do usuário logado (ou o NFT padrão do layout). */
  const target = (): { nftId: string; editionId: EditionId } => {
    const state = mock.state();
    const session = JSON.parse(localStorage.getItem("kurio.session") ?? "null") as { user?: { id: string } } | null;
    const cartId = localStorage.getItem("kurio.cartId");
    const cart = state.carts.find((c) => (session?.user ? c.ownerId === session.user.id : c.id === cartId));
    const item = cart?.items[0];
    return item ? { nftId: item.nftId, editionId: item.editionId } : { nftId: "emerald-ape-042", editionId: "1-50" };
  };

  const actions: Array<[string, () => void | Promise<void>]> = [
    [
      "Aumentar preço (+0.10 ETH)",
      () => {
        const t = target();
        const edition = mock
          .state()
          .nfts.find((n) => n.id === t.nftId)!
          .editions.find((e) => e.id === t.editionId)!;
        mock.setPrice(t.nftId, t.editionId, eth.add(edition.price, "0.10"));
        note(`Preço de ${t.nftId} (${t.editionId}) alterado`);
      },
    ],
    [
      "Reduzir estoque para 1",
      () => {
        const t = target();
        mock.setAvailability(t.nftId, t.editionId, 1);
        note(`Estoque de ${t.nftId} reduzido para 1`);
      },
    ],
    [
      "Esgotar edição",
      () => {
        const t = target();
        mock.setAvailability(t.nftId, t.editionId, 0);
        note(`${t.nftId} esgotado`);
      },
    ],
    ["Expirar sessões", () => (mock.expireSessions(), note("Sessões expiradas"))],
    ["Derrubar Socket.IO (5 s)", () => (mock.disconnectRealtime(5000), note("Socket.IO desconectado"))],
    ["Desconectar carteiras", () => (mock.disconnectWallets(), note("Carteiras desconectadas"))],
    [
      "Confirmar último pedido",
      () => {
        const id = mock.latestOrderId();
        if (id) mock.resolveOrder(id, "confirmed");
        note(id ? `Pedido ${id} confirmado` : "Nenhum pedido");
      },
    ],
    [
      "Recusar último pedido",
      () => {
        const id = mock.latestOrderId();
        if (id) mock.resolveOrder(id, "rejected");
        note(id ? `Pedido ${id} recusado` : "Nenhum pedido");
      },
    ],
  ];

  return (
    <div className="fixed bottom-24 left-3 z-[60] md:bottom-3">
      {open ? (
        <section
          aria-label="Painel de mocks"
          className="w-80 max-w-[calc(100vw-1.5rem)] rounded-md border border-border bg-card p-3 text-xs shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Mocks (MSW + Socket.IO)</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel de mocks" className="text-primary">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <label className="flex flex-col gap-1">
            Cenário
            <select
              value={scenario}
              onChange={(e) => {
                const next = e.target.value as ScenarioId;
                mock.setScenario(next);
                setScenario(next);
                note(`Cenário: ${next}`);
              }}
              className="h-8 rounded-[3px] border border-input bg-input-bg px-2"
            >
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
                <option key={id} value={id}>
                  {id} — {SCENARIOS[id]}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {actions.map(([label, run]) => (
              <button
                key={label}
                type="button"
                onClick={() => void run()}
                className="rounded-[3px] border border-border px-2 py-1.5 text-left hover:border-primary"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={async () => {
                await mock.reset(scenario);
                localStorage.removeItem("kurio.session");
                localStorage.removeItem("kurio.cartId");
                sessionStorage.clear();
                window.location.reload();
              }}
              className="col-span-2 rounded-[3px] bg-primary px-2 py-1.5 font-bold text-primary-foreground"
            >
              Resetar dados (cenário conhecido)
            </button>
          </div>
          {log.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-[0.65rem] text-muted-foreground" aria-live="polite">
              {log.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir painel de mocks"
          className="grid size-10 place-items-center rounded-full border border-primary bg-card text-primary shadow-lg"
        >
          <FlaskConical className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
