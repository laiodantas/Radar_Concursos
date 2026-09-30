import { PAGE_SIZE } from '@/lib/contest-filters';
export function ContestPagination({ page, total, setPage }: { page: number; total: number; setPage: (page: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  function go(next: number) { setPage(next); document.getElementById('results-heading')?.focus(); }
  return <nav className="pagination" aria-label="Páginas de concursos">
    <button disabled={page === 1} onClick={() => go(page - 1)}>Anterior</button>
    <span aria-live="polite">Página {page} de {pages}</span>
    <button disabled={page === pages} onClick={() => go(page + 1)}>Próxima</button>
  </nav>;
}
