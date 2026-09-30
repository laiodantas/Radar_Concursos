import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Contest } from '@/lib/dashboard-types';
import { ContestCard } from './contest-card';

export function SourceSearch({ now }: { now: Date }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('termo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ contests: Contest[]; term: string } | null>(null);
  const [limit, setLimit] = useState(10);
  const activeRequest = useRef(0);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const id = ++activeRequest.current;
    setBusy(true); setError(''); setResult(null); setLimit(10);
    const term = query.trim();
    try {
      const response = await fetch(`/api/search?${new URLSearchParams({ q: term, mode })}`, { signal: AbortSignal.timeout(60_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'A consulta não foi concluída.');
      if (id === activeRequest.current) setResult({ contests: data.contests, term });
    } catch (e) { if (id === activeRequest.current) setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'A consulta demorou demais. Tente novamente.'); }
    finally { if (id === activeRequest.current) setBusy(false); }
  }
  return <details className="source-search">
    <summary><Search size={16}/>Buscar diretamente na PCI</summary>
    <div className="source-search-content">
      <p>Complemente a lista do Radar pesquisando na fonte. Os filtros acima se aplicam à lista do painel; esta consulta pesquisa em todo o Brasil.</p>
      <form onSubmit={submit} className="source-search-form">
        <label><span className="filter-label">Termo na PCI</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: enfermeiro, INSS ou prefeitura" required minLength={3} maxLength={100}/></label>
        <label><span className="filter-label">Tipo de busca</span><select value={mode} onChange={e => setMode(e.target.value)}><option value="termo">Cargo, órgão ou palavra-chave</option><option value="cargo">Cargo específico</option></select></label>
        <button className="source-button" disabled={busy || query.trim().length < 3} type="submit">{busy ? 'Consultando a PCI…' : 'Consultar PCI'}</button>
      </form>
      <div role="status" aria-live="polite">{busy && <p>Buscando concursos na fonte…</p>}{error && <p className="source-search-error">{error}</p>}{result && <p><strong>{result.contests.length}</strong> {result.contests.length === 1 ? 'resultado' : 'resultados'} na PCI para “{result.term}”.{!result.contests.length && ' Tente outro cargo ou órgão.'}</p>}</div>
      {result && <div className="contest-list">{result.contests.slice(0, limit).map((contest, index) => <ContestCard key={contest.id} contest={contest} index={index} now={now}/>)}</div>}
      {result && result.contests.length > limit && <button className="source-more" onClick={() => setLimit(limit + 10)}>Mostrar mais resultados ({Math.min(limit, result.contests.length)} de {result.contests.length})</button>}
      {result && <button className="clear-filters" onClick={() => { setResult(null); setError(''); }}>Fechar resultados da consulta</button>}
    </div>
  </details>;
}
