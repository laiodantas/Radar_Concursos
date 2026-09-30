const PCI_ORIGIN = 'https://www.pciconcursos.com.br';
function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.replace(/&amp;/g, '&');
}
export function findNotice(html: string, sourceUrl: string): string | null {
  const source = new URL(sourceUrl);
  if (source.origin !== PCI_ORIGIN || !source.pathname.startsWith('/noticias/')) return null;
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const tag = match[1];
    const label = (attribute(tag, 'title') || match[2].replace(/<[^>]*>/g, '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!/\bedital\b/.test(label) || /retifica|resultado|gabarito|convoca/.test(label)) continue;
    if (attribute(tag, 'class')?.split(/\s+/).includes('edital-pdf-link')) {
      // A PCI libera o PDF após CAPTCHA; o usuário acessa a seção legítima.
      if (/id=["']captcha-editais["']/.test(html)) return `${source.origin}${source.pathname}#captcha-editais`;
    }
    const href = attribute(tag, 'href');
    if (!href) continue;
    try {
      const url = new URL(href, source);
      if (url.protocol === 'https:' && /\.pdf$/i.test(url.pathname) && !url.username && !url.password) return url.href;
    } catch {}
  }
  return null;
}
export async function fetchNotice(sourceUrl: string): Promise<string | null> {
  const source = new URL(sourceUrl);
  if (source.origin !== PCI_ORIGIN || !source.pathname.startsWith('/noticias/')) return null;
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000), redirect: 'error', headers: { 'User-Agent': 'RadarConcursos/1.0 (consulta de editais publicos)' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error(`Página indisponível: HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Página vazia');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) throw new Error('Página excede limite'); chunks.push(value); }
  } finally { await reader.cancel(); }
  return findNotice(Buffer.concat(chunks).toString('utf8'), sourceUrl);
}
