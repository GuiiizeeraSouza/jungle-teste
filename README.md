# Kurio — Marketplace de NFTs

Implementação do desafio frontend "NFT Marketplace" a partir do layout do Figma. Os fluxos de descoberta, compra e conta funcionam ponta a ponta sobre uma API REST e um servidor Socket.IO **simulados com MSW**.

| Responsabilidade      | Tecnologia                                                      |
| --------------------- | --------------------------------------------------------------- |
| Framework / build     | Next.js 16 (Pages Router, Turbopack)                            |
| Interface / linguagem | React 19 + TypeScript (strict)                                  |
| Roteamento            | TanStack Router (rotas, search params, guards, 404)             |
| Estado remoto         | TanStack Query                                                  |
| HTTP                  | Axios (único cliente, contratos validados com zod)              |
| Tempo real            | socket.io-client                                                |
| Estilo / componentes  | Tailwind CSS 4 + shadcn/ui (Radix) adaptados à identidade Kurio |
| Mocks                 | MSW 2 (REST + WebSocket) + `@mswjs/socket.io-binding`           |
| Testes                | Playwright (E2E + regressão visual)                             |
| Auditoria             | Lighthouse 13                                                   |

## Como executar

Requisitos: Node 20+ (testado com 22.19) e npm.

```bash
npm install
npx playwright install chromium      # para os testes E2E e o Lighthouse

npm run dev                          # http://localhost:3000 (mocks ativos)

npm run build && npm start           # build de produção/demonstração em http://localhost:3000
```

Os mocks são ativados por configuração (`.env`: `NEXT_PUBLIC_API_MOCKING=enabled`) e fazem parte do build de demonstração.

**Credenciais fictícias** (senha `Kurio2026`): `nova@kurio.test` (com carteiras e favoritos) e `leo@kurio.test`.
**Cupons**: `KURIO10` (válido), `GENESIS5` (válido), `VERAO25` (expirado).
**Painel de mocks**: abra qualquer página com `?mocks=painel` (ou Alt+Shift+M) para trocar cenários (rede lenta, offline, pagamento recusado, timeout…), alterar preço/estoque em tempo real, expirar sessões, derrubar o Socket.IO e resetar os dados. Veja [docs/MOCKS.md](docs/MOCKS.md).

## Testes

```bash
npm run test:e2e            # constrói, sobe o build de produção na porta 3100 e roda tudo (desktop 1440 + mobile 390)
npm run test:e2e:report     # relatório HTML (playwright-report/)
npm run test:e2e:update     # regenera as baselines visuais (e2e/__screenshots__/)
```

- Cada teste parte de um **estado isolado**: contexto de navegador novo, com localStorage, Service Worker e banco do mock no cenário conhecido. O cenário é definido por teste (`test.use({ scenario })`).
- REST passa pelos handlers MSW; tempo real passa pelo `socket.io-client`. Os testes agem no "servidor" (`window.__kurioMock`) e observam a interface.
- Tempo controlado: relógio do Playwright (`page.clock`) na expiração de sessão, latência e falhas por override de rota, disparo manual de eventos e resolução manual de pedidos (`manual-orders`).
- Falhas geram trace, vídeo e screenshot (`test-results/`). O relatório fica em `playwright-report/` (o da última execução está versionado).
- Regressão visual em DPR 1, com folha de estilo de captura (`e2e/visual.css`) que fixa a reamostragem de imagens, para capturas determinísticas. Baselines em `e2e/__screenshots__/`.
- 3 workers locais e 1 retry: cada contexto roda um Service Worker do MSW, e em máquinas modestas o paralelismo alto pode fazer o Chromium perder respostas do worker. Testes repetidos aparecem como "flaky" no relatório.

**Última execução**: 110 testes (55 × desktop 1440 + 55 × mobile 390, Chromium, build de produção): **110 passaram**, 0 flaky.

