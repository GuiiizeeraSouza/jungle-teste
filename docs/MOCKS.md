# Camada de mocks (MSW)

Ativada por configuração (`NEXT_PUBLIC_API_MOCKING=enabled` no `.env`), incluída no build de produção/demonstração. Componentes, hooks e o cliente Axios **não** contêm respostas fictícias: tudo é resolvido na camada de rede.

```
src/mocks/
  browser.ts      setupWorker (REST) + interceptação WebSocket; inicializa banco e configuração
  config.ts       cenários, latência (PRNG com semente), overrides por rota
  db.ts           "banco" do backend: seed determinístico, persistência no localStorage, reset
  domain.ts       regras de negócio (catálogo, carrinho, cotação, pedidos, reservas)
  fixtures.ts     36 NFTs (9 do layout + 27 gerados com semente), 2 usuários, cupons, taxas
  handlers/       handlers HTTP por recurso (validam corpo com os contratos zod)
  realtime.ts     servidor Socket.IO simulado (@mswjs/socket.io-binding)
  control.ts      API de controle (window.__kurioMock) usada pelo painel e pelo Playwright
  panel.tsx       painel de demonstração (opt-in)
```

## Dados

- **Usuários** (senha `Kurio2026`): `nova@kurio.test` (Nova Sato, com carteiras principal e secundária e 2 favoritos) e `leo@kurio.test` (Leo Prado, só com a carteira principal).
- **Cupons**: `KURIO10` (10%), `GENESIS5` (0.05 ETH), `VERAO25` (expirado).
- **Taxas de rede**: Ethereum 0.016, Polygon 0.002, Solana 0.0009 ETH.
- **Edições por NFT**: 1/1, 1/10, 1/50 (padrão) e Aberta, com disponibilidade e limite por pedido próprios (ex.: Emerald Ape 1/1 esgotada).

O estado (catálogo, usuários, sessões, carrinhos, favoritos, carteiras, pedidos e conexões) é único e consistente entre os recursos. Ele é persistido no `localStorage` para sobreviver a refresh, e o **reset** restaura integralmente o seed (`window.__kurioMock.reset()` ou o botão do painel).

## Cenários (`?mock=<id>`, painel ou `__kurioMock.setScenario`)

| id                      | Comportamento                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `default`               | Latência 80–260 ms (semente fixa)                                                               |
| `slow`                  | 2,5–4 s por requisição                                                                          |
| `variable`              | 50 ms–2,5 s                                                                                     |
| `out-of-order`          | Listagens alternam respostas lentas (2,2 s) e rápidas                                           |
| `offline`               | Toda requisição falha na rede; o socket é recusado                                              |
| `server-error`          | 500 persistente no catálogo                                                                     |
| `flaky`                 | 1ª tentativa de cada consulta retorna 503 (o retry automático recupera)                         |
| `empty-catalog`         | Catálogo vazio                                                                                  |
| `session-expired`       | Sessões expiram 20 s após o login                                                               |
| `payment-declined`      | Pedidos são recusados                                                                           |
| `order-timeout`         | O pedido é criado, mas a 1ª resposta excede o timeout do cliente (recuperação por idempotência) |
| `price-change-checkout` | O preço sobe 0.10 ETH no momento da confirmação                                                 |
| `sold-out-checkout`     | A edição esgota no momento da confirmação                                                       |
| `wallet-reject`         | A carteira recusa a conexão                                                                     |
| `manual-orders`         | Pedidos ficam pendentes até a resolução manual                                                  |

Os cenários são reproduzíveis: a latência usa um PRNG com semente e os gatilhos de corrida disparam uma vez por reset.

## Controle (`window.__kurioMock`)

`reset(scenario?)`, `setScenario(id)`, `failNext({ method, path, exact?, status?, failure?: "network" | "timeout", delayMs?, times? })`, `setPrice(nftId, editionId, price)`, `setAvailability(nftId, editionId, n)`, `expireSessions()`, `disconnectRealtime(blockMs)`, `disconnectWallets()`, `resolveOrder(id, "confirmed" | "rejected")`, `latestOrderId()`, `replayEvent(eventId)`, `emitStaleNftEvent(nftId, price)`, `events()`, `connections()`, `state()`.

Toda ação altera o banco do servidor simulado, que responde via REST **e** publica os eventos Socket.IO correspondentes.

## Painel de demonstração

Abra com `?mocks=painel` (fica salvo; `?mocks=off` desativa) ou **Alt+Shift+M**. Ele permite trocar o cenário, alterar preço ou estoque do primeiro item do carrinho, expirar sessões, derrubar o Socket.IO, desconectar carteiras, confirmar ou recusar o último pedido e resetar os dados. O painel não aparece por padrão, para não interferir na regressão visual nem na auditoria.
