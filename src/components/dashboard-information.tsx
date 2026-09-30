import { Activity, ArrowUpRight, Bell, CalendarClock } from 'lucide-react';
import { dateOnly } from '@/lib/format';
import type { DashboardData } from '@/lib/dashboard-types';
const EVENT_LABEL: Record<string, string> = { new: 'Primeira vez no painel', changed: 'Dados atualizados', deadline: 'Prazo se aproximando' };
function EventIcon({kind}: {kind: string}) { return kind === 'new' ? <span className="event-dot"/> : kind === 'changed' ? <Activity size={15}/> : <CalendarClock size={15}/>; }
export function DashboardInformation({data}: {data: DashboardData}) { return <>
    <section id="novidades" className="news-section">
     <div className="section-head">
      <div>
       <div className="eyebrow"><span className="eyebrow-line"/>O que mudou</div>
       <h2>Novidades desde a última consulta</h2>
       <p className="section-lead">Veja os registros de alterações identificadas nas consultas. O histórico é preservado, mesmo quando um concurso deixa de aparecer na fonte.</p>
      </div>
     </div>
     <div className="news-list">
      {data.events.length===0
       ? <div className="news-empty"><Bell size={18}/><span>Nada mudou desde a última consulta. As novidades aparecem aqui depois de cada atualização bem-sucedida.</span></div>
       : data.events.map(e=><article className="news-item" key={e.id}>
          <div className={`news-event-icon ${e.kind}`}><EventIcon kind={e.kind}/></div>
          <div className="news-content">
           <span className="news-type">{EVENT_LABEL[e.kind]??"ATUALIZAÇÃO"}</span>
           <h3>{e.concurso.sourceUrl?<a href={e.concurso.sourceUrl} target="_blank" rel="noreferrer">{e.concurso.title}</a>:e.concurso.title}</h3>
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
      <article className="explainer-item"><h3><span aria-hidden="true">01</span>O que entra na lista</h3><p>Registros recebidos da PCI Concursos e seu histórico. A lista pode incluir inscrições futuras e prazos vencidos. O radar não cria nem edita registro: ele mostra o que a fonte entrega, com o texto original guardado.</p></article>
      <article className="explainer-item"><h3><span aria-hidden="true">02</span>Prazos e situação</h3><p>As datas vêm da fonte e são interpretadas ao meio-dia de Brasília. A situação atual cruza datas e status da fonte: início futuro, prazo vigente ou vencido. A contagem usa <code>America/Sao_Paulo</code>; confirme sempre a situação no edital.</p></article>
      <article className="explainer-item"><h3><span aria-hidden="true">03</span>Vagas e remuneração</h3><p>A PCI manda os dois em um único texto — por exemplo &quot;15 vagas até R$ 7.181,50&quot;. O radar preserva qualificadores como “até”. O valor pode variar por cargo; confirme a remuneração no edital.</p></article>
      <article className="explainer-item"><h3><span aria-hidden="true">04</span>Até onde vai a cobertura</h3><p>O MCP da PCI é beta público e a própria fonte avisa que o acervo pode ser incompleto. O painel serve para achar oportunidades e prazos, não para substituir o edital oficial.</p></article>
     </div>
    </section>

    <footer className="footer">
     <span><strong>RADAR DE CONCURSOS</strong> — painel de acompanhamento de concursos públicos. Confirme sempre o edital antes de se inscrever.</span>
     <a href="https://www.pciconcursos.com.br/mcp-e-gpt" target="_blank" rel="noreferrer">Dados via PCI Concursos <ArrowUpRight size={12}/></a>
    </footer>

</>; }