| Arquivo              | Cobertura                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.spec.ts`    | Busca, filtros combinados, ordenação, paginação, histórico/refresh, resultado vazio, respostas fora de ordem                                                              |
| `nft-detail.spec.ts` | Acesso direto, NFT inexistente, rota 404, edição esgotada, limite de quantidade                                                                                           |
| `auth.spec.ts`       | Cadastro (validação/conflito), login, retorno ao fluxo, expiração na navegação e no checkout, logout e troca de usuário                                                   |
| `favorites.spec.ts`  | Otimista com rollback em falha, recuperação e persistência                                                                                                                |
| `cart.spec.ts`       | Quantidades, remoção, cupom válido/inválido/expirado, resumo, refresh, merge no login, disponibilidade                                                                    |
| `checkout.spec.ts`   | Compra completa até o recibo, recusa, clique repetido, timeout + idempotência, carteira recusada/desconectada, preço alterado e edição esgotada na confirmação, validação |
| `realtime.spec.ts`   | `nft.updated` no carrinho e no checkout, duplicatas/eventos antigos, desconexão com pedido pendente, refresh, isolamento entre sessões                                    |
| `account.spec.ts`    | Perfil (validação/conflito), avatar, senha, carteiras principal/secundária                                                                                                |
| `a11y.spec.ts`       | Teclado e foco visível, foco em diálogos/drawers, erros associados aos campos, alternativas textuais, overflow em 390/768/1440                                            |
| `loading.spec.ts`    | Skeletons com shimmer, movimento reduzido, erro 500/offline com nova tentativa, retry automático, falha de mutation                                                       |
| `visual.spec.ts`     | Regressão visual de Início, Detalhe, Carrinho e Pagamento (desktop e mobile)                                                                                              |

## Lighthouse

```bash
npm run build && npx next start -p 3100   # em outro terminal
npm run lighthouse                         # 3 medições × (Início, Detalhe) × (mobile, desktop)
```

A configuração versionada fica em [`lighthouse/lighthouse.config.mjs`](lighthouse/lighthouse.config.mjs). Os relatórios HTML/JSON de cada medição e o resumo (medianas, LCP/CLS/TBT, versões e ambiente) ficam em `lighthouse/reports/`.

Mediana de 3 medições (build de produção, cenário padrão dos mocks):

| Perfil  | Página  | Performance | Accessibility | Best Practices | SEO | LCP    | CLS | TBT    |
| ------- | ------- | ----------- | ------------- | -------------- | --- | ------ | --- | ------ |
| desktop | Início  | 97          | 96            | 100            | 100 | 1,18 s | 0   | 89 ms  |
| desktop | Detalhe | 98          | 97            | 100            | 100 | 1,18 s | 0   | 61 ms  |
| mobile  | Início  | 60          | 96            | 100            | 100 | 5,47 s | 0   | 855 ms |
| mobile  | Detalhe | 60          | 96            | 100            | 100 | 5,19 s | 0   | 883 ms |

A Performance mobile fica abaixo da meta porque a API e o Socket.IO simulados (MSW) rodam no main thread e os dados só existem no cliente; sob CPU 4× isso domina o LCP e o TBT. Causas, medições e otimizações aplicadas: [docs/LIGHTHOUSE.md](docs/LIGHTHOUSE.md).

## Arquitetura

```
src/
  pages/            Next.js: _document (metadados, preload do hero), _app (fonte local), [[...slug]] (catch-all)
  app-shell/        bootstrap do cliente, providers, rotas TanStack Router, layout raiz, páginas de status
  contracts/        schemas zod compartilhados por app e mocks (REST + eventos)
  lib/              api (Axios, erros, endpoints), query (client, keys), realtime, session, eth (big.js), forms
  features/         catalog, nft, cart, checkout, orders, auth, account, favorites, session
  components/       ui (shadcn adaptados), layout (header, footer, navs), shared
  mocks/            MSW: handlers, domínio, banco, cenários, Socket.IO simulado, painel
