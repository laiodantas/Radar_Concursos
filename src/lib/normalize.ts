import { createHash } from "node:crypto";
import type { NormalizedContest } from "./types";

/**
 * Campos comparados entre execuções para detectar alterações relevantes.
 * `src/lib/sync.ts` usa a mesma lista para montar o diff exibido no painel.
 */
export const trackedContestFields = ["title", "organization", "roles", "city", "uf", "region", "vacancies", "salary", "registrationStart", "registrationEnd", "status", "noticeUrl", "applicationUrl"] as const;

/**
 * Aliases ajustados em 2026-09-29 a partir da resposta real de `listar_concursos`. Formato observado:
 * { id, titulo, cargos_resumo, cargos[], vagas_salario, formacao, regiao, uf,
 *   datas: { inicio, fim, texto, aberto, dias_restantes },
 *   noticia: { id, titulo, link, imagem }, apostila }
 * `titulo` é o órgão/entidade e `noticia.titulo` é a manchete descritiva; `vagas_salario`
 * mistura vagas e remuneração ("15 vagas até R$ 7.181,50"). Caminhos com ponto acessam objetos aninhados.
 */
const aliases: Record<string, string[]> = {
  sourceId: ["id", "codigo", "code", "concurso_id", "id_concurso"],
  sourceUrl: ["noticia.link", "url", "link", "pagina", "pagina_url", "url_concurso", "link_concurso"],
  title: ["noticia.titulo", "titulo", "title", "nome", "concurso", "edital"],
  organization: ["orgao", "órgão", "organization", "instituicao", "instituição", "entidade", "titulo"],
  roles: ["cargos", "cargo", "role", "roles", "profissao", "profissão"],
  city: ["cidade", "city", "municipio", "município"],
  uf: ["uf", "estado", "sigla_uf", "state"],
  region: ["regiao", "região", "region", "macro_regiao", "macro_região"],
  vacancies: ["vagas", "vagas_salario", "vacancies", "quantidade_vagas", "numero_vagas"],
  salary: ["remuneracao", "remuneração", "salario", "salário", "salary", "vagas_salario"],
  registrationStart: ["datas.inicio", "inscricoes_inicio", "inscrições_inicio", "data_inicio_inscricoes", "registration_start", "inicio_inscricao", "inicio"],
  registrationEnd: ["datas.fim", "inscricoes_fim", "inscrições_fim", "data_fim_inscricoes", "prazo", "registration_end", "data_limite", "fim_inscricao", "fim"],
  status: ["situacao", "situação", "status", "inscricoes", "inscrições"],
  noticeUrl: ["edital_url", "url_edital", "link_edital", "notice_url"],
  applicationUrl: ["inscricao_url", "url_inscricao", "link_inscricao", "application_url"]
};
function keyName(s: string) { return s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); }
function asText(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return undefined;
}
function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
}
function child(obj: Record<string, unknown>, name: string): unknown {
  const found = Object.entries(obj).find(([k]) => keyName(k) === keyName(name));
  return found?.[1];
}
function resolve(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split(".")) {
    const container = asObject(current);
    if (!container) return undefined;
    current = child(container, segment);
  }
  return current;
}
function get(obj: Record<string, unknown>, field: string): unknown {
  for (const alias of aliases[field] ?? []) {
    const value = resolve(obj, alias);
    if (value !== undefined && value !== null && !(typeof value === "string" && !value.trim())) return value;
  }
  return undefined;
}
function httpUrl(value: unknown): string | undefined {
  const text = asText(value); if (!text) return undefined;
  try { const u=new URL(text); return u.protocol==="https:"||u.protocol==="http:"?u.toString():undefined; } catch { return undefined; }
}
function date(v: unknown): Date | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const d = typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)
    ? new Date(`${v.slice(6)}-${v.slice(3,5)}-${v.slice(0,2)}T12:00:00-03:00`)
    : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(`${v}T12:00:00-03:00`)
      : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
