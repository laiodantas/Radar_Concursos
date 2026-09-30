import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Dashboard from "../src/components/dashboard";
import { fetchPci } from "../src/lib/pci";
import { memoryStore } from "../src/lib/memory-store";
import { synchronize } from "../src/lib/sync";
import { daysRemaining } from "../src/lib/date-utils";
import { themeBootScript } from "../src/lib/theme";

// O tsconfig usa jsx:"preserve" (exigido pelo Next), então o tsx transpila os componentes
// para React.createElement sem importar React. Expomos o global só para renderizar aqui.
(globalThis as unknown as { React?: typeof React }).React = React;

const OUT = "public/preview.html";
const CSS = ".next/static/css/app/layout.css";

async function main() {
  process.env.RADAR_SOURCE = "pci";
  const store = memoryStore();
  console.log("Consultando o MCP da PCI…");
  await synchronize(fetchPci, store);
  const second = await synchronize(fetchPci, store);

  const contests = store.rows().map(row => ({
    id: row.id, title: row.title, organization: row.organization ?? null, roles: row.roles ?? [],
    city: row.city ?? null, uf: row.uf ?? null, region: row.region ?? null,
    vacancies: row.vacancies ?? null, salary: row.salary ?? null,
    registrationStart: row.registrationStart?.toISOString() ?? null,
    registrationEnd: row.registrationEnd?.toISOString() ?? null,
    status: row.status ?? null, sourceUrl: row.sourceUrl ?? null,
    noticeUrl: row.noticeUrl ?? null, applicationUrl: row.applicationUrl ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(), isDemo: false
  }));
  const byId = new Map(contests.map(contest => [contest.id, contest]));
  const events = store.events().map(event => {
    const contest = byId.get(event.concursoId);
    return {
      id: event.id, kind: event.kind, summary: event.summary, createdAt: event.createdAt.toISOString(),
      concurso: { title: contest?.title ?? "", organization: contest?.organization ?? null, sourceUrl: contest?.sourceUrl ?? null }
    };
  }).reverse();
  const now = new Date();
  const closingSoon = contests.filter(contest => {
    const days = contest.registrationEnd ? daysRemaining(contest.registrationEnd, now) : -1;
    return days >= 0 && days <= 7;
  }).length;

  const data = {
    contests, events,
    stats: {
      total: contests.length, newSinceLast: 0, closingSoon, lastSuccessAt: now.toISOString(),
      lastRun: { status: "success", startedAt: now.toISOString(), errorMessage: null, returnedCount: contests.length, expectedCount: second.expectedCount ?? null, truncated: false },
      isDemo: false, source: "PCI Concursos"
    }
  };

  const markup = renderToStaticMarkup(React.createElement(Dashboard, { data }));
  const css = await readFile(CSS, "utf8").catch(() => "");
  if (!css) throw new Error(`CSS não encontrado em ${CSS}. Rode \`npm run dev\` ou \`npm run build\` uma vez antes.`);

  await mkdir("public", { recursive: true });
  await writeFile(OUT, `<!doctype html>
<html lang="pt-BR" style="--font-display:'Archivo Black','Arial Narrow',system-ui,sans-serif;--font-sans:Archivo,ui-sans-serif,system-ui,sans-serif">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Pré-visualização — Radar de Concursos (${contests.length} concursos reais)</title>
<script>${themeBootScript}</script>
<style>${css}</style>
</head>
<body>
<div class="preview-note" style="padding:11px 18px;background:#123d30;color:#fff;font:13px/1.5 var(--sans);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
<span style="font-weight:700;letter-spacing:.08em;font-size:10px;background:#ffffff26;padding:3px 7px;border-radius:2px">INSTANTÂNEO ESTÁTICO</span>
<span>${contests.length} concursos reais vindos do MCP da PCI. Busca, filtros e ordenação não funcionam aqui — abra <a href="/" style="color:#9fe0c2;font-weight:600">o painel interativo</a> para isso.</span>
</div>
${markup}
</body>
</html>
`);
  console.log(`Pré-visualização escrita em ${OUT}: ${contests.length} concursos, ${events.length} novidades, ${closingSoon} encerrando em 7 dias.`);
  console.log("Abra http://localhost:3000/preview.html");
}
main().catch(error => { console.error(`Pré-visualização falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`); process.exitCode = 1; });