e2e/                Playwright (fixtures, specs, baselines)
lighthouse/         configuração, script e relatórios
docs/               contratos, estado/cache, tempo real, mocks, Lighthouse
```

### Por que Next.js com Pages Router + TanStack Router

O Next.js entrega o documento estático (metadados, fonte local otimizada, imagens otimizadas via `next/image`) e o TanStack Router assume o roteamento no cliente: search params tipados, guards de autenticação, preload por intenção e 404. Todas as URLs caem em uma página catch-all.

O **App Router** foi avaliado e descartado: ele intercepta `history.pushState`/`replaceState` de terceiros e reescreve o histórico dentro de um `useInsertionEffect`, o que conflita com o TanStack Router (gerava "useInsertionEffect must not schedule updates" e re-renderizava a árvore inteira a cada navegação). O Pages Router não intercepta o histórico, e `Router.beforePopState(() => false)` deixa o TanStack Router como único dono da navegação.

### Decisões de UX/robustez relevantes

- **ETH como string decimal** e aritmética com `big.js`; a formatação segue o layout (`1.19 ETH`, `26.846 ETH`, `(-) 00.00`).
- **Carrinho do visitante** com id gerado no cliente (sem corrida entre requisições), mesclado ao autenticar.
- **Checkout** com cotação aceita × cotação atual, chave de idempotência por conteúdo e recuperação automática do pedido. Detalhes em [docs/ESTADO-E-CACHE.md](docs/ESTADO-E-CACHE.md).
- **Portão de rede**: a interface renderiza antes de o Service Worker do MSW ficar pronto, e REST/Socket.IO aguardam o portão (`src/lib/network-gate.ts`).
- Ações fora do escopo (login social, recuperação de senha, editoriais, atividade, ofertas, downloads) mostram um aviso "ainda não está disponível" e não aparentam sucesso. Links externos (redes sociais, compartilhar, explorer) abrem em nova aba com aviso acessível.

Documentação complementar:

- [Contratos REST](docs/CONTRATOS-REST.md)
- [Estado, cache, retries e sincronização](docs/ESTADO-E-CACHE.md)
- [Tempo real](docs/TEMPO-REAL.md)
- [Mocks e cenários](docs/MOCKS.md)
- [Lighthouse](docs/LIGHTHOUSE.md)

## Fidelidade ao layout, assets e acessibilidade

- **Assets**: as quatro artes dos NFTs foram extraídas dos PDFs do Figma em 1254×1254 px (`public/nfts/`) e servidas via `next/image` (AVIF/WebP). Os PDFs só trazem quatro artes; os demais NFTs do catálogo reutilizam essas artes, e a galeria do detalhe usa enquadramentos (zoom) da mesma arte. A fonte (Roboto Mono, mesma métrica do layout; arquivos `.woff2` do projeto Fontsource, licença OFL, em `src/fonts/`) é servida localmente via `next/font/local`. Os ícones de redes sociais são SVGs próprios, porque o lucide 1.x não traz logotipos de marcas. O ícone "Thank you" do recibo foi redesenhado em SVG.
- **Telas sem frame no Figma** (perfil, carteiras e confirmação no mobile; estados de erro, vazio, pendente e recusado) seguem os mesmos tokens e componentes.
- **Ajustes de acessibilidade em relação ao layout**:
  - placeholders não são usados como rótulo: todo campo tem `<label>`, mesmo que visualmente oculto (login/cadastro);
  - erros ficam associados por `aria-describedby` e `aria-invalid`;
  - estados de seleção (filtros, abas, edições, carteiras) não dependem só de cor: há marcador, peso de fonte e `aria-pressed`/`aria-checked`;
  - toasts aparecem abaixo da barra superior para não cobrir a navegação;
  - foco visível em todos os controles e retorno de foco ao fechar diálogos/drawers;
  - link "Pular para o conteúdo" e anúncios `aria-live` para atualizações em tempo real;
  - `prefers-reduced-motion` desliga o shimmer e as animações;
  - sem overflow horizontal em 390/768/1440.
