import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractMcpMeta, extractMcpRecords, normalizeRecord, uniqueBySourceKey } from "../src/lib/normalize";
import { daysRemaining } from "../src/lib/date-utils";

const sample = { id: "pci-44", titulo: "Concurso de exemplo", orgao: "Instituto Exemplo", cargo: ["Analista"], cidade: "São Paulo", uf: "sp", regiao: "Sudeste", vagas: 4, remuneracao: "R$ 5.000", inscricoes_fim: "2026-11-01", url: "https://example.org/edital/44" };

// Formato real devolvido por listar_concursos em 2026-09-29 (campos aninhados em datas/noticia).
const real = {
  id: 294509,
  titulo: "AgSUS - Agência Brasileira de Apoio à Gestão do SUS",
  cargos_resumo: "Psicólogo",
  cargos: ["PSICÓLOGO"],
  vagas_salario: "15 vagas até R$ 7.181,50",
  formacao: "Superior",
  regiao: "SUDESTE",
  uf: "SP",
  datas: { inicio: "2026-09-16", fim: "2026-10-16", texto: "", aberto: true, dias_restantes: 17 },
  noticia: { id: 294509, titulo: "AgSUS retifica processo seletivo para psicólogos", link: "https://www.pciconcursos.com.br/noticias/agsus-retifica-processo-seletivo-para-psicologos", imagem: "https://cdn.pci.app.br/img/i/c051a93a0432948b93880b872bfefc2b.png" },
  apostila: null
};

describe("normalização de registros MCP", () => {
  it("mapeia campos observados, preserva o original e interpreta data civil em São Paulo", () => {
    const value = normalizeRecord(sample);
    assert.equal(value.title, "Concurso de exemplo");
    assert.equal(value.organization, "Instituto Exemplo");
    assert.equal(value.uf, "SP");
    assert.equal(value.roles[0], "Analista");
    assert.equal(value.vacancies, "4");
    assert.equal(value.salary, "R$ 5.000");
    assert.equal(value.registrationEnd?.toISOString(), "2026-11-01T15:00:00.000Z");
    assert.equal(value.sourceUrl, "https://example.org/edital/44");
    assert.equal(value.raw, sample);
    assert.equal(value.noticeUrl, undefined);
  });
  it("lê a forma text JSON usada em content do MCP e ignora texto sem registro", () => {
    const result = { content: [{ type: "text", text: JSON.stringify({ meta: { total: 1 }, data: [sample], errors: [] }) }] };
    assert.equal(extractMcpRecords(result).length, 1);
    assert.equal(extractMcpMeta(result)?.total, 1);
    assert.equal(extractMcpRecords({ content: [{ type: "text", text: "sem dados" }] }).length, 0);
    assert.throws(() => extractMcpRecords({ isError: true, content: [] }));
  });
  it("deduplica link estável e aceita ausência de campos opcionais", () => {
    const first = normalizeRecord(sample);
    const second = normalizeRecord({ ...sample, remuneracao: "atualização" });
    assert.equal(first.sourceKey, second.sourceKey);
    assert.equal(uniqueBySourceKey([first, second]).length, 1);
    const minimal = normalizeRecord({ titulo: "Concurso mínimo" });
    assert.equal(minimal.city, undefined);
    assert.equal(minimal.salary, undefined);
  });
  it("calcula dias civis em America/Sao_Paulo", () => {
    assert.equal(daysRemaining("2026-11-01T15:00:00.000Z", "2026-10-31T15:00:00.000Z"), 1);
    assert.equal(daysRemaining("2026-10-30T15:00:00.000Z", "2026-10-31T15:00:00.000Z"), -1);
  });
  it("mapeia o registro real: manchete, órgão, prazos aninhados e vagas_salario", () => {
    const value = normalizeRecord(real);
    assert.equal(value.title, "AgSUS retifica processo seletivo para psicólogos");
    assert.equal(value.organization, "AgSUS - Agência Brasileira de Apoio à Gestão do SUS");
    assert.equal(value.roles[0], "PSICÓLOGO");
    assert.equal(value.region, "SUDESTE");
    assert.equal(value.uf, "SP");
    assert.equal(value.vacancies, "15");
    assert.equal(value.salary, "até R$ 7.181,50");
    assert.equal(value.registrationStart?.toISOString(), "2026-09-16T15:00:00.000Z");
    assert.equal(value.registrationEnd?.toISOString(), "2026-10-16T15:00:00.000Z");
    assert.equal(value.status, "Inscrições abertas");
    assert.equal(value.sourceUrl, real.noticia.link);
    assert.equal(value.city, undefined);
    assert.equal(value.raw, real);
  });
  it("interpreta cadastro de reserva e situação textual sem perder o prazo", () => {
    const reserve = normalizeRecord({ ...real, vagas_salario: "Cadastro de reserva até R$ 8.800,00" });
    assert.equal(reserve.vacancies, "Cadastro de reserva");
    assert.equal(reserve.salary, "até R$ 8.800,00");
    const withoutVacancies = normalizeRecord({ ...real, vagas_salario: "Vagas até R$ 15.034,81" });
    assert.equal(withoutVacancies.vacancies, undefined);
    assert.equal(withoutVacancies.salary, "até R$ 15.034,81");
    const extended = normalizeRecord({ ...real, datas: { ...real.datas, texto: "Prorrogado" } });
    assert.equal(extended.status, "Inscrições abertas (Prorrogado)");
    const closed = normalizeRecord({ ...real, datas: { ...real.datas, aberto: false, texto: "" } });
    assert.equal(closed.status, "Inscrições encerradas");
    const cancelled = normalizeRecord({ ...real, datas: { ...real.datas, texto: "Cancelado" } });
    assert.equal(cancelled.status, "Cancelado");
  });
  it("mantém a chave pelo id e detecta mudança em campo aninhado", () => {
    const first = normalizeRecord(real);
    const sameIdOtherLink = normalizeRecord({ ...real, noticia: { ...real.noticia, link: "https://www.pciconcursos.com.br/noticias/outro-slug" } });
    assert.equal(first.sourceKey, sameIdOtherLink.sourceKey);
    const moved = normalizeRecord({ ...real, datas: { ...real.datas, fim: "2026-11-20" } });
    assert.notEqual(first.contentHash, moved.contentHash);
    assert.equal(first.contentHash, normalizeRecord(real).contentHash);
  });
});
