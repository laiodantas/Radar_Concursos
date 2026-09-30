"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownWideNarrow, ArrowUpRight, Bell, Bookmark, CalendarClock, Check, ChevronDown, CircleHelp, Clock3, FileText, Filter, Moon, Search, SlidersHorizontal, Sun, X } from "lucide-react";
import { daysRemaining } from "@/lib/date-utils";
import { applyTheme, THEME_KEY, effectiveTheme as effectiveThemeFn, toggleTheme as nextTheme, type Theme } from "@/lib/theme";
import { dateOnly, dateTime } from "@/lib/format";
type Contest = { id:string; title:string; organization:string|null; roles:string[]; city:string|null; uf:string|null; region:string|null; vacancies:string|null; salary:string|null; registrationStart:string|null; registrationEnd:string|null; status:string|null; sourceUrl:string|null; noticeUrl:string|null; applicationUrl:string|null; firstSeenAt:string; isDemo:boolean };
type Event = { id:string; kind:string; summary:string; createdAt:string; concurso:{title:string;organization:string|null;sourceUrl:string|null} };
type Data = { contests:Contest[]; events:Event[]; stats:{total:number;newSinceLast:number;closingSoon:number;lastSuccessAt:string|null;lastRun:{status:string;startedAt:string;errorMessage:string|null;returnedCount:number;expectedCount:number|null;truncated:boolean}|null;isDemo:boolean;source:string} };
type Filters = { q:string; uf:string; city:string; region:string; situation:string; deadline:string; sort:string };
const blank:Filters = { q:"",uf:"",city:"",region:"",situation:"",deadline:"",sort:"recent" };
const STORAGE_KEY = "radar-filtros-v1";

const brDate=(s:string|null)=>s ? new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeZone:"America/Sao_Paulo"}).format(new Date(s)) : null;
const daysTo=(s:string|null)=>s ? daysRemaining(s) : null;
const plural=(n:number,one:string,many:string)=>`${n} ${n===1?one:many}`;
function statusKind(value:string|null){const x=(value||"").toLocaleLowerCase("pt-BR");return /abert|inscri..es abertas/.test(x)?"open":/encerrad|fechad|finalizad/.test(x)?"closed":"unknown";}
const regionLabel=(region:string|null)=>!region?"Região não informada":/nacional/i.test(region)?"Abrangência nacional":region;
const rolesLabel=(roles:string[])=>!roles.length?"Não informado":roles.length>3?`${roles[0]}, ${roles[1]} e mais ${roles.length-2}`:roles.join(", ");
function deadlineNote(contest:Contest){
  const days=daysTo(contest.registrationEnd);
  const relative=days===null?"A fonte não informou o prazo":days<0?`Encerradas há ${plural(Math.abs(days),"dia","dias")}`:days===0?"Encerram hoje":days===1?"Encerram amanhã":`Faltam ${plural(days,"dia","dias")}`;
  return contest.registrationStart?`${relative} · abertas desde ${brDate(contest.registrationStart)}`:relative;
}
const EVENT_LABEL:Record<string,string>={new:"PRIMEIRA VEZ NO PAINEL",changed:"DADOS ATUALIZADOS",deadline:"PRAZO SE APROXIMANDO"};
function EventIcon({kind}:{kind:string}){return kind==="new"?<span className="event-dot"/>:kind==="changed"?<Activity size={15}/>:<CalendarClock size={15}/>;}

