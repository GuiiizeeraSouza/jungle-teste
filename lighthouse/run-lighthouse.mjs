/**
 * Executa a auditoria Lighthouse definida em lighthouse.config.mjs.
 *
 * Pré-requisito: build de produção servido em LH_BASE_URL (padrão :3100):
 *   npm run build && npx next start -p 3100
 *
 * Saída (lighthouse/reports/):
 *   <perfil>-<página>-<n>.report.html|json   relatórios de cada medição
 *   summary.json / summary.md                medianas, métricas e ambiente
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import config from "./lighthouse.config.mjs";

const require = createRequire(import.meta.url);

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    // Usa o Chromium do Playwright quando não há Chrome instalado.
    return require("playwright-core").chromium.executablePath();
  } catch {
    return undefined;
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const outDir = path.resolve(config.outputDir);
fs.mkdirSync(outDir, { recursive: true });

const executablePath = chromePath();
const results = [];
let chromeVersion = "desconhecida";

for (const profile of config.profiles) {
  for (const page of config.pages) {
    for (let run = 1; run <= config.runs; run++) {
      // Chrome novo a cada medição: perfil limpo, sem cache, Service Worker ou storage.
      const chrome = await chromeLauncher.launch({
        chromePath: executablePath,
        chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"],
      });
      try {
        const url = `${config.baseUrl}${page.path}`;
        const runnerResult = await lighthouse(
          url,
          { port: chrome.port, output: ["html", "json"], logLevel: "error", onlyCategories: config.categories },
          profile === "desktop" ? desktopConfig : undefined,
        );
        const lhr = runnerResult.lhr;
        chromeVersion = lhr.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? chromeVersion;
        const base = `${profile}-${page.id}-${run}`;
        fs.writeFileSync(path.join(outDir, `${base}.report.html`), runnerResult.report[0]);
        fs.writeFileSync(path.join(outDir, `${base}.report.json`), runnerResult.report[1]);
        const entry = {
          profile,
          page: page.id,
          url,
          run,
          scores: Object.fromEntries(config.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
          metrics: {
            LCP: lhr.audits["largest-contentful-paint"].numericValue,
            CLS: lhr.audits["cumulative-layout-shift"].numericValue,
            TBT: lhr.audits["total-blocking-time"].numericValue,
            FCP: lhr.audits["first-contentful-paint"].numericValue,
          },
          lighthouseVersion: lhr.lighthouseVersion,
        };
        results.push(entry);
        console.log(
          `${base}: ${JSON.stringify(entry.scores)} LCP=${Math.round(entry.metrics.LCP)}ms CLS=${entry.metrics.CLS.toFixed(3)} TBT=${Math.round(entry.metrics.TBT)}ms`,
        );
      } finally {
        await chrome.kill();
      }
    }
  }
}

const summary = [];
for (const profile of config.profiles) {
  for (const page of config.pages) {
    const runs = results.filter((r) => r.profile === profile && r.page === page.id);
    summary.push({
      profile,
      page: page.id,
      runs: runs.length,
      median: Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
      metrics: {
        LCP: Math.round(median(runs.map((r) => r.metrics.LCP))),
        CLS: Number(median(runs.map((r) => r.metrics.CLS)).toFixed(3)),
        TBT: Math.round(median(runs.map((r) => r.metrics.TBT))),
        FCP: Math.round(median(runs.map((r) => r.metrics.FCP))),
      },
    });
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const environment = {
  date: new Date().toISOString(),
  baseUrl: config.baseUrl,
  build: "next build + next start (produção), NEXT_PUBLIC_API_MOCKING=enabled, cenário de mocks padrão",
  lighthouse: results[0]?.lighthouseVersion,
  chrome: chromeVersion,
  node: process.version,
  next: require("next/package.json").version,
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: os.cpus()[0]?.model,
  memoryGb: Math.round(os.totalmem() / 1024 ** 3),
  throttling: {
    mobile: "padrão Lighthouse (simulado): RTT 150 ms, 1,6 Mbps, CPU 4x",
    desktop: "preset desktop: RTT 40 ms, 10 Mbps, CPU 1x",
  },
  app: `${pkg.name}@${pkg.version}`,
};

fs.writeFileSync(
  path.join(outDir, "summary.json"),
  JSON.stringify({ environment, targets: config.targets, summary, runs: results }, null, 2),
);

const mark = (category, value) => (value >= config.targets[category] ? `${value} ✅` : `${value} ⚠️`);
const lines = [
  "# Lighthouse — resumo (mediana de 3 medições)",
  "",
  "| Perfil | Página | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...summary.map(
    (s) =>
      `| ${s.profile} | ${s.page} | ${mark("performance", s.median.performance)} | ${mark("accessibility", s.median.accessibility)} | ${mark("best-practices", s.median["best-practices"])} | ${mark("seo", s.median.seo)} | ${(s.metrics.LCP / 1000).toFixed(2)} s | ${s.metrics.CLS} | ${s.metrics.TBT} ms |`,
  ),
  "",
  "## Ambiente",
  "",
  ...Object.entries(environment).map(([k, v]) => `- **${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`),
  "",
];
fs.writeFileSync(path.join(outDir, "summary.md"), lines.join("\n"));
console.log(`\n${lines.join("\n")}`);
