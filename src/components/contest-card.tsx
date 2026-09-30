import { ArrowUpRight, FileText } from 'lucide-react';
import type { Contest } from '@/lib/dashboard-types';
import { brDate, daysTo, deadlineNote, registrationState, stateLabels } from '@/lib/contest-state';

export function ContestCard({ contest: c, index, now }: { contest: Contest; index: number; now: Date }) {
  const state = registrationState(c, now);
  const urgent = state === 'open' && (daysTo(c.registrationEnd, now) ?? Infinity) <= 7;
  const roles = c.roles.length > 3 ? `${c.roles[0]}, ${c.roles[1]} e mais ${c.roles.length - 2}` : c.roles.join(', ');
  return <article className="contest-card">
    <span className="contest-folio" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <div className="contest-body">
      <div className="contest-kicker">{c.isDemo ? <span className="demo-mini">Exemplo fictício</span> : <span className="org-kicker">{c.organization || 'Órgão não informado'}</span>}</div>
      <h3>{c.title}</h3>
      <dl className="contest-facts">
        <div><dt>Local</dt><dd>{[c.city, c.uf].filter(Boolean).join(' / ') || 'Não informado'}</dd></div>
        <div><dt>Vagas</dt><dd>{c.vacancies || 'Não informado'}</dd></div>
        <div><dt>Remuneração</dt><dd>{c.salary || 'Não informada'}</dd></div>
      </dl>
      <div className="roles-line"><span className="meta-label">Cargos</span> {roles || 'Não informado'}</div>
      <details className="contest-details"><summary>Ver cargos e informações da fonte</summary>
        <div className="details-content">
          <p><strong>Concurso:</strong> {c.title}</p>
          <p><strong>Órgão:</strong> {c.organization || 'Não informado'}. <strong>Região:</strong> {c.region || 'Não informada'}.</p>
          {c.roles.length > 0 && <ul aria-label="Todos os cargos">{c.roles.map((role, i) => <li key={`${role}-${i}`}>{role}</li>)}</ul>}
          <p><strong>Situação informada pela fonte:</strong> {c.status || 'Não informada'}</p>
          <p>{c.registrationStart && <><strong>Início informado:</strong> {brDate(c.registrationStart)}. </>}<strong>No painel desde:</strong> {brDate(c.firstSeenAt)}.</p>
          {c.salary && <p>A remuneração pode variar conforme o cargo. Confirme os valores no edital.</p>}
          {c.noticeUrl && <a className="notice-link" href={c.noticeUrl} target="_blank" rel="noreferrer"><FileText size={15}/>Ver edital</a>}
          {c.applicationUrl && <a className="notice-link" href={c.applicationUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={15}/>Página de inscrição</a>}
        </div>
      </details>
    </div>
    <div className="contest-actions">
      <span className={`status-pill ${state === 'open' ? 'open' : state === 'closed' || state === 'expired' ? 'closed' : 'unknown'}`}><span/>{stateLabels[state]}</span>
      <div className={`deadline ${urgent ? 'urgent' : ''} ${state === 'expired' ? 'ended' : ''}`}><span className="deadline-label">{state === 'scheduled' ? 'Inscrições a partir de' : 'Inscrições até'}</span><strong>{brDate(state === 'scheduled' ? c.registrationStart : c.registrationEnd) || 'Sem prazo na fonte'}</strong><span className="deadline-note">{deadlineNote(c, now)}</span></div>
      {c.sourceUrl ? <a className="source-button" href={c.sourceUrl} target="_blank" rel="noreferrer">Ver na PCI Concursos <ArrowUpRight size={14}/></a> : <span className="no-source">Sem link da fonte</span>}
    </div>
  </article>;
}
