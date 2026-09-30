import { db } from "./db";
import { demoResult } from "./demo";
import { trackedContestFields } from "./normalize";
import { fetchPci } from "./pci";
import { daysRemaining } from "./date-utils";

const value = (x: unknown) => x instanceof Date ? x.toISOString() : JSON.stringify(x ?? null);
function safeError(error: unknown) {
  let message=error instanceof Error?error.message:"Falha desconhecida";
  for(const secret of [process.env.SYNC_SECRET,process.env.DATABASE_URL,process.env.PCI_MCP_URL]) if(secret) message=message.split(secret).join("[credencial removida]");
  return message.slice(0,500);
}
export async function synchronize(pciFetcher: typeof fetchPci = fetchPci, storage: typeof db = db) {
  const sourceName = process.env.RADAR_SOURCE === "pci" ? "pci" : "demo";
  const run = await storage.syncRun.create({ data: { status: "running", source: sourceName } });
  try {
    const fetched = sourceName === "pci" ? await pciFetcher() : demoResult();
    if (!fetched.contests.length) throw new Error("Fonte vazia; histórico preservado.");
    const previous = await storage.syncRun.findFirst({ where: { source: sourceName, status: "success" }, orderBy: { completedAt: "desc" } });
    const baseline = !previous;
    const now = new Date();
    for (const item of fetched.contests) {
      const existing = await storage.concurso.findUnique({ where: { sourceKey: item.sourceKey } });
      const data = {
        sourceUrl: item.sourceUrl, title: item.title, organization: item.organization, roles: item.roles,
        city: item.city, uf: item.uf, region: item.region, vacancies: item.vacancies, salary: item.salary,
        registrationStart: item.registrationStart, registrationEnd: item.registrationEnd, status: item.status,
        noticeUrl: item.noticeUrl, applicationUrl: item.applicationUrl, lastSeenAt: now, contentHash: item.contentHash,
        raw: item.raw as object, isDemo: sourceName === "demo"
      };
      const record = existing
        ? await storage.concurso.update({ where: { id: existing.id }, data })
        : await storage.concurso.create({ data: { ...data, sourceKey: item.sourceKey, firstSeenAt: now } });
      if (!existing && !baseline) await storage.radarEvent.create({ data: { concursoId: record.id, kind: "new", summary: "Primeira vez que este concurso aparece no radar", changes: { detectedAt: now.toISOString() } } });
      if (existing && existing.contentHash !== item.contentHash) {
        const changes = trackedContestFields.filter(k => value(existing[k]) !== value(item[k])).map(k => ({ field: k, from: existing[k] instanceof Date ? existing[k].toISOString() : existing[k] ?? null, to: item[k] instanceof Date ? item[k].toISOString() : item[k] ?? null }));
        if (changes.length) await storage.radarEvent.create({ data: { concursoId: record.id, kind: "changed", summary: "Prazo, vagas ou outro dado do concurso mudou", changes: changes as object[] } });
      }
      const days = item.registrationEnd ? daysRemaining(item.registrationEnd, now) : Infinity;
      // Na execução base todo concurso está "novo"; avisar de prazo já na base inundaria as novidades.
      if (!baseline && days >= 0 && days <= 7) {
        const recent = await storage.radarEvent.findFirst({ where: { concursoId: record.id, kind: "deadline", createdAt: { gte: new Date(now.getTime() - 7*86_400_000) } } });
        if (!recent) await storage.radarEvent.create({ data: { concursoId: record.id, kind: "deadline", summary: `Inscrições encerram em ${days} ${days === 1 ? "dia" : "dias"}` } });
      }
    }
    const returnedCount = fetched.contests.length;
    const expectedCount = fetched.expectedCount ?? null;
    await storage.syncRun.update({ where: { id: run.id }, data: { status: "success", completedAt: now, isBaseline: baseline, returnedCount, expectedCount } });
    return { ok: true, count: returnedCount, expectedCount, baseline, source: sourceName, notes: fetched.notes };
  } catch (error) {
    const message = safeError(error);
    await storage.syncRun.update({ where: { id: run.id }, data: { status: "failed", completedAt: new Date(), errorMessage: message } });
    throw new Error(message);
  }
}
