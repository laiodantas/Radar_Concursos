import type { DashboardData } from '@/lib/dashboard-types';
import { daysTo, registrationState } from '@/lib/contest-state';
export function DashboardStats({ data, now }: { data: DashboardData; now: Date }) {
  const open = data.contests.filter(c => registrationState(c, now) === 'open');
  return <div className="stats-grid compact-stats" aria-label="Resumo do painel">
    <article className="stat-card"><span className="stat-number">{data.contests.length}</span><span className="stat-caption">no painel</span></article>
    <article className="stat-card"><span className="stat-number">{open.length}</span><span className="stat-caption">abertos com prazo vigente</span></article>
    <article className="stat-card"><span className="stat-number">{open.filter(c => (daysTo(c.registrationEnd, now) ?? Infinity) <= 7).length}</span><span className="stat-caption">encerram em até 7 dias</span></article>
    <article className="stat-card"><span className="stat-number">{data.stats.newSinceLast}</span><span className="stat-caption">novos na última consulta</span></article>
  </div>;
}