export default function Dashboard({data}:{data:Data}) {
 const [filters,setFilters]=useState<Filters>(blank); const [saved,setSaved]=useState(false); const [mobileFilters,setMobileFilters]=useState(false);
 // Armazena apenas a escolha explícita; null significa "seguir o sistema". O `<html>` já nasce com o tema
 // correto pelo script pré-pintura, então o painel só precisa saber o que exibir no botão.
 const [choice,setChoice]=useState<Theme|null>(null);
 useEffect(()=>{try{const value=localStorage.getItem(STORAGE_KEY);if(value){setFilters({...blank,...JSON.parse(value)});setSaved(true);}}catch{/* localStorage indisponível: filtros só deixam de persistir */}},[]);
 // O painel abre no tema claro; só a escolha gravada neste navegador muda isso.
 useEffect(()=>{try{const stored=localStorage.getItem(THEME_KEY);if(stored==="light"||stored==="dark")setChoice(stored);}catch{}},[]);
 // O botão reflete o tema efetivo: a escolha gravada ou, sem escolha, o claro.
 const effectiveTheme:Theme=effectiveThemeFn(choice);
 function toggleTheme(){const next:Theme=nextTheme(choice);setChoice(next);applyTheme(next,next);}
 function persistFilters(next:Filters){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{/* quota cheia ou modo privado: os filtros só deixam de persistir */}setSaved(true);}
 function update<K extends keyof Filters>(key:K,value:Filters[K]){const next={...filters,[key]:value};setFilters(next);persistFilters(next);}
 function clear(){setFilters(blank);try{localStorage.removeItem(STORAGE_KEY);}catch{}setSaved(false);}
 const ufs=useMemo(()=>[...new Set(data.contests.map(c=>c.uf).filter(Boolean))].sort() as string[],[data.contests]);
 const cities=useMemo(()=>[...new Set(data.contests.map(c=>c.city).filter(Boolean))].sort() as string[],[data.contests]);
 const regions=useMemo(()=>[...new Set(data.contests.map(c=>c.region).filter(Boolean))].sort() as string[],[data.contests]);
 const filtered=useMemo(()=>data.contests.filter(c=>{const q=filters.q.trim().toLocaleLowerCase("pt-BR");const hay=[c.title,c.organization,...c.roles,c.city,c.uf,c.region].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");const days=daysTo(c.registrationEnd);const st=statusKind(c.status);return(!q||hay.includes(q))&&(!filters.uf||c.uf===filters.uf)&&(!filters.city||!cities.length||c.city===filters.city)&&(!filters.region||c.region===filters.region)&&(!filters.situation||(filters.situation==="abertas"?st==="open":filters.situation==="encerradas"?st==="closed":st==="unknown"))&&(!filters.deadline||(filters.deadline==="7"?days!==null&&days>=0&&days<=7:filters.deadline==="30"?days!==null&&days>=0&&days<=30:days!==null&&days<0));}).sort((a,b)=>filters.sort==="deadline"?(a.registrationEnd?new Date(a.registrationEnd).getTime():Infinity)-(b.registrationEnd?new Date(b.registrationEnd).getTime():Infinity):new Date(b.firstSeenAt).getTime()-new Date(a.firstSeenAt).getTime()),[data.contests,cities,filters]);
 const activeFilters=Boolean(filters.q||filters.uf||filters.city||filters.region||filters.situation||filters.deadline);
 return <main className="app-shell">
  <aside className="rail">
   <a className="brand" href="#top" aria-label="Radar de Concursos, início"><span className="brand-mark"><Activity size={18}/></span><span>Radar<small>DE CONCURSOS</small></span></a>
   <div className="rail-label">Nesta edição</div>
   <nav className="rail-nav" aria-label="Seções do painel">
    <a className="rail-link active" href="#concursos"><span className="rail-icon"><Activity size={16}/></span>Concursos abertos</a>
    <a className="rail-link" href="#novidades"><span className="rail-icon"><Bell size={16}/></span>Novidades{data.events.length>0&&<span className="rail-count">{data.events.length}</span>}</a>
    <a className="rail-link" href="#como-ler"><span className="rail-icon"><CircleHelp size={16}/></span>Como ler</a>
   </nav>
   <div className="rail-bottom">
    <div className="source-mark"><span/>{data.stats.isDemo?"Registros de demonstração":`Fonte: ${data.stats.source}`}</div>
    <a className="pci-link" href="https://www.pciconcursos.com.br/mcp-e-gpt" target="_blank" rel="noreferrer">Sobre o PCI MCP <ArrowUpRight size={12}/></a>
    <div className="rail-version">Radar · beta 0.1</div>
   </div>
  </aside>
  <section className="main-column" id="top">
   <header className="topbar">
    <div className="breadcrumb">RADAR <span>/</span> CONCURSOS PÚBLICOS</div>
    <div className="top-actions">
     <span className="last-sync"><span className="sync-indicator"/> {data.stats.lastSuccessAt?`Atualizado em ${dateTime(new Date(data.stats.lastSuccessAt))}`:"Aguardando a primeira consulta"}</span>
     <button className="icon-button theme-toggle" aria-label={effectiveTheme==="dark"?"Usar tema claro":"Usar tema escuro"} title="Alternar entre tema claro e escuro" aria-pressed={effectiveTheme==="dark"} onClick={toggleTheme}>{effectiveTheme==="dark"?<Sun size={18}/>:<Moon size={18}/>}</button>
     <button className="icon-button" aria-label="Como este painel funciona" title="Os dados vêm da PCI Concursos; veja a seção Como ler" onClick={()=>{document.getElementById("como-ler")?.scrollIntoView({behavior:"smooth"});}}><CircleHelp size={18}/></button>
    </div>
   </header>
   <div className="content">
    {data.stats.isDemo&&<div className="demo-banner" role="status"><span className="demo-badge">MODO DEMONSTRAÇÃO</span><span>Estes registros são fictícios e servem apenas para mostrar o painel. Nenhum deles é um concurso real.</span></div>}
    {data.stats.lastRun?.status==="failed"&&<div className="error-banner" role="status"><span className="error-symbol">!</span><div><strong>Falha na última atualização</strong><span>{data.stats.lastRun.errorMessage||"Não foi possível consultar a fonte."} O painel continua mostrando os últimos dados que chegaram.{data.stats.lastSuccessAt&&` Última atualização bem-sucedida: ${dateTime(new Date(data.stats.lastSuccessAt))}.`}</span></div></div>}
    {data.stats.lastRun?.truncated&&<div className="warn-banner" role="status"><span className="warn-symbol">!</span><div><strong>Consulta possivelmente incompleta</strong><span>A fonte anunciou {data.stats.lastRun.expectedCount} concursos e a última consulta recebeu {data.stats.lastRun.returnedCount}. Pode existir paginação ou limite que o coletor ainda não cobre.</span></div></div>}

    <div className="page-heading">
     <div className="eyebrow"><span className="eyebrow-line"/>Oportunidades abertas</div>
     <h1>Concursos abertos,<br/><em>com o prazo à vista.</em></h1>
     <p className="heading-copy">Este painel reúne os concursos públicos que a PCI Concursos marcou com inscrições abertas. Você vê prazo, vagas, remuneração e o que mudou desde a última consulta — sempre com o link para a fonte oficial.</p>
     <div className="heading-actions">
      <a className="heading-cta" href="#concursos">Ver a lista completa <ArrowDownWideNarrow size={16}/></a>
      <a className="heading-cta secondary" href="#como-ler">Como ler os números <CircleHelp size={15}/></a>
     </div>
    </div>

    <div className="stats-grid" aria-label="Resumo do painel">
     <article className="stat-card"><div className="stat-top"><span>Concursos no painel</span><Activity size={15}/></div><div className="stat-number">{data.stats.total.toLocaleString("pt-BR")}</div><div className="stat-caption">com inscrições abertas segundo {data.stats.isDemo?"a demonstração":data.stats.source}</div></article>
     <article className="stat-card"><div className="stat-top"><span>Novos na última consulta</span><span className="stat-icon mint"><Bell size={14}/></span></div><div className="stat-number">{data.stats.newSinceLast}</div><div className="stat-caption">não estavam no painel na consulta anterior</div></article>
     <article className="stat-card"><div className="stat-top"><span>Encerram em 7 dias</span><span className="stat-icon amber"><CalendarClock size={14}/></span></div><div className="stat-number">{data.stats.closingSoon}</div><div className="stat-caption">inscrições que terminam nesta semana</div></article>
     <article className="stat-card"><div className="stat-top"><span>Última consulta</span><span className="stat-icon blue"><Clock3 size={14}/></span></div><div className="update-time">{data.stats.lastSuccessAt?dateTime(new Date(data.stats.lastSuccessAt)):"Ainda não realizada"}</div><div className="stat-caption">horário de Brasília (America/Sao_Paulo)</div></article>
    </div>

    <section id="concursos" className="list-section">
     <div className="section-head">
      <div>
       <div className="eyebrow"><span className="eyebrow-line"/>A lista</div>
       <h2>Concursos em destaque</h2>
       <p className="section-lead">Cada cartão traz o órgão, os cargos, as vagas e o prazo informados pela fonte. Ordenados por padrão do visto mais recentemente ao mais antigo.</p>
      </div>
      <div className="head-controls">
       <button className="save-filter" onClick={()=>persistFilters(filters)} title="Os filtros ficam guardados neste navegador, sem precisar de conta">{saved?<Check size={14}/>:<Bookmark size={14}/>}<span>{saved?"Filtros salvos":"Salvar filtros"}</span></button>
       <button className={`filter-toggle ${mobileFilters?"selected":""}`} aria-expanded={mobileFilters} onClick={()=>setMobileFilters(!mobileFilters)}><SlidersHorizontal size={15}/> Filtros <ChevronDown className="chevron" size={14}/></button>
      </div>
     </div>

     <div className="search-wrap">
      <Search size={17}/>
      <input aria-label="Buscar por cargo, órgão ou palavra-chave" placeholder="Busque por cargo, órgão ou palavra-chave" value={filters.q} onChange={e=>update("q",e.target.value)}/>
      {filters.q&&<button aria-label="Limpar busca" onClick={()=>update("q","")}><X size={15}/></button>}
     </div>

     <div className={`filters-row ${mobileFilters?"show-mobile":""}`}>
      <label><span className="filter-label">Estado (UF)</span><select value={filters.uf} onChange={e=>update("uf",e.target.value)}><option value="">Todos</option>{ufs.map(x=><option key={x}>{x}</option>)}</select></label>
      {cities.length>0&&<label><span className="filter-label">Cidade</span><select value={filters.city} onChange={e=>update("city",e.target.value)}><option value="">Todas</option>{cities.map(x=><option key={x}>{x}</option>)}</select></label>}
      <label><span className="filter-label">Região</span><select value={filters.region} onChange={e=>update("region",e.target.value)}><option value="">Todas</option>{regions.map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span className="filter-label">Situação informada pela PCI</span><select value={filters.situation} onChange={e=>update("situation",e.target.value)}><option value="">Qualquer situação</option><option value="abertas">Inscrições abertas</option><option value="encerradas">Inscrições encerradas</option><option value="sem-prazo">A fonte não informou</option></select></label>
      <label><span className="filter-label">Prazo de inscrição</span><select value={filters.deadline} onChange={e=>update("deadline",e.target.value)}><option value="">Qualquer prazo</option><option value="7">Encerram em até 7 dias</option><option value="30">Encerram em até 30 dias</option><option value="ended">Prazo já passou</option></select></label>
      <button className="clear-filters" onClick={clear}>Limpar filtros</button>
     </div>

     <div className="results-bar" role="status">
      <span><strong>{filtered.length}</strong> {filtered.length===1?"concurso":"concursos"}{activeFilters?" com os filtros aplicados":""} de <strong>{data.contests.length}</strong> no painel</span>
      <label>Ordenar por <select value={filters.sort} onChange={e=>update("sort",e.target.value)}><option value="recent">Vistos mais recentemente</option><option value="deadline">Prazo mais próximo</option></select></label>
     </div>

     <div className="contest-list">
      {filtered.length===0
       ? <div className="empty-state">
          <div className="empty-icon"><Filter size={21}/></div>
          <h3>{data.contests.length?"Nenhum concurso com esses filtros":"Ainda não há concursos aqui"}</h3>
          <p>{data.contests.length?"Tente remover um filtro, trocar o estado ou buscar outro termo.":"Quando a primeira consulta bem-sucedida acontecer, os concursos aparecem nesta lista."}</p>
          {data.contests.length>0&&<button onClick={clear}>Limpar todos os filtros</button>}
         </div>
       : filtered.map((c,i)=>{
          const days=daysTo(c.registrationEnd);
          const urgent=days!==null&&days>=0&&days<=7;
          const ended=days!==null&&days<0;
          return <article className="contest-card" key={c.id}>
           <div className="contest-folio" aria-hidden="true">{String(i+1).padStart(2,"0")}</div>
           <div className="contest-body">
            <div className="contest-kicker">
             {c.isDemo?<span className="demo-mini">EXEMPLO FICTÍCIO</span>:<span className="org-kicker">{c.organization||"Órgão não informado"}</span>}
             <span className="dot-sep">•</span><span>{regionLabel(c.region)}</span>
            </div>
            <h3>{c.title}</h3>
            <div className="contest-meta">
             <span className="meta-item"><span className="meta-label">Local</span>{[c.city,c.uf].filter(Boolean).join(" / ")||"Não informado pela fonte"}</span>
             <span className="meta-item"><span className="meta-label">Cargos</span>{rolesLabel(c.roles)}</span>
             <span className="meta-item"><span className="meta-label">Vagas</span>{c.vacancies||"Não informado pela fonte"}</span>
            </div>
            <div className="contest-bottom">
             <div className="contest-pills">
              <span className={`status-pill ${statusKind(c.status)}`}><span/>{c.status||"Situação não informada pela fonte"}</span>
              <span className="salary-pill">{c.salary?`Remuneração: ${c.salary}`:"Remuneração não informada"}</span>
             </div>
             <div className={`deadline ${urgent?"urgent":""} ${ended?"ended":""}`}>
              {days===null
               ? <><span className="deadline-label">Inscrições</span><strong>Sem prazo na fonte</strong></>
               : <><span className="deadline-label">Inscrições até</span><strong>{brDate(c.registrationEnd)}</strong><span className="deadline-note">{deadlineNote(c)}</span></>}
             </div>
            </div>
           </div>
           <div className="contest-actions">
            {c.sourceUrl?<a className="source-button" href={c.sourceUrl} target="_blank" rel="noreferrer">Ver na PCI Concursos <ArrowUpRight size={14}/></a>:<span className="source-button">Sem link da fonte</span>}
            {(c.noticeUrl||c.applicationUrl)&&<a className="notice-link" href={c.applicationUrl||c.noticeUrl||""} target="_blank" rel="noreferrer"><FileText size={13}/> Edital e inscrição</a>}
            <span className="detected">No painel desde <b>{brDate(c.firstSeenAt)}</b></span>
           </div>
          </article>;
         })}
     </div>

     <div className="coverage-note"><CircleHelp size={15}/><span><strong>A PCI avisa que o acervo dela pode não cobrir todos os editais.</strong> Antes de se inscrever, confirme prazos e exigências na <a href="https://www.pciconcursos.com.br/" target="_blank" rel="noreferrer">página oficial da PCI Concursos <ArrowUpRight size={11}/></a>.</span></div>
    </section>

    <section id="novidades" className="news-section">
     <div className="section-head">
      <div>
       <div className="eyebrow"><span className="eyebrow-line"/>O que mudou</div>
       <h2>Novidades desde a última consulta</h2>
       <p className="section-lead">A cada consulta o radar compara o que já estava aqui com o que a fonte devolveu. Concurso que sai da lista continua no painel: nada é apagado nem encerrado automaticamente.</p>
      </div>
     </div>
     <div className="news-list">
      {data.events.length===0
       ? <div className="news-empty"><Bell size={18}/><span>Nada mudou desde a última consulta. As novidades aparecem aqui depois de cada atualização bem-sucedida.</span></div>
       : data.events.slice(0,7).map(e=><article className="news-item" key={e.id}>
          <div className={`news-event-icon ${e.kind}`}><EventIcon kind={e.kind}/></div>
          <div className="news-content">
           <span className="news-type">{EVENT_LABEL[e.kind]??"ATUALIZAÇÃO"}</span>
           <h3>{e.concurso.title}</h3>
           <p>{e.summary}</p>
          </div>
          <time className="news-date" dateTime={new Date(e.createdAt).toISOString()}>{dateOnly(new Date(e.createdAt))}</time>
         </article>)}
     </div>
    </section>

    <section id="como-ler" className="explainer-section">
     <div className="section-head">
      <div>
       <div className="eyebrow"><span className="eyebrow-line"/>Como ler</div>
       <h2>De onde vêm esses números</h2>
       <p className="section-lead">Quatro coisas que evitam mal-entendido na hora de ler um cartão.</p>
      </div>
     </div>
     <div className="explainer-grid">
      <article className="explainer-item"><h3><span aria-hidden="true">01</span>O que entra na lista</h3><p>Concursos que a PCI Concursos marcou com <strong>inscrições abertas</strong> no momento da consulta. O radar não cria nem edita registro: ele mostra o que a fonte entrega, com o texto original guardado.</p></article>
      <article className="explainer-item"><h3><span aria-hidden="true">02</span>Prazos e situação</h3><p>As datas vêm da fonte e são interpretadas ao meio-dia de Brasília. A contagem de dias dos cartões usa o mesmo fuso, então &quot;faltam 3 dias&quot; é sempre em <code>America/Sao_Paulo</code>.</p></article>
      <article className="explainer-item"><h3><span aria-hidden="true">03</span>Vagas e remuneração</h3><p>A PCI manda os dois em um único texto — por exemplo &quot;15 vagas até R$ 7.181,50&quot;. O radar separa o número de vagas do valor quando consegue e mostra o resto exatamente como veio.</p></article>
      <article className="explainer-item"><h3><span aria-hidden="true">04</span>Até onde vai a cobertura</h3><p>O MCP da PCI é beta público e a própria fonte avisa que o acervo pode ser incompleto. O painel serve para achar oportunidades e prazos, não para substituir o edital oficial.</p></article>
     </div>
    </section>

    <footer className="footer">
     <span><strong>RADAR DE CONCURSOS</strong> — painel de acompanhamento de concursos públicos. Confirme sempre o edital antes de se inscrever.</span>
     <a href="https://www.pciconcursos.com.br/mcp-e-gpt" target="_blank" rel="noreferrer">Dados via PCI Concursos <ArrowUpRight size={12}/></a>
    </footer>
   </div>
  </section>
 </main>;
}
