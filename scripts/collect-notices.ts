import 'dotenv/config';
import { db } from '../src/lib/db';
import { fetchNotice } from '../src/lib/notice-collector';

async function main() {
  const rows = await db.concurso.findMany({ where: { isDemo: false, sourceUrl: { not: null } }, select: { id: true, sourceUrl: true, noticeUrl: true, raw: true } });
  const now = Date.now(); const started = now; let cursor = 0;
  let checked = 0; let found = 0; let failed = 0; let skipped = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < rows.length && Date.now() - started < 300_000) {
      const row = rows[cursor++];
      const raw = row.raw as Record<string, unknown>;
      const check = raw._radarNotice as { checkedAt?: string; sourceUrl?: string; failed?: boolean } | undefined;
      const ttl = check?.failed ? 3 * 3600_000 : 24 * 3600_000;
      if (check?.sourceUrl === row.sourceUrl && check.checkedAt && now - Date.parse(check.checkedAt) < ttl) { skipped++; continue; }
      let noticeUrl: string | null = null; let error = false;
      try { noticeUrl = await fetchNotice(row.sourceUrl!); checked++; if (noticeUrl) found++; }
      catch { failed++; error = true; }
      const metadata = JSON.stringify({ checkedAt: new Date().toISOString(), sourceUrl: row.sourceUrl, failed: error });
      // Não troca o texto original nem apaga um edital em falhas temporárias.
      await db.$executeRaw`UPDATE "Concurso" SET "noticeUrl" = COALESCE(${noticeUrl}, "noticeUrl"), raw = jsonb_set(raw, '{_radarNotice}', ${metadata}::jsonb), "updatedAt" = NOW() WHERE id = ${row.id} AND "sourceUrl" = ${row.sourceUrl}`;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }));
  const available = await db.concurso.count({ where: { isDemo: false, noticeUrl: { not: null } } });
  console.log(JSON.stringify({ checked, found, failed, skipped, available, remaining: rows.length - cursor }));
}
main().catch(() => { console.error('Coleta de editais falhou; links já encontrados foram preservados.'); process.exitCode = 1; }).finally(() => db.$disconnect());
