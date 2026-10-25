# Tempo real (Socket.IO)

## Transporte

- **Cliente**: `socket.io-client` 4.x, `transports: ["websocket"]`, reconexão automática (800 ms → 4 s). URL: `NEXT_PUBLIC_REALTIME_URL` (padrão `wss://realtime.kurio.test`), com o token da sessão em `query.token`.
- **Servidor simulado**: o MSW intercepta o `WebSocket` no main thread (`ws.link`) e o `@mswjs/socket.io-binding` codifica e decodifica os pacotes Engine.IO/Socket.IO. Nenhum servidor real é contatado (`src/mocks/realtime.ts`).
- O cliente carrega o `socket.io-client` **depois** que a camada de rede está pronta, porque o `engine.io-client` captura o construtor `WebSocket` ao ser avaliado.

### Limitações do ambiente de mocks (e como foram tratadas)

| Limitação                                                 | Tratamento                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Sem long-polling: o MSW intercepta só WebSocket           | Cliente configurado só com `websocket`                                                                                             |
| O binding responde ao handshake, mas não envia heartbeats | O mock envia ping Engine.IO (`"2"`) a cada 20 s                                                                                    |
| Sem rooms/namespaces                                      | Isolamento por usuário filtrando conexões pelo token da sessão no momento de cada emissão                                          |
| O MSW remove o prefixo `/socket.io/` antes do match       | O link aponta para a raiz do host (`${URL}/*`)                                                                                     |
| O "servidor" vive na aba (main thread)                    | Cada aba/contexto tem seu próprio servidor; o banco é persistido no `localStorage` e sincronizado entre abas pelo evento `storage` |

## Eventos

Envelope comum (`src/contracts/realtime.ts`):

```ts
{ id: string; type: "nft.updated" | "order.updated"; resource: { type, id }; version: number; occurredAt: string; userId: string | null; data: {...} }
```

| Evento          | `data`                                                                    | Efeito no cliente                                                                                                             |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `nft.updated`   | `nftId, price, compareAtPrice, available, editions[], reason`             | Atualiza detalhe, listas e destaques; o carrinho/cotação são revalidados; aviso no carrinho e no detalhe; toast + `aria-live` |
| `order.updated` | `orderId, status, txHash, explorerUrl, failureReason` (privado: `userId`) | Atualiza o pedido; confirma ou recusa com feedback; invalida o carrinho na confirmação                                        |

## Garantias no cliente (`src/lib/realtime`)

- **Duplicatas**: ids já processados são ignorados (janela de 500 ids).
- **Eventos antigos**: `version <= max(versão vista no socket, versão no cache REST)` é descartado, sem regredir nem reaplicar efeitos.
- **Validação**: todo payload passa pelo schema zod do contrato.
- **Sessão**: cada conexão tem uma "época". Ao trocar de sessão, a conexão antiga é descartada (`removeAllListeners` + `disconnect`) e eventos que ainda cheguem por ela são ignorados. `order.updated` de outro `userId` nunca toca o cache. O servidor simulado também só entrega eventos privados às conexões do dono.
- **Reconexão**: após reconectar, NFTs, carrinho, cotações e pedidos são invalidados e re-buscados via REST (eventos perdidos durante a queda são reconciliados).
- **Ciclo de vida**: `bindSession` desconecta o socket e libera timers e listeners no unmount.

## Cenário obrigatório: preço muda com item no carrinho

1. Um NFT está no carrinho.
2. O servidor simulado altera o preço ou a disponibilidade (painel de mocks, `window.__kurioMock.setPrice(...)` ou cenário `price-change-checkout`): o banco muda (REST) e publica `nft.updated` (socket).
3. O carrinho mostra o aviso por item ("Preço alterado de X para Y"), um banner, um toast e o anúncio `aria-live`, e o resumo é recalculado pela API.
4. No checkout, a revisão aberta detecta que a cotação aceita ficou desatualizada e bloqueia "Confirmar e pagar" até o usuário aceitar os novos valores. No servidor, o `POST /orders` também recusa uma cotação divergente (`QUOTE_STALE`).

Testes: `e2e/realtime.spec.ts` (todos passam pelo `socket.io-client`; a UI nunca é alterada diretamente).
