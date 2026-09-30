import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { callTool, configuredCalls, endpoint, handshakeVersions, listTools, negotiateSession, timeoutMs, type McpTool } from "../src/lib/pci";
import { extractMcpRecords, normalizeRecord } from "../src/lib/normalize";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const clip = (text: string, size = 4000) => (text.length > size ? `${text.slice(0, size)}\n… (${text.length} caracteres no total)` : text);
const section = (label: string, value: unknown) => { console.log(`\n=== ${label} ===`); console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2)); };

const help = `Uso: npm run probe:pci [opções]

Inspeciona o MCP da PCI sem gravar nada no banco (não importa src/lib/db).

  (sem opções)            handshake + tools/list com schemas resumidos
  --call                  chama as ferramentas de PCI_QUERIES_JSON
  --tool <nome>           chama uma ferramenta específica
  --args '<json>'         argumentos da ferramenta de --tool (padrão: {})
  --all-queries           testa cada ferramenta anunciada (pula apostilas) com --args
  --dry-run-sync          roda o coletor e a sincronização em memória (sem banco)
  --schema-out <arquivo>  salva o tools/list completo em JSON
  --out <arquivo>         salva todo o resultado do probe em JSON
  --limit <n>             quantos registros brutos imprimir (padrão: 2)
  --help                  mostra esta ajuda

Variáveis: PCI_MCP_URL, SYNC_TIMEOUT_MS, SYNC_MAX_RETRIES, PCI_QUERIES_JSON, PCI_DEBUG=1.`;

function summarizeTool(tool: McpTool) {
  const properties = tool.inputSchema?.properties ?? {};
  return {
    name: tool.name,
    description: tool.description,
    required: tool.inputSchema?.required ?? [],
    parameters: Object.entries(properties).map(([name, schema]) => {
      const s = (schema ?? {}) as { type?: unknown; description?: unknown; enum?: unknown };
      return { name, type: Array.isArray(s.type) ? s.type.join("|") : s.type, enum: s.enum, description: typeof s.description === "string" ? s.description.slice(0, 160) : undefined };
    })
  };
}

async function main() {
  if (flag("--help") || flag("-h")) { console.log(help); return; }
  const limit = Number(option("--limit") ?? 2);
  console.log(`Endpoint MCP: ${endpoint}`);
  console.log(`Tempo limite: ${timeoutMs} ms`);
  console.log(`Versões de handshake: ${handshakeVersions.join(", ")}`);

  const session = await negotiateSession();
  section("sessão", { protocolVersion: session.version, mcpSessionId: session.session ? "recebido" : "ausente (modo stateless)" });

  const tools = await listTools(session.session, session.version);
  section(`tools/list (${tools.length} ferramentas)`, tools.map(summarizeTool));

  const schemaOut = option("--schema-out");
  if (schemaOut) { await writeFile(schemaOut, `${JSON.stringify(tools, null, 2)}\n`); console.log(`\nSchema completo salvo em ${schemaOut}`); }

  if (flag("--dry-run-sync")) {
    console.log("\n--- dry-run de sincronização (fetchPci + synchronize em memória, sem banco) ---");
    const previousSource = process.env.RADAR_SOURCE;
    process.env.RADAR_SOURCE = "pci";
    try {
      const { fetchPci } = await import("../src/lib/pci");
      const { synchronize } = await import("../src/lib/sync");
      const { memoryStore } = await import("../src/lib/memory-store");
      const store = memoryStore();
      section("1ª execução", await synchronize(fetchPci, store));
      section("2ª execução", { ...await synchronize(fetchPci, store), concursos: store.rows().length, eventos: store.events().map(event => event.kind) });
      const sample = store.rows()[0];
      if (sample) section("amostra normalizada", { title: sample.title, organization: sample.organization, roles: sample.roles, uf: sample.uf, region: sample.region, vacancies: sample.vacancies, salary: sample.salary, registrationStart: sample.registrationStart?.toISOString() ?? null, registrationEnd: sample.registrationEnd?.toISOString() ?? null, status: sample.status, sourceUrl: sample.sourceUrl });
    } finally {
      if (previousSource === undefined) delete process.env.RADAR_SOURCE; else process.env.RADAR_SOURCE = previousSource;
    }
    return;
  }

  let calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const explicitTool = option("--tool");
  if (explicitTool) {
    if (!tools.some(t => t.name === explicitTool)) throw new Error(`Ferramenta não anunciada pelo MCP: ${explicitTool}`);
    let parsed: Record<string, unknown> = {};
    const rawArgs = option("--args");
    if (rawArgs) { try { parsed = JSON.parse(rawArgs) as Record<string, unknown>; } catch { throw new Error("--args precisa ser um JSON válido."); } }
    calls = [{ name: explicitTool, args: parsed }];
  } else if (flag("--call")) {
    calls = configuredCalls(tools);
  } else if (flag("--all-queries")) {
    const skipped = tools.filter(t => /apostila/i.test(t.name)).map(t => t.name);
    if (skipped.length) console.log(`Apostilas fora do escopo do produto, ignoradas: ${skipped.join(", ")} (use --tool para consultar mesmo assim).`);
    calls = tools.filter(t => !/apostila/i.test(t.name)).map(t => ({ name: t.name, args: {} }));
  } else {
    console.log("\nNenhuma chamada de ferramenta: use --call, --tool <nome> ou --all-queries para inspecionar registros.");
  }

  const executed: Array<Record<string, unknown>> = [];
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    console.log(`\n--- tools/call ${call.name} ${JSON.stringify(call.args)} ---`);
    const data = await callTool(session.session, session.version, call.name, call.args, 10 + i);
    let records: Record<string, unknown>[] = [];
    let extractionError: string | null = null;
    try { records = extractMcpRecords(data); } catch (error) { extractionError = error instanceof Error ? error.message : String(error); }
    console.log(`Registros reconhecidos: ${records.length}${extractionError ? ` (extração falhou: ${extractionError})` : ""}`);
    if (records.length === 0) {
      section("resposta bruta (nenhum registro reconhecido)", clip(JSON.stringify(data, null, 2)));
    } else {
      const keys = [...new Set(records.flatMap(record => Object.keys(record)))].sort();
      section("campos observados nos registros", keys);
      section("chaves de content/structure", Object.keys(data as Record<string, unknown>));
      for (const record of records.slice(0, Math.max(0, limit))) section("registro bruto", record);
      const first = records[0];
      try { section("normalização do primeiro registro", normalizeRecord(first)); }
      catch (error) { console.log(`\nFalha ao normalizar o primeiro registro: ${error instanceof Error ? error.message : String(error)}`); }
    }
    executed.push({ tool: call.name, args: call.args, recognized: records.length, extractionError, result: data });
  }

  const out = option("--out");
  if (out) { await writeFile(out, `${JSON.stringify({ endpoint, protocolVersion: session.version, tools, calls: executed }, null, 2)}\n`); console.log(`\nResultado completo salvo em ${out}`); }
}
main().catch(error => { console.error(`Probe MCP falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`); process.exitCode = 1; });
