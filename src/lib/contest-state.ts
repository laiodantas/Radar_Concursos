import { daysRemaining } from './date-utils';

type DatedContest = { registrationStart?: string | Date | null; registrationEnd?: string | Date | null; status?: string | null; isDemo?: boolean };
export function daysTo(date: string | Date | null | undefined, now: Date = new Date()) {
  return date && !Number.isNaN(new Date(date).getTime()) ? daysRemaining(date, now) : null;
}
export function registrationState(contest: DatedContest, now: Date = new Date()) {
  const status = contest.status?.toLocaleLowerCase('pt-BR') ?? '';
  const end = daysTo(contest.registrationEnd, now);
  const start = daysTo(contest.registrationStart, now);
  if (/cancelad|suspens/.test(status)) return 'closed';
  if (end !== null && end < 0) return 'expired';
  if (/encerrad|fechad|finalizad/.test(status)) return 'closed';
  if (start !== null && start > 0) return 'scheduled';
  if (end !== null && (/abert/.test(status) || contest.isDemo)) return 'open';
  return 'unknown';
}
export const stateLabels = { open: 'Inscrições abertas', expired: 'Prazo vencido', scheduled: 'Inscrições futuras', closed: 'Encerrado, suspenso ou cancelado', unknown: 'Situação a confirmar' };
export const brDate = (date: string | null) => date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00-03:00` : date)) : null;
export function deadlineNote(contest: DatedContest, now: Date = new Date()) {
  const end = daysTo(contest.registrationEnd, now);
  const start = daysTo(contest.registrationStart, now);
  if (registrationState(contest, now) === 'closed') return 'Confira a situação atual na fonte';
  if (start !== null && start > 0 && (end === null || end >= start)) return `Começam em ${start} ${start === 1 ? 'dia' : 'dias'}`;
  return end === null ? 'Sem prazo na fonte' : end < 0 ? `Encerradas há ${Math.abs(end)} ${end === -1 ? 'dia' : 'dias'}` : end === 0 ? 'Encerram hoje' : end === 1 ? 'Encerram amanhã' : `Faltam ${end} dias`;
}
