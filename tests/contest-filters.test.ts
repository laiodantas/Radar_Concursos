import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankFilters, filterContests, readFilters } from '../src/lib/contest-filters';
import { deadlineNote, registrationState } from '../src/lib/contest-state';
import type { Contest } from '../src/lib/dashboard-types';
const now = new Date('2026-09-30T16:00:00-03:00');
const contest = (id: string, extra: Partial<Contest> = {}): Contest => ({ id, title: 'Médico em São Paulo', roles: ['MÉDICO'], organization: 'Prefeitura', city: null, uf: 'SP', region: 'SUDESTE', vacancies: '2', salary: 'até R$ 8.000', registrationStart: '2026-09-01', registrationEnd: '2026-10-03', status: 'Inscrições abertas', sourceUrl: null, noticeUrl: null, applicationUrl: null, firstSeenAt: '2026-09-29', isDemo: false, ...extra });
describe('situação atual e busca', () => {
  it('separa o status da fonte de datas vencidas e futuras', () => {
    assert.equal(registrationState(contest('expired', { registrationEnd: '2026-09-29' }), now), 'expired');
    const future = contest('future', { registrationStart: '2026-10-02' });
    assert.equal(registrationState(future, now), 'scheduled');
    assert.equal(deadlineNote(future, now), 'Começam em 2 dias');
    assert.equal(registrationState(contest('suspended', { status: 'Suspenso' }), now), 'closed');
    assert.equal(registrationState(contest('unknown', { registrationEnd: null }), now), 'unknown');
    assert.equal(deadlineNote(contest('today', { registrationEnd: '2026-09-30' }), now), 'Encerram hoje');
  });
  it('aceita palavras sem acentos e termos em ordem diferente', () => {
    assert.equal(filterContests([contest('a')], { ...blankFilters, q: 'sao medico' }, now).length, 1);
    assert.equal(filterContests([contest('a')], { ...blankFilters, q: 'auditor' }, now).length, 0);
  });
  it('prazo próximo exclui futuros, vencidos e suspensos', () => {
    const rows = [contest('open'), contest('future', { registrationStart: '2026-10-01' }), contest('expired', { registrationEnd: '2026-09-29' }), contest('closed', { status: 'Cancelado' })];
    assert.deepEqual(filterContests(rows, { ...blankFilters, deadline: '7' }, now).map(c => c.id), ['open']);
    assert.deepEqual(filterContests(rows, { ...blankFilters, situation: 'encerradas' }, now).map(c => c.id).sort(), ['closed', 'expired']);
  });
  it('ordenar por prazo não promove registros vencidos', () => {
    const rows = [contest('expired', { registrationEnd: '2026-09-29' }), contest('unknown', { registrationEnd: null }), contest('open'), contest('future', { registrationStart: '2026-10-01' })];
    assert.deepEqual(filterContests(rows, { ...blankFilters, sort: 'deadline' }, now).map(c => c.id), ['open', 'future', 'unknown', 'expired']);
  });
  it('ignora preferências corrompidas e valores não textuais', () => {
    assert.deepEqual(readFilters({ q: null, uf: {}, deadline: 'invalid', sort: 'wrong' }), blankFilters);
    assert.deepEqual(readFilters([]), blankFilters);
  });
});
