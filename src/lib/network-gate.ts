/**
 * Portão de rede: permite renderizar a interface antes de a camada de rede
 * estar pronta (ex.: Service Worker em registro). Requisições REST e o
 * Socket.IO aguardam o portão; a UI já pode exibir conteúdo estático e skeletons.
 */
let gate: Promise<unknown> = Promise.resolve();

export function setNetworkGate(ready: Promise<unknown>) {
  gate = ready.catch((error) => {
    console.error("[network] falha ao preparar a camada de rede", error);
  });
}

export function whenNetworkReady() {
  return gate;
}
