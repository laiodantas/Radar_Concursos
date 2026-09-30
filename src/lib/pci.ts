import type { SourceResult } from "./types";
import { extractMcpMeta, extractMcpRecords, normalizeRecord } from "./normalize";

export type McpTool = { name: string; description?: string; inputSchema?: { properties?: Record<string, unknown>; required?: string[] } };
export type McpSession = { session?: string; version: string };
type Rpc = { jsonrpc: "2.0"; id: number; method: string; params?: Record<string, unknown> };
export const endpoint = process.env.PCI_MCP_URL ?? "https://mcp.pciconcursos.com.br/mcp";
export const timeoutMs = Number(process.env.SYNC_TIMEOUT_MS ?? 20_000);
export const handshakeVersions = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const debug = (...parts: unknown[]) => { if (process.env.PCI_DEBUG) console.error("[pci]", ...parts); };
async function request(body: Rpc, session?: string, protocolVersion?: string): Promise<{ data: unknown; session?: string }> {
  const ctrl = new AbortController(); const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    if (session) headers["mcp-session-id"] = session;
    if (protocolVersion) headers["mcp-protocol-version"] = protocolVersion;
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal, cache: "no-store" });
    const returnedSession = response.headers.get("mcp-session-id") ?? session;
    debug(`${body.method} -> HTTP ${response.status}`, response.headers.get("content-type") ?? "sem content-type", returnedSession ? "com sessão" : "sem sessão");
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).trim().slice(0, 300);
      throw new Error(`MCP HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const text = await response.text();
    let data: unknown;
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const messages = text.split(/\r?\n\r?\n/).flatMap(frame => frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim())).filter(Boolean);
      const json = messages.map(m => { try { return JSON.parse(m); } catch { return null; } }).filter(Boolean);
      data = json.find(x => (x as { id?: number }).id === body.id) ?? json.at(-1);
    } else {
      try { data = JSON.parse(text); } catch { debug("resposta não-JSON:", text.trim().slice(0, 300)); throw new Error("A resposta MCP não era JSON válido."); }
    }
    if (!data) throw new Error("A resposta MCP não continha uma mensagem JSON.");
    const envelope = data as { error?: { message?: string }; result?: unknown };
    if (envelope.error) throw new Error(`MCP: ${envelope.error.message ?? "erro JSON-RPC"}`);
    return { data: envelope.result ?? data, session: returnedSession ?? undefined };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`Tempo limite MCP após ${timeoutMs} ms.`);
    throw error;
  } finally { clearTimeout(timeout); }
}
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const max = Math.max(0, Number(process.env.SYNC_MAX_RETRIES ?? 2)); let last: unknown;
  for (let n=0; n<=max; n++) { try { return await fn(); } catch (e) { last=e; if (n < max) await new Promise(r => setTimeout(r, 400 * 2 ** n)); } }
  throw last;
}
async function initialized(session: string | undefined, protocolVersion: string) {
  const ctrl = new AbortController(); const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string,string> = { "content-type":"application/json", accept:"application/json, text/event-stream", "mcp-protocol-version":protocolVersion };
    if(session) headers["mcp-session-id"]=session;
    const res=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"}),signal:ctrl.signal,cache:"no-store"});
    debug(`notifications/initialized -> HTTP ${res.status}`);
    if(!res.ok) throw new Error(`MCP HTTP ${res.status} na inicialização.`);
  } finally { clearTimeout(timeout); }
}
/** Negocia a versão do protocolo e conclui o handshake, devolvendo a sessão pronta para tools/list e tools/call. */
export async function negotiateSession(): Promise<McpSession> {
  let init: McpSession | undefined;
  let lastInitError: unknown;
  for (const version of handshakeVersions) {
    try {
      const response = await withRetry(() => request({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: version, capabilities: {}, clientInfo: { name: "radar-de-concursos", version: "0.1.0" } } }));
      const result = response.data as { protocolVersion?: string };
      const negotiated = result.protocolVersion ?? version;
      if (!handshakeVersions.includes(negotiated)) throw new Error(`Versão MCP negociada não suportada pelo cliente: ${negotiated}`);
      init = { session: response.session, version: negotiated };
      break;
    } catch (error) {
      lastInitError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/(protocol|version|unsupported|mcp http 400)/i.test(message)) break;
    }
  }
  if (!init?.version) throw lastInitError instanceof Error ? lastInitError : new Error("Não foi possível negociar versão do protocolo MCP.");
  await withRetry(() => initialized(init!.session, init!.version));
  return init;
}
export async function listTools(session: string | undefined, version: string): Promise<McpTool[]> {
  const toolResponse = await withRetry(() => request({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }, session, version));
  const toolBody = toolResponse.data as { tools?: McpTool[] };
  if (!Array.isArray(toolBody.tools)) throw new Error("tools/list do MCP não trouxe uma lista de ferramentas.");
  return toolBody.tools;
}
export async function callTool(session: string | undefined, version: string, name: string, args: Record<string, unknown>, id = 10): Promise<unknown> {
  const out = await withRetry(() => request({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, session, version));
  return out.data;
}
export function configuredCalls(tools: McpTool[]) {
  const raw = process.env.PCI_QUERIES_JSON;
  if (raw) {
    let calls: Array<{ tool: string; arguments?: Record<string, unknown> }>;
    try { calls = JSON.parse(raw) as typeof calls; } catch { throw new Error("PCI_QUERIES_JSON não é um JSON válido."); }
    if (!Array.isArray(calls) || calls.length === 0) throw new Error("PCI_QUERIES_JSON deve ser uma lista não vazia de chamadas.");
    return calls.map(c => { if (!c || typeof c.tool !== "string") throw new Error("Cada item de PCI_QUERIES_JSON precisa de um campo tool."); if (!tools.some(t => t.name === c.tool)) throw new Error(`Ferramenta não anunciada pelo MCP: ${c.tool}`); return { name: c.tool, args: c.arguments ?? {} }; });
  }
  // Documentação PCI descreve listar_concursos como geral e com filtros opcionais.
  const list = tools.find(t => t.name === "listar_concursos");
  if (!list) throw new Error("O servidor não anunciou listar_concursos; configure PCI_QUERIES_JSON após inspecionar tools/list.");
  const required = list.inputSchema?.required ?? [];
  if (required.length) throw new Error(`listar_concursos exige parâmetros não documentados: ${required.join(", ")}. Configure PCI_QUERIES_JSON após validar o schema.`);
  return [{ name: list.name, args: {} }];
}
export async function fetchPci(): Promise<SourceResult> {
  const session = await negotiateSession();
  const tools = await listTools(session.session, session.version);
  const calls = configuredCalls(tools);
  const results: unknown[] = [];
  const notes: string[] = [];
  let truncated = false;
  let expectedCount: number | undefined;
  for (let i=0; i<calls.length; i++) {
    const c = calls[i];
    const data = await callTool(session.session, session.version, c.name, c.args, 10+i);
    const records = extractMcpRecords(data);
    if (records.length === 0) throw new Error(`A ferramenta ${c.name} não retornou registros reconhecíveis. Nenhum dado foi aplicado.`);
    const total = extractMcpMeta(data)?.total;
    if (typeof total === "number") {
      expectedCount = Math.max(expectedCount ?? 0, total);
      if (total === records.length) notes.push(`${c.name}: ${records.length} registros em um único lote, igual a meta.total (sem sinal de paginação).`);
      else { truncated = true; notes.push(`${c.name}: recebidos ${records.length} de meta.total=${total}; pode haver paginação não configurada.`); }
    }
    results.push(...records);
  }
  const deduped = new Map<string, ReturnType<typeof normalizeRecord>>();
  for (const row of results) { const contest = normalizeRecord(row as Record<string, unknown>); deduped.set(contest.sourceKey, contest); }
  notes.push("A PCI informa que o acervo pode não cobrir todos os editais; os registros refletem apenas as ferramentas e filtros consultados.");
  return { contests: [...deduped.values()], source: "pci", complete: !truncated, expectedCount, notes };
}
