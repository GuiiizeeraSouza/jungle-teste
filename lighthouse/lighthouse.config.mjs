/**
 * Configuração versionada da auditoria Lighthouse.
 *
 * - Build otimizado (`next build && next start`) com a camada de mocks ativa
 *   (mesmo artefato da demonstração) e o cenário padrão dos mocks.
 * - Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento simulado,
 *   CPU 4x) e desktop (preset oficial `desktop-config`).
 * - 3 medições por página e perfil; o relatório reporta a mediana.
 */
export default {
  baseUrl: process.env.LH_BASE_URL ?? "http://localhost:3100",
  runs: Number(process.env.LH_RUNS ?? 3),
  pages: [
    { id: "inicio", path: "/" },
    { id: "detalhe", path: "/nft/emerald-ape-042" },
  ],
  profiles: ["mobile", "desktop"],
  categories: ["performance", "accessibility", "best-practices", "seo"],
  targets: { performance: 90, accessibility: 95, "best-practices": 95, seo: 90 },
  outputDir: "lighthouse/reports",
};
