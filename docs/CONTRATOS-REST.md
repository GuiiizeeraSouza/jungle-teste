# Contratos REST

Base: `NEXT_PUBLIC_API_BASE_URL` (padrão `/api/v1`). Todos os schemas estão em [`src/contracts`](../src/contracts) (zod) e são **compartilhados** entre o cliente (validação de respostas e formulários) e o backend simulado (validação de requisições). Toda resposta recebida pelo Axios é validada contra o schema do contrato; divergências viram `ApiError` com código `INVALID_RESPONSE`.

## Convenções

- **Valores em ETH** trafegam sempre como **string decimal** (`"1.19"`, `"0.016"`). Cálculos usam `big.js` (cliente e mock). Quantidades são inteiros.
- **Autenticação**: `Authorization: Bearer <token>`.
- **Carrinho do visitante**: `X-Cart-Id: guest_<uuid>`. O id é gerado pelo cliente antes da primeira requisição, o que garante um único carrinho mesmo com requisições concorrentes.
- **Idempotência**: `Idempotency-Key: <uuid>` em `POST /orders`.
- **Versão de recurso**: `NftSummary.version` e `Order.version` crescem monotonicamente e são usadas para ordenar eventos em tempo real.

## Formato de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Verifique os campos destacados.",
    "fields": { "email": "Informe um e-mail válido" },
    "details": {}
  }
}
```

| HTTP    | `code`                                                                            | Uso                                                             |
| ------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 400/422 | `VALIDATION_ERROR`                                                                | Corpo/parâmetros inválidos (`fields` por campo)                 |
| 401     | `UNAUTHENTICATED` / `SESSION_EXPIRED` / `SESSION_INVALID` / `INVALID_CREDENTIALS` | Sem sessão, sessão expirada/inválida, login incorreto           |
| 403     | `FORBIDDEN`                                                                       | Recurso de outro usuário (ex.: pedido alheio)                   |
| 404     | `NOT_FOUND`                                                                       | Recurso inexistente                                             |
| 409     | `EMAIL_TAKEN` / `USERNAME_TAKEN` / `CONFLICT`                                     | Conflito de cadastro/estado (ex.: pedido pendente em andamento) |
| 409     | `EDITION_UNAVAILABLE` / `QUANTITY_LIMIT` / `AVAILABILITY_CONFLICT`                | Disponibilidade (com `details.quote` quando aplicável)          |
| 409     | `QUOTE_STALE`                                                                     | Cotação mudou (`details.quote` traz a nova)                     |
| 409     | `IDEMPOTENCY_CONFLICT`                                                            | Chave reutilizada com conteúdo diferente                        |
| 409     | `WALLET_REJECTED` / `WALLET_NOT_CONNECTED`                                        | Conexão de carteira recusada/encerrada                          |
| 422     | `COUPON_INVALID` / `COUPON_EXPIRED`                                               | Cupom                                                           |
| 5xx     | `INTERNAL_ERROR` / `SERVICE_UNAVAILABLE`                                          | Falha transitória (repetível em consultas)                      |

Falhas de rede e timeout do cliente viram `NETWORK_ERROR` / `TIMEOUT`, sem resposta HTTP.

## Sessão e conta

| Método | Rota             | Corpo                                           | Resposta                                                          |
| ------ | ---------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| POST   | `/auth/register` | `RegisterInput` `{ username, email, password }` | 201 `SessionResponse` `{ token, expiresAt, user }` · 409 conflito |
| POST   | `/auth/login`    | `LoginInput` `{ email, password }`              | 200 `SessionResponse` · 401 `INVALID_CREDENTIALS`                 |
| GET    | `/auth/session`  | —                                               | 200 `{ user, expiresAt }` · 401 expirada/inválida                 |
| POST   | `/auth/logout`   | —                                               | 204 (encerra a sessão e as conexões de carteira)                  |

Senhas são armazenadas apenas como hash PBKDF2-SHA256 (60 000 iterações, sal por usuário).

## NFTs

| Método | Rota                | Parâmetros                                                                                                                                                                                                     | Resposta                                                                        |
| ------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| GET    | `/nfts`             | `q`, `category` (csv), `network` (csv), `minPrice`, `maxPrice`, `sort` (`recent`·`price-asc`·`price-desc`·`rating`·`name`), `tab` (`all`·`new`·`trending`), `page`, `pageSize` (≤ 48), `collection`, `exclude` | `NftListResponse` `{ items, page, pageSize, total, totalPages, facets }`        |
| GET    | `/nfts/featured`    | —                                                                                                                                                                                                              | `{ spotlight, hero[] }`                                                         |
| GET    | `/nfts/:id`         | —                                                                                                                                                                                                              | `NftDetail` (inclui `editions[]` com `price`, `available`, `maxPerOrder`) · 404 |
| GET    | `/nfts/:id/reviews` | —                                                                                                                                                                                                              | `{ items, average, total }`                                                     |

As contagens de `facets` consideram busca e aba, e não os próprios filtros, para que as opções continuem combináveis.

## Favoritos (autenticado)

| Método | Rota                | Resposta                   |
| ------ | ------------------- | -------------------------- |
| GET    | `/favorites`        | `{ nftIds: string[] }`     |
| PUT    | `/favorites/:nftId` | `{ nftIds }` (idempotente) |
| DELETE | `/favorites/:nftId` | `{ nftIds }` (idempotente) |

## Carrinho (visitante via `X-Cart-Id` ou usuário)

| Método | Rota                  | Corpo                            | Resposta                                             |
| ------ | --------------------- | -------------------------------- | ---------------------------------------------------- |
| GET    | `/cart`               | —                                | `Cart`                                               |
| POST   | `/cart/items`         | `{ nftId, editionId, quantity }` | `Cart` · 409 `EDITION_UNAVAILABLE`/`QUANTITY_LIMIT`  |
| PATCH  | `/cart/items/:itemId` | `{ quantity }`                   | `Cart` (reduzir sempre é permitido)                  |
| DELETE | `/cart/items/:itemId` | —                                | `Cart`                                               |
| PUT    | `/cart/coupon`        | `{ code }`                       | `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED`       |
| DELETE | `/cart/coupon`        | —                                | `Cart`                                               |
| POST   | `/cart/acknowledge`   | —                                | `Cart` (o colecionador ciente das mudanças de preço) |
| POST   | `/cart/merge`         | `{ guestCartId }`                | `Cart` (preserva itens do visitante ao autenticar)   |

`Cart` traz `items[].notices` (`price_changed`, `insufficient_availability`, `sold_out`), `summary` `{ subtotal, discount, networkFee, total, network, feeEstimated }` e `hasBlockingIssues`.

## Cotação

| Método | Rota     | Corpo         | Resposta                                                                                  |
| ------ | -------- | ------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/quote` | `{ network }` | `Quote` `{ id, lines, coupon, subtotal, discount, networkFee, total, issues, expiresAt }` |

