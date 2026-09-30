import type { db } from './db';
import { demoResult } from './demo';
import { trackedContestFields, uniqueBySourceKey } from './normalize';
import { fetchPci } from './pci';
import { daysTo, registrationState } from './contest-state';
const value = (x: unknown) => x instanceof Date ? x.toISOString() : JSON.stringify(x ?? null);
const jsonValue = (x: unknown) => x instanceof Date ? x.toISOString() : x ?? null;
function safeError(error: unknown) {
  let message = error instanceof Error ? error.message : 'Falha desconhecida';
  for (const secret of [process.env.SYNC_SECRET, process.env.DATABASE_URL, process.env.DIRECT_URL, process.env.PCI_MCP_URL]) if (secret) message = message.split(secret).join('[credencial removida]');
  return message.slice(0, 500);
}
export async function synchronize(pciFetcher: typeof fetchPci = fetchPci, storage?: typeof db) {
  const target = storage ?? (await import('./db')).db;
  const sourceName = process.env.RADAR_SOURCE === 'pci' ? 'pci' : 'demo';
  const run = await target.syncRun.create({ data: { status: 'running', source: sourceName } });
  try {
    // Consulta externa fora da transação: não mantém o banco bloqueado durante a rede.
    const fetched = sourceName === 'pci' ? await pciFetcher() : demoResult();
    if (!fetched.contests.length) throw new Error('Fonte vazia; histórico preservado.');
    const items = uniqueBySourceKey(fetched.contests);
    return await target.$transaction(async tx => {
      // Uma aplicação de lote por vez, inclusive com múltiplos processos do servidor.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(53002601)`;
      const previous = await tx.syncRun.findFirst({ where: { source: sourceName, status: 'success' }, orderBy: { completedAt: 'desc' } });
      const baseline = !previous;
      const now = new Date();
      const rows = await tx.concurso.findMany({ where: { sourceKey: { in: items.map(item => item.sourceKey) } }, omit: { raw: true } });
      const existing = new Map(rows.map(row => [row.sourceKey, row]));
      const dataFor = (item: typeof items[number]) => ({
        sourceUrl: item.sourceUrl ?? null, title: item.title, organization: item.organization ?? null, roles: item.roles,
        city: item.city ?? null, uf: item.uf ?? null, region: item.region ?? null, vacancies: item.vacancies ?? null,
        salary: item.salary ?? null, registrationStart: item.registrationStart ?? null, registrationEnd: item.registrationEnd ?? null,
        status: item.status ?? null, noticeUrl: item.noticeUrl ?? null, applicationUrl: item.applicationUrl ?? null,
        lastSeenAt: now, contentHash: item.contentHash, raw: item.raw as object, isDemo: sourceName === 'demo'
      });
      const added = items.filter(item => !existing.has(item.sourceKey));
      if (added.length) await tx.concurso.createMany({ data: added.map(item => ({ ...dataFor(item), sourceKey: item.sourceKey, firstSeenAt: now })) });
      const unchanged = items.filter(item => existing.get(item.sourceKey)?.contentHash === item.contentHash);
      if (unchanged.length) await tx.concurso.updateMany({ where: { sourceKey: { in: unchanged.map(item => item.sourceKey) } }, data: { lastSeenAt: now } });
      const pending: Array<{ concursoId: string; kind: string; summary: string; changes?: object }> = [];
      for (const item of items) {
        const old = existing.get(item.sourceKey);
        if (!old || old.contentHash === item.contentHash) continue;
        const changes = trackedContestFields.filter(key => value(old[key]) !== value(item[key])).map(key => ({ field: key, from: jsonValue(old[key]), to: jsonValue(item[key]) }));
        await tx.concurso.update({ where: { id: old.id }, data: dataFor(item) });
        if (changes.length) pending.push({ concursoId: old.id, kind: 'changed', summary: 'Prazo, vagas ou outro dado do concurso mudou', changes });
      }
      const ids = new Map(rows.map(row => [row.sourceKey, row.id]));
      if (added.length) {
        const created = await tx.concurso.findMany({ where: { sourceKey: { in: added.map(item => item.sourceKey) } }, select: { id: true, sourceKey: true } });
        for (const row of created) ids.set(row.sourceKey, row.id);
        if (!baseline) for (const item of added) pending.push({ concursoId: ids.get(item.sourceKey)!, kind: 'new', summary: 'Primeira vez que este concurso aparece no radar', changes: { detectedAt: now.toISOString() } });
      }
      if (!baseline) {
        const urgent = items.filter(item => registrationState({ ...item, isDemo: sourceName === 'demo' }, now) === 'open' && (daysTo(item.registrationEnd, now) ?? Infinity) <= 7);
        const recent = urgent.length ? await tx.radarEvent.findMany({ where: { kind: 'deadline', concursoId: { in: urgent.map(item => ids.get(item.sourceKey)!) }, createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, select: { concursoId: true } }) : [];
        const notified = new Set(recent.map(event => event.concursoId));
        for (const item of urgent) {
          const id = ids.get(item.sourceKey)!;
          const days = daysTo(item.registrationEnd, now)!;
          if (!notified.has(id)) pending.push({ concursoId: id, kind: 'deadline', summary: `Inscrições encerram em ${days} ${days === 1 ? 'dia' : 'dias'}` });
        }
      }
      if (pending.length) await tx.radarEvent.createMany({ data: pending });
      const expectedCount = fetched.expectedCount ?? null;
      await tx.syncRun.update({ where: { id: run.id }, data: { status: 'success', completedAt: new Date(), isBaseline: baseline, returnedCount: items.length, expectedCount } });
      return { ok: true, count: items.length, expectedCount, baseline, source: sourceName, notes: fetched.notes };
    }, { maxWait: 10_000, timeout: 120_000 });
  } catch (error) {
    const message = safeError(error);
    await target.syncRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: new Date(), errorMessage: message } });
    throw new Error(message);
  }
}
