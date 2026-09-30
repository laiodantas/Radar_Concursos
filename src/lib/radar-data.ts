import { db } from "./db";
import { daysRemaining } from "./date-utils";
export async function getRadarData() {
  const demoMode = process.env.RADAR_SOURCE !== "pci";
  const sourceName = demoMode ? "demo" : "pci";
  const activeRecords = { isDemo: demoMode };
  const [contests, lastOk, lastRun, events] = await Promise.all([
    // `raw` guarda o JSON completo da fonte e nenhuma tela o usa: omiti-lo evita transferir
    // centenas de KB por carregamento e deixa a renderização bem mais rápida.
    db.concurso.findMany({ where: activeRecords, orderBy: [{ firstSeenAt: "desc" }], omit: { raw: true } }),
    db.syncRun.findFirst({ where: { source: sourceName, status: "success" }, orderBy: { completedAt: "desc" } }),
    db.syncRun.findFirst({ where: { source: sourceName }, orderBy: { startedAt: "desc" } }),
    db.radarEvent.findMany({ where: { concurso: activeRecords }, include: { concurso: { select: { title: true, organization: true, sourceUrl: true } } }, orderBy: { createdAt: "desc" }, take: 25 })
  ]);
  const lastSuccessAt = lastOk?.completedAt?.toISOString() ?? null;
  const lastStart = lastOk?.startedAt;
  const fresh = lastStart ? await db.radarEvent.count({ where: { kind: "new", createdAt: { gte: lastStart }, concurso: activeRecords } }) : 0;
  // `contests` já é a lista completa de registros ativos: total e contagem de prazos saem dela,
  // evitando idas extras ao banco. A regra é a mesma dos cartões: dias civis em America/Sao_Paulo.
  const total = contests.length;
  const closingSoon = contests.filter(c => { const days = c.registrationEnd ? daysRemaining(c.registrationEnd) : null; return days !== null && days >= 0 && days <= 7; }).length;
  return {
    contests: contests.map(c => ({ ...c, registrationStart: c.registrationStart?.toISOString() ?? null, registrationEnd: c.registrationEnd?.toISOString() ?? null, firstSeenAt: c.firstSeenAt.toISOString(), lastSeenAt: c.lastSeenAt.toISOString(), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
    events: events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
    stats: { total, newSinceLast: fresh, closingSoon, lastSuccessAt, lastRun: lastRun ? { status: lastRun.status, startedAt: lastRun.startedAt.toISOString(), errorMessage: lastRun.status === "failed" ? lastRun.errorMessage : null, returnedCount: lastRun.returnedCount, expectedCount: lastRun.expectedCount, truncated: lastRun.status === "success" && lastRun.expectedCount !== null && lastRun.returnedCount < lastRun.expectedCount } : null, isDemo: demoMode, source: demoMode ? "Demonstração" : "PCI Concursos" }
  };
}
