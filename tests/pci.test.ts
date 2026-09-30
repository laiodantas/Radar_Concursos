import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { configuredCalls, type McpTool } from "../src/lib/pci";

const listar: McpTool = { name: "listar_concursos", inputSchema: { properties: { uf: { type: "string" } } } };
const pesquisar: McpTool = { name: "pesquisar_concursos", inputSchema: { properties: { query: { type: "string" } }, required: ["query"] } };

let previous: string | undefined;
beforeEach(() => { previous = process.env.PCI_QUERIES_JSON; delete process.env.PCI_QUERIES_JSON; });
afterEach(() => { if (previous === undefined) delete process.env.PCI_QUERIES_JSON; else process.env.PCI_QUERIES_JSON = previous; });

describe("seleção de chamadas do MCP", () => {
  it("usa listar_concursos sem argumentos quando a ferramenta não exige parâmetros", () => {
    assert.deepEqual(configuredCalls([listar, pesquisar]), [{ name: "listar_concursos", args: {} }]);
  });
  it("recusa listar_concursos quando o schema exige parâmetros não documentados", () => {
    assert.throws(() => configuredCalls([{ ...listar, inputSchema: { required: ["uf"] } }]), /exige parâmetros/);
  });
  it("exige PCI_QUERIES_JSON quando listar_concursos não é anunciada", () => {
    assert.throws(() => configuredCalls([pesquisar]), /não anunciou listar_concursos/);
  });
  it("respeita PCI_QUERIES_JSON e rejeita configurações inválidas", () => {
    process.env.PCI_QUERIES_JSON = JSON.stringify([{ tool: "pesquisar_concursos", arguments: { query: "analista" } }]);
    assert.deepEqual(configuredCalls([listar, pesquisar]), [{ name: "pesquisar_concursos", args: { query: "analista" } }]);
    process.env.PCI_QUERIES_JSON = JSON.stringify([{ tool: "buscar_apostilas" }]);
    assert.throws(() => configuredCalls([listar, pesquisar]), /não anunciada/);
    process.env.PCI_QUERIES_JSON = "não é json";
    assert.throws(() => configuredCalls([listar]), /JSON válido/);
    process.env.PCI_QUERIES_JSON = "[]";
    assert.throws(() => configuredCalls([listar]), /lista não vazia/);
    process.env.PCI_QUERIES_JSON = JSON.stringify([{ arguments: {} }]);
    assert.throws(() => configuredCalls([listar]), /campo tool/);
  });
});
