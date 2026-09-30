"use client";
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Bell, CircleHelp, Filter, Moon, Sun } from 'lucide-react';
import { applyTheme, THEME_KEY, effectiveTheme as effectiveThemeFn, toggleTheme as nextTheme, type Theme } from '@/lib/theme';
import { dateTime } from '@/lib/format';
import type { DashboardData } from '@/lib/dashboard-types';
import { filterContests, PAGE_SIZE } from '@/lib/contest-filters';
import { ContestCard } from './contest-card';
import { ContestFilters } from './contest-filters';
import { ContestPagination } from './contest-pagination';
import { DashboardStats } from './dashboard-stats';
import { DashboardInformation } from './dashboard-information';
import { useContestFilters } from './use-contest-filters';

export default function Dashboard({ data, staticPreview = false }: { data: DashboardData; staticPreview?: boolean }) {
  const { filters, page, setPage, update, clear, storage } = useContestFilters();
  const [choice, setChoice] = useState<Theme | null>(null);
  const [activeSection, setActiveSection] = useState('concursos');
  const [now, setNow] = useState(() => new Date(data.asOf ?? Date.now()));
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { try { const stored = localStorage.getItem(THEME_KEY); if (stored === 'light' || stored === 'dark') setChoice(stored); } catch {} }, []);
  useEffect(() => {
    const ids = ['concursos', 'novidades', 'como-ler'];
    let frame = 0;
    function track() { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { let current = 'concursos'; for (const id of ids) if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 190) current = id; if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) current = 'como-ler'; setActiveSection(current); }); }
    window.addEventListener('scroll', track, { passive: true }); track();
    return () => { window.removeEventListener('scroll', track); cancelAnimationFrame(frame); };
  }, []);
  const theme = effectiveThemeFn(choice);
  function toggleTheme() { const next = nextTheme(choice); setChoice(next); applyTheme(next, next); }
  const filtered = useMemo(() => filterContests(data.contests, filters, now), [data.contests, filters, now]);
  const currentPage = Math.max(1, Math.min(page, Math.ceil(filtered.length / PAGE_SIZE) || 1));
  const size = staticPreview ? filtered.length || 1 : PAGE_SIZE;
  const start = staticPreview ? 0 : (currentPage - 1) * size;
  const navItems = [{ id: 'concursos', label: 'Concursos', icon: <Activity size={16}/> }, { id: 'novidades', label: 'Novidades', icon: <Bell size={16}/> }, { id: 'como-ler', label: 'Como ler', icon: <CircleHelp size={16}/> }];
  return <main className="app-shell">
    <a className="skip-link" href="#search-panel">Ir para a busca</a>
    <aside className="rail">
      <a className="brand" href="#top" aria-label="Radar de Concursos, início"><span className="brand-mark"><Activity size={18}/></span><span>Radar<small>DE CONCURSOS</small></span></a>
      <div className="rail-label">Explore o painel</div>
      <nav className="rail-nav" aria-label="Seções do painel">{navItems.map(item => <a key={item.id} className={`rail-link ${activeSection === item.id ? 'active' : ''}`} aria-current={activeSection === item.id ? 'location' : undefined} href={`#${item.id}`} onClick={() => setActiveSection(item.id)}><span className="rail-icon">{item.icon}</span>{item.label}</a>)}</nav>
      <div className="rail-bottom"><div className="source-mark"><span/>{data.stats.isDemo ? 'Registros de demonstração' : `Fonte: ${data.stats.source}`}</div><a className="pci-link" href="https://www.pciconcursos.com.br/mcp-e-gpt" target="_blank" rel="noreferrer">Sobre a fonte <ArrowUpRight size={14}/></a><div className="rail-version">Radar · beta</div></div>
    </aside>
    <section className="main-column" id="top">
      <header className="topbar"><div className="breadcrumb">Radar <span>/</span> Concursos públicos</div><div className="top-actions"><span className="last-sync">{data.stats.lastSuccessAt ? `Atualizado em ${dateTime(new Date(data.stats.lastSuccessAt))}` : 'Aguardando a primeira consulta'}</span><button className="icon-button theme-toggle" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} aria-pressed={theme === 'dark'} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>
      <div className="content">
        {data.stats.isDemo && <div className="demo-banner" role="status"><span className="demo-badge">Demonstração</span><span>Registros fictícios para mostrar o painel. Não representam concursos reais.</span></div>}
        {data.stats.lastRun?.status === 'failed' && <div className="error-banner" role="status"><strong>Falha na última atualização.</strong><span>Exibimos os últimos dados recebidos. Confira as informações na fonte antes de se inscrever.</span></div>}
        {data.stats.lastRun?.truncated && <div className="warn-banner" role="status"><strong>Consulta possivelmente incompleta</strong><span>A fonte anunciou {data.stats.lastRun.expectedCount} concursos; a consulta recebeu {data.stats.lastRun.returnedCount}.</span></div>}
        <div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/>Seu próximo passo</div><h1>Encontre seu concurso.<br/><em>Acompanhe os prazos.</em></h1><p className="heading-copy">Busque por cargo ou órgão, escolha seu estado e compare as oportunidades.</p></div>
        <section id="concursos" className="list-section">
          {!staticPreview && <div id="search-panel" tabIndex={-1}><ContestFilters contests={data.contests} filters={filters} update={update} clear={clear} storage={storage}/></div>}
          <DashboardStats data={data} now={now}/>
          <div className="section-head results-heading"><div><h2 id="results-heading" tabIndex={-1}>Lista de concursos</h2><p className="section-lead">Datas, vagas e remuneração informadas pela PCI. <a href="#como-ler">Entenda a cobertura e os números.</a></p></div></div>
          <div className="results-bar"><span role="status"><strong>{filtered.length}</strong> {filtered.length === 1 ? 'concurso' : 'concursos'}{filtered.length > 0 && ` · mostrando ${start + 1}–${Math.min(start + size, filtered.length)}`}</span><label>Ordenar por<select disabled={staticPreview} value={filters.sort} onChange={e => update('sort', e.target.value)}><option value="recent">Adicionados recentemente</option><option value="deadline">Prazo mais próximo</option></select></label></div>
          <div className="contest-list">{filtered.length === 0 ? <div className="empty-state"><Filter size={24}/><h3>{data.contests.length ? 'Nenhum concurso com esses filtros' : 'Ainda não há concursos aqui'}</h3><p>{data.contests.length ? 'Remova um filtro ou busque outro termo.' : 'Os concursos aparecerão após a primeira consulta bem-sucedida.'}</p>{data.contests.length > 0 && <button onClick={clear}>Limpar todos os filtros</button>}</div> : filtered.slice(start, start + size).map((contest, i) => <ContestCard key={contest.id} contest={contest} index={start + i} now={now}/>)}</div>
          {!staticPreview && <ContestPagination page={currentPage} total={filtered.length} setPage={setPage}/>}
          <div className="coverage-note"><CircleHelp size={18}/><span>A cobertura pode ser incompleta. Confirme prazos, valores e requisitos no edital e na <a href="https://www.pciconcursos.com.br/" target="_blank" rel="noreferrer">PCI Concursos <ArrowUpRight size={14}/></a>.</span></div>
        </section>
        <DashboardInformation data={data}/>
      </div>
    </section>
  </main>;
}
