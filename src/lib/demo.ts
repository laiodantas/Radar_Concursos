import { normalizeRecord } from "./normalize";
import type { SourceResult } from "./types";

const samples = [
  { id: "demo-1", titulo: "DEMONSTRAÇÃO · Instituto Público de Exemplo — Analista", orgao: "Instituto Público de Exemplo (fictício)", cargo: ["Analista administrativo"], cidade: "Curitiba", uf: "PR", regiao: "Sul", vagas: "Não informado", remuneracao: "Não informado", inscricoes_fim: "2026-11-15", situacao: "Demonstração", url: "" },
  { id: "demo-2", titulo: "DEMONSTRAÇÃO · Município de Amostra — Técnico", orgao: "Município de Amostra (fictício)", cargo: ["Técnico em gestão"], cidade: "Campinas", uf: "SP", regiao: "Sudeste", vagas: "12", remuneracao: "R$ 4.200,00", inscricoes_fim: "2026-10-20", situacao: "Demonstração", url: "" },
  { id: "demo-3", titulo: "DEMONSTRAÇÃO · Fundação Modelo — Professor", orgao: "Fundação Modelo (fictícia)", cargo: ["Professor de matemática"], cidade: "Recife", uf: "PE", regiao: "Nordeste", vagas: "8", remuneracao: "Não informado", inscricoes_fim: "2026-10-05", situacao: "Demonstração", url: "" },
  { id: "demo-4", titulo: "DEMONSTRAÇÃO · Agência Ilustrativa — Assistente", orgao: "Agência Ilustrativa (fictícia)", cargo: ["Assistente administrativo"], cidade: "Brasília", uf: "DF", regiao: "Centro-Oeste", vagas: "Não informado", remuneracao: "R$ 3.800,00", inscricoes_fim: "2026-09-26", situacao: "Demonstração", url: "" }
];
export function demoResult(): SourceResult { return { contests: samples.map(x => normalizeRecord(x)), source: "demo", complete: true, notes: ["Registros sintéticos; não representam concursos reais nem oportunidades atuais."] }; }
