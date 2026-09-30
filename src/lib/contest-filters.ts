import type { Contest } from './dashboard-types';
import { daysTo, registrationState } from './contest-state';
export type Filters = { q: string; uf: string; city: string; region: string; situation: string; deadline: string; sort: string };
export const blankFilters: Filters = { q: '', uf: '', city: '', region: '', situation: '', deadline: '', sort: 'recent' };
export const PAGE_SIZE = 25;
export const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export function readFilters(value: unknown): Filters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...blankFilters };
  const result = { ...blankFilters };
  for (const key of Object.keys(result) as Array<keyof Filters>) {
    const next = (value as Record<string, unknown>)[key];
    if (typeof next === 'string') result[key] = next;
  }
  if (!['', 'abertas', 'encerradas', 'futuras', 'sem-prazo'].includes(result.situation)) result.situation = '';
  if (!['', '7', '30', 'ended'].includes(result.deadline)) result.deadline = '';
  if (!['recent', 'deadline'].includes(result.sort)) result.sort = 'recent';
  return result;
}
export function filterContests(contests: Contest[], filters: Filters, now: Date) {
  const terms = searchText(filters.q.trim()).split(/\s+/).filter(Boolean);
  const states: Record<string, string[]> = { abertas: ['open'], encerradas: ['closed', 'expired'], futuras: ['scheduled'], 'sem-prazo': ['unknown'] };
  const result = contests.filter(contest => {
    const hay = searchText([contest.title, contest.organization, ...contest.roles, contest.city, contest.uf, contest.region].filter(Boolean).join(' '));
    const state = registrationState(contest, now);
    const end = daysTo(contest.registrationEnd, now);
    return terms.every(term => hay.includes(term)) && (!filters.uf || contest.uf === filters.uf)
      && (!filters.city || contest.city === filters.city) && (!filters.region || contest.region === filters.region)
      && (!filters.situation || states[filters.situation]?.includes(state))
      && (!filters.deadline || (filters.deadline === 'ended' ? end !== null && end < 0 : state === 'open' && end !== null && end >= 0 && end <= Number(filters.deadline)));
  });
  return result.sort((a, b) => {
    if (filters.sort === 'deadline') {
      const rank = (c: Contest) => { const state = registrationState(c, now); return state === 'open' ? 0 : state === 'scheduled' ? 1 : state === 'unknown' ? 2 : 3; };
      const date = rank(a) - rank(b) || (a.registrationEnd ? new Date(a.registrationEnd).getTime() : Infinity) - (b.registrationEnd ? new Date(b.registrationEnd).getTime() : Infinity);
      if (date) return date;
    } else {
      const date = new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
      if (date) return date;
    }
    return a.title.localeCompare(b.title, 'pt-BR') || a.id.localeCompare(b.id);
  });
}
