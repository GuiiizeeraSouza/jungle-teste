# Estado, cache, retries e sincronização

## Camadas

| Camada        | Responsabilidade                                                                   | Onde                                                     |
| ------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Contratos     | Schemas zod compartilhados (transporte ↔ estado ↔ UI)                              | `src/contracts`                                          |
| Transporte    | Axios único, autenticação, normalização de erros, validação das respostas          | `src/lib/api`                                            |
| Estado remoto | TanStack Query (consultas, mutations, cache)                                       | `src/features/**/use-*.ts`, `queries.ts`                 |
| Estado de URL | TanStack Router (`validateSearch`) para busca, filtros, ordenação, página e edição | `src/app-shell/router.tsx`, `features/catalog/search.ts` |
| Sessão        | Store fora do React (Axios, Router e Socket leem)                                  | `src/lib/session`                                        |
| Tempo real    | `socket.io-client` + reconciliação no cache                                        | `src/lib/realtime`                                       |

## Chaves de cache (`src/lib/query/keys.ts`)

- Públicas: `["nfts", "list", params]`, `["nfts", "detail", id]`, `["nfts", "featured"]`, `["nfts", "reviews", id]`.
- **Privadas por usuário**: `["private", userId, ...]` (favoritos, perfil, carteiras, pedidos). A troca de usuário remove o prefixo inteiro.
- Carrinho: `["cart", "user:<id>" | "guest"]`. Cotação: `["quote", owner, network]`.

Os parâmetros da consulta fazem parte da chave, então cada combinação de filtros tem seu próprio cache e respostas de uma combinação nunca aparecem em outra.

## Política

| Item                | Política                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staleTime`         | 30 s (padrão), 15 s carrinho, 60 s destaques, 0 s cotação (sempre revalidada)                                                                                                                                               |
| `gcTime`            | 5 min                                                                                                                                                                                                                       |
| Retry de consultas  | Apenas falhas transitórias (`NETWORK_ERROR`, `TIMEOUT`, 5xx), até 2 novas tentativas, backoff 800 ms → 1,6 s (máx. 4 s). 4xx não repete                                                                                     |
| Retry de mutations  | **Nunca automático**: evita efeitos duplicados. A criação de pedido é idempotente e repetida apenas por ação do usuário ou pela recuperação explícita                                                                       |
| Foco da janela      | Sem refetch automático (eventos em tempo real mantêm os dados atualizados)                                                                                                                                                  |
| Respostas obsoletas | Toda `queryFn` repassa o `AbortSignal` ao Axios; a mudança de parâmetros cancela a requisição anterior, e as chaves separadas impedem que uma resposta atrasada sobrescreva a consulta atual (testado em `catalog.spec.ts`) |
| Paginação/filtros   | `placeholderData: keepPreviousData`: mantém a página anterior esmaecida com indicador "Carregando resultados…"                                                                                                              |

## Invalidação após mutations e eventos

| Gatilho                 | Efeito no cache                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mutations de carrinho   | `setQueryData(cart)` com a resposta + invalida cotações                                                         |
| Cupom aplicado/removido | Idem (o servidor recalcula o resumo)                                                                            |
| Login/cadastro          | Mescla o carrinho do visitante e invalida carrinhos                                                             |
| Favoritar               | **Atualização otimista** com rollback (abaixo)                                                                  |
| Perfil/avatar           | `setQueryData(profile)` e atualiza o usuário da sessão (cabeçalho)                                              |
| Pedido criado           | Grava o pedido no cache e invalida pedidos pendentes                                                            |
| `nft.updated`           | Atualiza preço/disponibilidade no detalhe, listas e destaques; invalida carrinho e cotações e anuncia a mudança |
| `order.updated`         | Atualiza o pedido; se confirmado, invalida carrinho e catálogo                                                  |
| Reconexão do socket     | Invalida NFTs, carrinho, cotações e pedidos (reconciliação via REST)                                            |

## Atualização otimista com rollback

`useToggleFavorite` (`src/features/favorites/use-favorites.ts`):

1. `onMutate`: cancela consultas de favoritos, guarda o snapshot e aplica a mudança na hora.
2. `onError`: restaura o snapshot, exibe toast e anuncia por `aria-live`.
3. `onSuccess`: grava a resposta do servidor (fonte da verdade).

Coberto em `e2e/favorites.spec.ts` com falha 500 simulada.

## Sessão e isolamento entre usuários

- O token fica no `localStorage` para recuperar a sessão após refresh. Na inicialização, `GET /auth/session` confirma a validade.
- Um timer agenda a revalidação no instante de `expiresAt`. Qualquer 401 do token **atual** encerra a sessão. Respostas atrasadas de um token anterior são ignoradas.
- Na troca de identidade (logout, expiração ou outro usuário), `bindSession`:
  - cancela e remove `["private", oldUserId]`, carrinhos e cotações;
  - reconecta o Socket.IO com o novo token (a conexão anterior e seus listeners são descartados);
  - no **logout**, limpa o rascunho e a tentativa de checkout do usuário. Na **expiração**, eles são **preservados** para a retomada.
- Rotas privadas: `beforeLoad` redireciona para `/entrar?redirect=...`, e `AuthGate` cobre a sessão que termina com a página aberta.

## Checkout: cotação, revalidação e idempotência

1. Ao confirmar, o formulário é validado, a carteira é conectada (simulação) e uma **cotação nova** é buscada. Ela vira a "cotação aceita".
2. O diálogo de revisão observa a cotação atual. Se um evento (`nft.updated`) ou a resposta `QUOTE_STALE` trouxer valores diferentes, a confirmação é bloqueada até o usuário aceitar os novos valores.
3. O pedido é enviado com uma **chave de idempotência derivada do conteúdo**, persistida no `sessionStorage`:
   - clique repetido: o botão é desabilitado e, mesmo assim, o servidor reaproveitaria a chave;
   - timeout ou refresh: "Tentar novamente" reenvia a mesma chave e o servidor devolve o **mesmo pedido**;
   - carrinho esvaziado com tentativa em aberto (o pedido foi confirmado mas a resposta se perdeu): o checkout reenvia a tentativa e leva ao pedido.
4. A página do pedido mostra pendente, confirmado ou recusado. Sem Socket.IO conectado, ela consulta o estado a cada 4 s até um estado terminal. O recibo só aparece com `status === "confirmed"`.
