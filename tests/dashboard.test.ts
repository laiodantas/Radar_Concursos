import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Dashboard from "../src/components/dashboard";

// O tsconfig usa jsx:"preserve" (exigido pelo Next), então o tsx transpila o painel para
// React.createElement sem importar React. Expomos o global só para renderizar neste teste.
(globalThis as unknown as { React?: typeof React }).React = React;

type Contest = { id:string; title:string; organization:string|null; roles:string[]; city:string|null; uf:string|null; region:string|null; vacancies:string|null; salary:string|null; registrationStart:string|null; registrationEnd:string|null; status:string|null; sourceUrl:string|null; noticeUrl:string|null; applicationUrl:string|null; firstSeenAt:string; isDemo:boolean };
type LastRun = { status:string; startedAt:string; errorMessage:string|null; returnedCount:number; expectedCount:number|null; truncated:boolean };
const contest = (over: Partial<Contest> = {}): Contest => ({
  id:"c1", title:"USP abre concurso público", organization:"USP - Universidade de São Paulo", roles:["PROFESSOR TITULAR"], city:null, uf:"SP",
  region:"SUDESTE", vacancies:"1", salary:"R$ 25.261,98", registrationStart:"2026-09-16T15:00:00.000Z", registrationEnd:"2026-10-16T15:00:00.000Z",
  status:"Inscrições abertas", sourceUrl:"https://example.org/edital", noticeUrl:null, applicationUrl:null, firstSeenAt:"2026-09-29T12:00:00.000Z", isDemo:false, ...over
});
const data = (contests: Contest[], lastRun: LastRun | null = null) => ({
  contests, events: [],
  stats: { total: contests.length, newSinceLast: 0, closingSoon: 0, lastSuccessAt: "2026-09-29T12:00:00.000Z", lastRun, isDemo: false, source: "PCI Concursos" }
});
const render = (contests: Contest[], lastRun: LastRun | null = null) => renderToStaticMarkup(React.createElement(Dashboard, { data: data(contests, lastRun) }));
const civilDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

describe("painel", () => {
  it("mostra Ver Edital dentro dos detalhes somente quando há link disponível", () => {
    const noticeUrl = "https://example.org/concurso/edital.pdf";
    const withNotice = render([contest({ noticeUrl })]);
    const details = withNotice.match(/<details\b[^>]*>[\s\S]*?<\/details>/)?.[0] ?? "";
    assert.ok(details.includes('href="' + noticeUrl + '"'));
    assert.ok(details.includes('target="_blank" rel="noopener noreferrer"'));
    assert.ok(details.includes('Ver Edital'));
    assert.ok(!render([contest()]).includes('Ver Edital'));
  });
  it("esconde o filtro de cidade quando a fonte não devolve cidade", () => {
    assert.ok(!render([contest()]).includes(">Cidade<"));
  });
  it("mostra o filtro de cidade quando há cidades", () => {
    assert.ok(render([contest({ city: "São Paulo" })]).includes(">Cidade<"));
  });
  it("avisa quando a fonte anunciou mais registros do que a consulta recebeu", () => {
    const truncated = render([contest()], { status:"success", startedAt:"2026-09-29T12:00:00.000Z", errorMessage:null, returnedCount:454, expectedCount:500, truncated:true });
    assert.ok(truncated.includes("Consulta possivelmente incompleta"));
    assert.ok(truncated.includes("454"));
    const complete = render([contest()], { status:"success", startedAt:"2026-09-29T12:00:00.000Z", errorMessage:null, returnedCount:454, expectedCount:454, truncated:false });
    assert.ok(!complete.includes("Consulta possivelmente incompleta"));
  });
  it("resume listas longas de cargos no cartão", () => {
    const many = render([contest({ roles: ["Analista","Técnico","Auditor","Fiscal"] })]);
    assert.ok(many.includes("Analista, Técnico e mais 2"));
    assert.ok(many.includes("Auditor"));
    assert.ok(many.includes("<details"));
  });
  it("rotula cada campo do cartão e traduz o prazo em palavras", () => {
    const html = render([contest()]);
    for (const label of ["Local", "Cargos", "Vagas"]) assert.ok(html.includes(`>${label}<`), `faltou o rótulo ${label}`);
    assert.ok(html.includes("Inscrições até"));
    assert.ok(html.includes("R$ 25.261,98"));
    assert.ok(html.includes("Ver na PCI Concursos"), "o cartão precisa apontar para a fonte");
  });
  it("explica prazos próximos, vencidos e ausentes", () => {
    assert.ok(render([contest({ registrationEnd: `${civilDay(3)}T12:00:00-03:00` })]).includes("Faltam 3 dias"));
    assert.ok(render([contest({ registrationEnd: `${civilDay(0)}T12:00:00-03:00` })]).includes("Encerram hoje"));
    assert.ok(render([contest({ registrationEnd: `${civilDay(-5)}T12:00:00-03:00` })]).includes("Encerradas há 5 dias"));
    assert.ok(render([contest({ registrationEnd: null })]).includes("Sem prazo na fonte"));
  });
  it("oferece o alternador de tema com rótulo acessível", () => {
    const html = render([contest()]);
    assert.ok(html.includes("Usar tema escuro"));
    assert.ok(html.includes("aria-pressed=\"false\""));
  });
  it("renderiza no máximo 25 concursos e oferece próxima página", () => {
    const html = render(Array.from({length: 60}, (_, i) => contest({id: `c${i}`})));
    assert.equal((html.match(/class="contest-card"/g) ?? []).length, 25);
    assert.ok(html.includes("Próxima"));
    assert.ok(html.includes("Página 1 de 3"));
  });
  it("o instantâneo estático mostra todos os registros sem botões de paginação", () => {
    const records = Array.from({length: 60}, (_, i) => contest({id: `c${i}`}));
    const html = renderToStaticMarkup(React.createElement(Dashboard, {data: data(records), staticPreview: true}));
    assert.equal((html.match(/class="contest-card"/g) ?? []).length, 60);
    assert.ok(!html.includes("Páginas de concursos"));
  });
  it("anuncia a contagem de resultados para leitores de tela", () => {
    assert.ok(render([contest()]).includes('role="status"'));
  });
  it("explica de onde vêm os dados na seção Como ler", () => {
    const html = render([contest()]);
    assert.ok(html.includes("De onde vêm esses números"));
    assert.ok(html.includes("acervo pode ser incompleto"));
    assert.ok(html.includes("America/Sao_Paulo"));
  });
});