/** "15 vagas até R$ 7.181,50" -> "15"; "Cadastro de reserva até R$ 8.800,00" -> "Cadastro de reserva". */
function vacancyCount(value: unknown): string | undefined {
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  const text = asText(value); if (!text) return undefined;
  if (/^\d+$/.test(text)) return text;
  return text.match(/(\d[\d.]*)\s*vagas?\b/i)?.[1] ?? (/cadastro de reserva/i.test(text) ? "Cadastro de reserva" : undefined);
}
export function salaryText(value: unknown): string | undefined {
  const text = asText(value); if (!text) return undefined;
  return text.match(/(?:até\s+|a partir de\s+|de\s+)?R\$\s*[\d.,]+(?:\s*(?:a|até|–|-)\s*R\$\s*[\d.,]+)?/i)?.[0];
}
/** Combina `datas.aberto` e `datas.texto` ("Prorrogado", "Reaberto", "Cancelado") em uma situação legível. */
function statusText(raw: Record<string, unknown>): string | undefined {
  const datas = asObject(resolve(raw, "datas"));
  if (datas) {
    const texto = asText(child(datas, "texto"));
    if (texto && /cancelad|suspens/i.test(texto)) return texto;
    const aberto = child(datas, "aberto");
    const base = aberto === true ? "Inscrições abertas" : aberto === false ? "Inscrições encerradas" : undefined;
    if (base) return texto ? `${base} (${texto})` : base;
    if (texto) return texto;
  }
  return asText(get(raw, "status"));
}
function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function hash(s: string) { return createHash("sha256").update(s).digest("hex"); }
function objArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(objArray);
  if (!value || typeof value !== "object") return [];
  const o = value as Record<string, unknown>;
  for (const k of ["concursos", "resultados", "items", "itens", "data", "results", "editais"]) {
    if (Array.isArray(o[k])) return objArray(o[k]);
  }
  return [o];
}
function payloadOf(result: Record<string, unknown>): unknown {
  let payload: unknown = result.structuredContent ?? result;
  if (Array.isArray(result.content)) {
    const texts = (result.content as Array<Record<string, unknown>>).filter(c => c.type === "text").map(c => c.text).filter((x): x is string => typeof x === "string");
    const joined = texts.join("\n").trim();
    if (!result.structuredContent && joined) { try { payload = JSON.parse(joined); } catch { payload = { text: joined }; } }
  }
  return payload;
}
export function extractMcpRecords(result: unknown): Record<string, unknown>[] {
  if (!result || typeof result !== "object") throw new Error("Resposta MCP vazia ou inválida.");
  const r = result as Record<string, unknown>;
  if (r.isError === true) throw new Error("A ferramenta MCP sinalizou erro.");
  return objArray(payloadOf(r)).filter(record => asText(get(record, "title")));
}
/** Metadados do envelope (`meta.total`, `meta.data_atual`), úteis para conferir se a resposta foi truncada. */
export function extractMcpMeta(result: unknown): Record<string, unknown> | undefined {
  const r = asObject(result); if (!r) return undefined;
  return asObject(asObject(payloadOf(r))?.meta);
}
export function normalizeRecord(raw: Record<string, unknown>): NormalizedContest {
  const title = asText(get(raw, "title"));
  if (!title) throw new Error("Registro sem título; não é possível criar chave estável.");
  const organization = asText(get(raw, "organization"));
  const rolesValue = get(raw, "roles");
  const roles = (Array.isArray(rolesValue) ? rolesValue : rolesValue == null ? [] : [rolesValue]).map(asText).filter((v): v is string => !!v);
  const sourceUrl = httpUrl(get(raw, "sourceUrl"));
  const sourceId = asText(get(raw, "sourceId"));
  const baseIdentity = sourceId ?? sourceUrl ?? [title, organization ?? ""].join("|");
  const normalized = {
    sourceKey: `pci:${hash(baseIdentity)}`,
    sourceUrl,
    title,
    organization,
    roles,
    city: asText(get(raw, "city")),
    uf: asText(get(raw, "uf"))?.toUpperCase(),
    region: asText(get(raw, "region")),
    vacancies: vacancyCount(get(raw, "vacancies")),
    salary: salaryText(get(raw, "salary")),
    registrationStart: date(get(raw, "registrationStart")),
    registrationEnd: date(get(raw, "registrationEnd")),
    status: statusText(raw),
    noticeUrl: httpUrl(get(raw, "noticeUrl")),
    applicationUrl: httpUrl(get(raw, "applicationUrl"))
  };
  return {
    ...normalized,
    contentHash: hash(stable(Object.fromEntries(trackedContestFields.map(field => [field, normalized[field]])))),
    raw
  };
}
export function uniqueBySourceKey(records: NormalizedContest[]): NormalizedContest[] {
  return [...new Map(records.map(record => [record.sourceKey, record])).values()];
}