`Quote.id` é um hash determinístico do conteúdo (linhas, preços, cupom, rede e taxas). O pedido só é aceito se a cotação enviada for idêntica à atual.

## Conexão de carteira (simulada)

| Método | Rota                      | Corpo                              | Resposta                                                                   |
| ------ | ------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| POST   | `/wallet-connections`     | `{ walletType, network, address }` | 201 `WalletConnection` · 409 `WALLET_REJECTED` · 422 endereço incompatível |
| DELETE | `/wallet-connections/:id` | —                                  | 204                                                                        |

## Pedidos (autenticado)

| Método | Rota                     | Corpo / cabeçalho                                                                                                   | Resposta                                                                                                                                                                                                          |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/orders`                | `Idempotency-Key` + `CreateOrderInput` `{ quoteId, network, walletConnectionId, walletType, walletAddress, buyer }` | 202 `Order` (`pending`) · 200 + `Idempotent-Replayed: true` (mesma chave e conteúdo) · 409 `QUOTE_STALE`/`AVAILABILITY_CONFLICT`/`IDEMPOTENCY_CONFLICT`/`WALLET_NOT_CONNECTED`/`CONFLICT` (já há pedido pendente) |
| GET    | `/orders?status=pending` | —                                                                                                                   | `{ items: Order[] }`                                                                                                                                                                                              |
| GET    | `/orders/:id`            | —                                                                                                                   | `Order` · 403 de outro usuário · 404                                                                                                                                                                              |

O `Order` é um **snapshot**: linhas, preços, desconto, taxa e total congelados na criação. `status` vai de `pending` para `confirmed` ou `rejected`, e os dois são estados terminais. Ao criar, o estoque fica reservado; na confirmação, saem do carrinho apenas as quantidades compradas; na recusa, a reserva é devolvida.

## Perfil e carteiras (autenticado)

| Método | Rota                    | Corpo                                      | Resposta                                |
| ------ | ----------------------- | ------------------------------------------ | --------------------------------------- |
| GET    | `/me/profile`           | —                                          | `User`                                  |
| PATCH  | `/me/profile`           | `ProfileUpdateInput`                       | `User` · 409 conflito de e-mail/usuário |
| PUT    | `/me/avatar`            | `{ dataUrl }` (PNG/JPEG/WebP ≤ 300 KB)     | `User`                                  |
| DELETE | `/me/avatar`            | —                                          | `User`                                  |
| POST   | `/me/password`          | `{ currentPassword, newPassword }`         | 204 · 422 senha atual incorreta         |
| GET    | `/me/wallets`           | —                                          | `{ primary, secondary }`                |
| PUT    | `/me/wallets/primary`   | `WalletInput`                              | `{ primary, secondary }`                |
| PUT    | `/me/wallets/secondary` | `WalletInput` ou `{ sameAsPrimary: true }` | `{ primary, secondary }`                |
| DELETE | `/me/wallets/secondary` | —                                          | `{ primary, secondary }`                |
