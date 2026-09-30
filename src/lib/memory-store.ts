/* eslint-disable @typescript-eslint/no-explicit-any */
import type { db } from './db';
type AnyRow = Record<string, any>;
/** Emula as operações e o rollback utilizados pelo coletor, sem banco externo. */
export function memoryStore() {
  const runs: AnyRow[] = [], contests: AnyRow[] = [], events: AnyRow[] = [];
  let sequence = 0;
  const store = {
    syncRun: {
      create: async ({ data }: AnyRow) => { const row = { id: `run-${++sequence}`, startedAt: new Date(), ...data }; runs.push(row); return row; },
      update: async ({ where, data }: AnyRow) => { const row = runs.find(x => x.id === where.id)!; Object.assign(row, data); return row; },
      findFirst: async ({ where }: AnyRow) => runs.filter(x => x.source === where.source && x.status === where.status).at(-1) ?? null
    },
    concurso: {
      findUnique: async ({ where }: AnyRow) => { const row = contests.find(x => x.sourceKey === where.sourceKey); return row ? { ...row } : null; },
      findMany: async ({ where }: AnyRow) => contests.filter(x => where.sourceKey.in.includes(x.sourceKey)).map(x => ({ ...x })),
      create: async ({ data }: AnyRow) => { const row = { id: `contest-${++sequence}`, createdAt: new Date(), updatedAt: new Date(), ...data }; contests.push(row); return row; },
      createMany: async ({ data }: AnyRow) => { for (const row of data) await store.concurso.create({ data: row }); return { count: data.length }; },
      update: async ({ where, data }: AnyRow) => { const row = contests.find(x => x.id === where.id)!; Object.assign(row, data, { updatedAt: new Date() }); return row; },
      updateMany: async ({ where, data }: AnyRow) => { const rows = contests.filter(x => where.sourceKey.in.includes(x.sourceKey)); for (const row of rows) Object.assign(row, data); return { count: rows.length }; }
    },
    radarEvent: {
      findMany: async ({ where }: AnyRow) => events.filter(x => where.concursoId.in.includes(x.concursoId) && x.kind === where.kind && x.createdAt >= where.createdAt.gte),
      createMany: async ({ data }: AnyRow) => { for (const row of data) events.push({ id: `event-${++sequence}`, createdAt: new Date(), ...row }); return { count: data.length }; }
    },
    $executeRaw: async () => 0,
    $transaction: async (action: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone({ runs, contests, events, sequence });
      try { return await action(store); } catch (error) {
        runs.splice(0, runs.length, ...snapshot.runs); contests.splice(0, contests.length, ...snapshot.contests); events.splice(0, events.length, ...snapshot.events); sequence = snapshot.sequence;
        throw error;
      }
    },
    rows: () => contests, runs: () => runs, events: () => events
  };
  return store as unknown as typeof db & { rows: () => AnyRow[]; runs: () => AnyRow[]; events: () => AnyRow[] };
}
