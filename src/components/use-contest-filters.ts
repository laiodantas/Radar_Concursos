import { useEffect, useState } from 'react';
import { blankFilters, readFilters, type Filters } from '@/lib/contest-filters';
const STORAGE_KEY = 'radar-filtros-v1';
export function useContestFilters() {
  const [filters, setFilters] = useState<Filters>({ ...blankFilters });
  const [page, setPage] = useState(1);
  const [storage, setStorage] = useState<'pending' | 'saved' | 'unavailable'>('pending');
  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setFilters(readFilters(JSON.parse(saved))); setStorage('saved'); } catch { setStorage('unavailable'); } }, []);
  function update(key: keyof Filters, value: string) {
    const next = { ...filters, [key]: value };
    if (key === 'uf') { next.city = ''; next.region = ''; }
    if (key === 'region') { next.uf = ''; next.city = ''; }
    setFilters(next); setPage(1);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorage('saved'); } catch { setStorage('unavailable'); }
  }
  function clear() {
    setFilters({ ...blankFilters }); setPage(1);
    try { localStorage.removeItem(STORAGE_KEY); setStorage('saved'); } catch { setStorage('unavailable'); }
  }
  return { filters, page, setPage, update, clear, storage };
}
