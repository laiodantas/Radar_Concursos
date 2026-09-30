import { NextRequest, NextResponse } from 'next/server';
import { callTool, negotiateSession } from '@/lib/pci';
import { extractMcpRecords, normalizeRecord } from '@/lib/normalize';
import { educationText, newsImage } from '@/lib/contest-enrichment';
import { db } from '@/lib/db';
import type { Contest } from '@/lib/dashboard-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const cache = new Map<string, { at: number; contests: Contest[] }>();
const pending = new Map<string, Promise<Contest[]>>();
let windowStart = Date.now(); let requests = 0;
async function search(query: string, mode: string) {
  const session = await negotiateSession();
  const result = await callTool(session.session, session.version, mode === 'cargo' ? 'buscar_por_cargo' : 'pesquisar_concursos', mode === 'cargo' ? { cargo: query } : { termo: query });
  const records = extractMcpRecords(result);
  const normalized = records.map(normalizeRecord);
  // Reaproveita os editais já coletados, sem gravar buscas de visitantes no banco.
  const known = await db.concurso.findMany({ where: { isDemo: false, sourceKey: { in: normalized.map(c => c.sourceKey) } }, select: { sourceKey: true, noticeUrl: true, firstSeenAt: true } });
  const existing = new Map(known.map(c => [c.sourceKey, c]));
  const now = new Date().toISOString();
  return normalized.map(c => {
    const raw = c.raw as Record<string, unknown>;
    const noticia = raw.noticia as { imagem?: unknown } | undefined;
    const old = existing.get(c.sourceKey);
    return { sourceResult: !old, id: c.sourceKey, title: c.title, organization: c.organization ?? null, roles: c.roles, city: c.city ?? null, uf: c.uf ?? null, region: c.region ?? null, vacancies: c.vacancies ?? null, salary: c.salary ?? null, education: educationText(raw.formacao), newsImageUrl: newsImage(noticia?.imagem), registrationStart: c.registrationStart?.toISOString() ?? null, registrationEnd: c.registrationEnd?.toISOString() ?? null, status: c.status ?? null, sourceUrl: c.sourceUrl ?? null, noticeUrl: c.noticeUrl ?? old?.noticeUrl ?? null, applicationUrl: c.applicationUrl ?? null, firstSeenAt: old?.firstSeenAt.toISOString() ?? now, isDemo: false } satisfies Contest;
  });
}
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim().replace(/\s+/g, ' ') ?? '';
  const mode = request.nextUrl.searchParams.get('mode') ?? 'termo';
  if (query.length < 3 || query.length > 100 || /[\u0000-\u001f]/.test(query) || !['termo', 'cargo'].includes(mode)) return NextResponse.json({ error: 'Informe de 3 a 100 caracteres para pesquisar.' }, { status: 400 });
  const key = `${mode}:${query.toLocaleLowerCase('pt-BR')}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < 600_000) return NextResponse.json({ contests: saved.contests, queriedAt: new Date(saved.at).toISOString() });
  if (!pending.has(key)) {
    if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); requests = 0; }
    if (pending.size >= 3 || requests >= 30) return NextResponse.json({ error: 'Há muitas consultas à fonte. Tente novamente em um minuto.' }, { status: 429, headers: { 'Retry-After': '60' } });
    requests++;
    pending.set(key, search(query, mode));
  }
  try {
    const contests = await pending.get(key)!;
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    const at = Date.now(); cache.set(key, { at, contests });
    return NextResponse.json({ contests, queriedAt: new Date(at).toISOString() });
  } catch { return NextResponse.json({ error: 'Não foi possível consultar a PCI agora. Tente novamente em instantes.' }, { status: 503 }); }
  finally { pending.delete(key); }
}

