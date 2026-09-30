import { db } from "./db";
import { daysTo, registrationState } from "./contest-state";
import { salaryText } from "./normalize";
import { educationText, newsImage } from './contest-enrichment';
export async function getRadarData() {
  const demoMode = process.env.RADAR_SOURCE !== "pci";
  const sourceName = demoMode ? "demo" : "pci";
  const activeRecords = { isDemo: demoMode };
  const [contests, lastOk, lastRun, events, salarySources] = await Promise.all([
    // `raw` guarda o JSON completo da fonte: omiti-lo evita transferir
    // centenas de KB por carregamento e deixa a renderização bem mais rápida.
    db.concurso.findMany({ where: activeRecords, orderBy: [{ firstSeenAt: "desc" }], omit: { raw: true } }),
    db.syncRun.findFirst({ where: { source: sourceName, status: "success" }, orderBy: { completedAt: "desc" } }),
    db.syncRun.findFirst({ where: { source: sourceName }, orderBy: { startedAt: "desc" } }),
    db.radarEvent.findMany({ where: { concurso: activeRecords }, include: { concurso: { select: { title: true, organization: true, sourceUrl: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
    // Extrai remuneração, escolaridade e imagem sem transferir o JSON completo.
    // Preserva qualificadores em registros sincronizados antes desta revisão.
    db.$queryRaw<Array<{ id: string; salarySource: string | null; education: string | null; image: string | null }>>`SELECT id, COALESCE(raw->>'vagas_salario', raw->>'remuneracao', raw->>'remuneração', raw->>'salary', raw->>'salario') AS "salarySource", raw->>'formacao' AS education, raw->'noticia'->>'imagem' AS image FROM "Concurso" WHERE "isDemo" = ${demoMode}`
  ]);
  const lastSuccessAt = lastOk?.completedAt?.toISOString() ?? null;
  const lastStart = lastOk?.startedAt;
  const fresh = lastStart ? await db.radarEvent.count({ where: { kind: "new", createdAt: { gte: lastStart }, concurso: activeRecords } }) : 0;
  // `contests` já é a lista completa de registros ativos: total e contagem de prazos saem dela,
  // evitando idas extras ao banco. A regra é a mesma dos cartões: dias civis em America/Sao_Paulo.
  const total = contests.length;
  const now = new Date();
  const salaryMap = new Map(salarySources.map(row => [row.id, salaryText(row.salarySource)]));
  const enrichment = new Map(salarySources.map(row => [row.id, { education: educationText(row.education), newsImageUrl: newsImage(row.image) }]));
  const closingSoon = contests.filter(c => registrationState(c, now) === "open" && (daysTo(c.registrationEnd, now) ?? Infinity) <= 7).length;
  return {
    asOf: now.toISOString(),
    contests: contests.map(c => ({ ...c, ...enrichment.get(c.id), salary: salaryMap.get(c.id) ?? c.salary, registrationStart: c.registrationStart?.toISOString() ?? null, registrationEnd: c.registrationEnd?.toISOString() ?? null, firstSeenAt: c.firstSeenAt.toISOString(), lastSeenAt: c.lastSeenAt.toISOString(), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
    events: events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
    stats: { total, newSinceLast: fresh, closingSoon, lastSuccessAt, lastRun: lastRun ? { status: lastRun.status, startedAt: lastRun.startedAt.toISOString(), errorMessage: lastRun.status === "failed" ? lastRun.errorMessage : null, returnedCount: lastRun.returnedCount, expectedCount: lastRun.expectedCount, truncated: lastRun.status === "success" && lastRun.expectedCount !== null && lastRun.returnedCount < lastRun.expectedCount } : null, isDemo: demoMode, source: demoMode ? "Demonstração" : "PCI Concursos" }
  };
}
