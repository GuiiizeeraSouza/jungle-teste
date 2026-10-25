# Lighthouse: resultados e análise

Configuração versionada: [`lighthouse/lighthouse.config.mjs`](../lighthouse/lighthouse.config.mjs) · script: [`lighthouse/run-lighthouse.mjs`](../lighthouse/run-lighthouse.mjs) · relatórios HTML/JSON de cada medição e resumo: [`lighthouse/reports/`](../lighthouse/reports) (`summary.md` e `summary.json`).

## Condições de execução

- **Build otimizado**: `next build` + `next start -p 3100`, com a camada de mocks ativa (mesmo artefato da demonstração), **cenário padrão** dos mocks, imagens via `next/image`, fonte local e todas as funcionalidades (MSW + Socket.IO simulado). Nenhuma simplificação específica para a auditoria.
- **Páginas**: Início (`/`) e Detalhe do NFT (`/nft/emerald-ape-042`).
- **Perfis**: mobile (padrão do Lighthouse: Moto G Power emulado, throttling simulado RTT 150 ms / 1,6 Mbps / CPU 4×) e desktop (preset oficial `desktop-config`: RTT 40 ms / 10 Mbps / CPU 1×).
- **3 medições** por página e perfil, cada uma num Chrome novo (perfil limpo, sem cache, Service Worker ou storage). O resumo usa a **mediana**.
- **Ferramentas e ambiente**: Lighthouse 13.5.0, Chromium 156 (Playwright), Node 22.19.0, Next.js 16.4.3, Windows 11 x64, Intel i5-12450HX, 8 GB RAM. O servidor e o Chrome rodaram na mesma máquina, sem outros processos pesados durante a medição.

## Resultados (mediana de 3)

| Perfil  | Página  | Performance | Accessibility | Best Practices | SEO        | LCP    | CLS | TBT    |
| ------- | ------- | ----------- | ------------- | -------------- | ---------- | ------ | --- | ------ |
| desktop | Início  | **97** ✅   | **96** ✅     | **100** ✅     | **100** ✅ | 1,18 s | 0   | 89 ms  |
| desktop | Detalhe | **98** ✅   | **97** ✅     | **100** ✅     | **100** ✅ | 1,18 s | 0   | 61 ms  |
| mobile  | Início  | 60 ⚠️       | **96** ✅     | **100** ✅     | **100** ✅ | 5,47 s | 0   | 855 ms |
| mobile  | Detalhe | 60 ⚠️       | **96** ✅     | **100** ✅     | **100** ✅ | 5,19 s | 0   | 883 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Todas são atingidas no desktop. No mobile, só **Performance** fica abaixo da meta.

## Por que a Performance mobile fica abaixo de 90

O LCP e o TBT do mobile são dominados por **execução de JavaScript sob CPU 4× mais lenta**. Duas características da entrega, ambas exigidas pelo desafio, pesam aqui:

1. **O backend roda dentro da página.** Com MSW, a API REST e o servidor Socket.IO são executados no main thread do navegador. Isso adiciona cerca de 117 KB (gzip) de JS (MSW, interceptors, parsers Engine.IO/Socket.IO, regras de negócio e fixtures), a inicialização do Service Worker e o processamento de cada requisição no mesmo thread que renderiza a UI. No perfil de CPU (4×), o chunk de mocks responde por cerca de 0,45–0,6 s de script, e o runtime React + Router + Query por cerca de 0,4–0,8 s.
2. **Os dados só existem no cliente.** O elemento de LCP no mobile é a **primeira imagem do catálogo** (Início) ou a **arte do NFT** (Detalhe). Os dois dependem da resposta da API simulada, então só podem ser pintados depois de: baixar e avaliar o JS do app e dos mocks → registrar e ativar o Service Worker → responder a requisição → renderizar. O detalhamento do LCP observado mostra exatamente isso: _element render delay_ de 1,0–1,6 s com o download da imagem em apenas 18–34 ms. A simulação 4× amplia esse intervalo para cerca de 5,2–5,5 s.

Com uma API real, os itens 1 e 2 deixariam de existir em grande parte: sem o chunk de mocks e sem o Service Worker, e com a possibilidade de renderizar os dados no servidor (SSR/SSG da listagem e do detalhe).

## O que foi otimizado (sem remover funcionalidades)

| Medida                                                                                                                                   | Efeito                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Portão de rede**: a UI renderiza antes de o MSW ficar pronto; REST e Socket.IO aguardam o portão                                       | O hero/skeleton aparece sem esperar o registro do Service Worker (FCP ≈ 0,9 s)                                                                                                                                        |
| **Renderização fatiada**: montagem do app em `startTransition` e dados do catálogo/detalhe via `useDeferredValue`                        | O React renderiza em fatias em vez de uma tarefa longa síncrona. TBT mobile: medições isoladas antes da mudança ficavam em 2,4–2,8 s; a mediana oficial depois dela é 0,86–0,88 s (há variância alta entre execuções) |
| **Preload da arte do hero** no HTML (só na rota `/`), com `srcset`/`sizes` idênticos ao `<Image>`                                        | Download da imagem do LCP desktop começa no parse do HTML                                                                                                                                                             |
| **`priority`** (preload + `fetchpriority=high`) nas primeiras imagens do catálogo                                                        | Imagem do LCP mobile baixada assim que os dados chegam                                                                                                                                                                |
| **`main` com altura mínima da viewport**                                                                                                 | CLS do detalhe desktop 0,193 → 0 (o rodapé não sobe para a dobra durante o carregamento)                                                                                                                              |
| **Barra lateral do catálogo só em telas ≥ 1024 px** (antes era só escondida por CSS)                                                     | Menos render e nenhuma imagem desperdiçada no mobile                                                                                                                                                                  |
| **Seed do mock sem PBKDF2 em runtime** (hashes pré-computados) e persistência agrupada por tick                                          | Menos trabalho na primeira carga e por requisição                                                                                                                                                                     |
| `socket.io-client` carregado sob demanda; fonte local com `next/font` (`display: swap`); AVIF/WebP com `deviceSizes` ajustados ao layout | Menos JS crítico, sem FOIT, imagens menores                                                                                                                                                                           |

Um experimento descartado: adiar seções abaixo da dobra para o tempo ocioso piorou o TBT, porque apenas moveu o trabalho para dentro da janela medida. Ele foi revertido.

## Reprodução

```bash
npm run build
npx next start -p 3100        # em outro terminal
npm run lighthouse            # LH_RUNS=3 por padrão; LH_BASE_URL para outro host
```

A pontuação mobile varia com a carga da máquina, porque o throttling de CPU é simulado sobre o trace observado. Medições com outros processos pesados rodando chegaram a cair 15–25 pontos.
