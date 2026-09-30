import { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Contest } from '@/lib/dashboard-types';
import type { Filters } from '@/lib/contest-filters';

const situations: Record<string, string> = { abertas: 'Inscrições abertas', encerradas: 'Encerrados ou vencidos', futuras: 'Inscrições futuras', 'sem-prazo': 'Situação a confirmar' };
const deadlines: Record<string, string> = { '7': 'Encerram em até 7 dias', '30': 'Encerram em até 30 dias', ended: 'Prazo vencido' };
const educationLabels: Record<string, string> = { fundamental: 'Fundamental', medio: 'Médio', tecnico: 'Técnico', superior: 'Superior', unknown: 'Não informada' };
export function ContestFilters({ contests, filters, update, clear, storage }: { contests: Contest[]; filters: Filters; update: (key: keyof Filters, value: string) => void; clear: () => void; storage: string }) {
  const [expanded, setExpanded] = useState(false);
  const options = (field: 'uf' | 'city' | 'region', source = contests) => [...new Set(source.map(c => c[field]).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const active = (Object.keys(filters) as Array<keyof Filters>).filter(key => key !== 'sort' && filters[key]);
  const chips: Record<string, string> = { q: `Busca: ${filters.q}`, uf: `Estado: ${filters.uf}`, city: `Cidade: ${filters.city}`, region: `Região: ${filters.region}`, education: `Escolaridade: ${educationLabels[filters.education ?? '']}`, situation: situations[filters.situation], deadline: deadlines[filters.deadline] };
  return <div className="filter-panel">
    <div className="quick-search">
      <div className="search-wrap"><Search size={18}/><input aria-label="Buscar por cargo, órgão ou palavra-chave" placeholder="Cargo, órgão ou palavra-chave" value={filters.q} onChange={e => update('q', e.target.value)}/>{filters.q && <button aria-label="Limpar busca" onClick={() => update('q', '')}><X size={16}/></button>}</div>
      <label className="quick-state"><span className="filter-label">Estado (UF)</span><select value={filters.uf} onChange={e => update('uf', e.target.value)}><option value="">Todos os estados</option>{options('uf').map(v => <option key={v}>{v}</option>)}</select></label>
      <button className="filter-toggle" aria-controls="advanced-filters" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16}/>Mais filtros<ChevronDown size={14}/></button>
    </div>
    <div id="advanced-filters" className={`filters-row ${expanded ? 'show-mobile' : ''}`}>
      <label><span className="filter-label">Escolaridade</span><select value={filters.education ?? ''} onChange={e => update('education', e.target.value)}><option value="">Todas</option>{Object.entries(educationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {options('city').length > 0 && <label><span className="filter-label">Cidade</span><select value={filters.city} onChange={e => update('city', e.target.value)}><option value="">Todas</option>{options('city', contests.filter(c => !filters.uf || c.uf === filters.uf)).map(v => <option key={v}>{v}</option>)}</select></label>}
      <label><span className="filter-label">Região</span><select value={filters.region} onChange={e => update('region', e.target.value)}><option value="">Todas</option>{options('region').map(v => <option key={v}>{v}</option>)}</select></label>
      <label><span className="filter-label">Situação atual</span><select value={filters.situation} onChange={e => update('situation', e.target.value)}><option value="">Todas</option>{Object.entries(situations).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span className="filter-label">Prazo de inscrição</span><select value={filters.deadline} onChange={e => update('deadline', e.target.value)}><option value="">Qualquer prazo</option>{Object.entries(deadlines).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <div className="filter-feedback"><span>{storage === 'unavailable' ? 'Filtros disponíveis nesta visita; não foi possível salvá-los.' : storage === 'pending' ? 'Carregando suas preferências…' : 'Filtros salvos automaticamente neste navegador.'}</span>{active.length > 0 && <button className="clear-filters" onClick={clear}>Limpar filtros</button>}</div>
    {active.length > 0 && <div className="filter-chips" aria-label="Filtros aplicados">{active.map(key => <button key={key} onClick={() => update(key, '')} aria-label={`Remover ${chips[key]}`}><span>{chips[key]}</span><X size={14}/></button>)}</div>}
  </div>;
}
