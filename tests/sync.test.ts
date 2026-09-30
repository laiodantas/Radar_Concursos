import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { normalizeRecord } from "../src/lib/normalize";
import { synchronize } from "../src/lib/sync";
import { memoryStore } from "../src/lib/memory-store";
import type { SourceResult } from "../src/lib/types";

const input=(id:string,title:string,salary="R$ 4.000",end?:string)=>normalizeRecord({id,titulo:title,orgao:"Órgão de teste",situacao:"Inscrições abertas",cargo:["Analista"],remuneracao:salary,inscricoes_fim:end??"2026-12-20",url:`https://example.org/edital/${id}`});
const result=(...records:ReturnType<typeof input>[]):SourceResult=>({source:"pci",contests:records,complete:false,notes:[],expectedCount:records.length});
let oldSource:string|undefined; let store:ReturnType<typeof memoryStore>;
beforeEach(()=>{oldSource=process.env.RADAR_SOURCE;process.env.RADAR_SOURCE="pci";store=memoryStore();});
afterEach(()=>{mock.restoreAll();if(oldSource===undefined)delete process.env.RADAR_SOURCE;else process.env.RADAR_SOURCE=oldSource;});

describe("sincronização e histórico",()=>{
  it("reverte alterações e inclusões se uma escrita no lote falha", async () => {
    await synchronize(async () => result(input("a", "Original")), store);
    const old = structuredClone(store.rows());
    const oldEvents = structuredClone(store.events());
    mock.method(store.concurso, "update", () => { throw new Error("Falha simulada após inclusão"); });
    await assert.rejects(() => synchronize(async () => result(input("a", "Alterado"), input("b", "Novo")), store), /Falha simulada/);
    assert.deepEqual(store.rows(), old);
    assert.deepEqual(store.events(), oldEvents);
    assert.equal(store.runs().at(-1)!.status, "failed");
  });
  it("agrupa registros novos e evita escritas individuais nos inalterados", async () => {
    const records = Array.from({length: 454}, (_, i) => input(String(i), `Concurso ${i}`));
    await synchronize(async () => result(...records), store);
    const updateSpy = mock.method(store.concurso, "update");
    await synchronize(async () => result(...records), store);
    assert.equal(updateSpy.mock.callCount(), 0);
    assert.equal(store.rows().length, 454);
    assert.equal(store.events().length, 0);
  });
  it("usa a primeira resposta como base e registra novas mudanças sem duplicar eventos",async()=>{
    const first=input("a","Concurso A");
    const fetch=async()=>result(first);
    const initial=await synchronize(fetch,store);
    assert.equal(initial.baseline,true);
    assert.equal(store.rows().length,1);
    assert.equal(store.events().length,0);
    await synchronize(async()=>result(input("a","Concurso A","R$ 5.000"),input("b","Concurso B")),store);
    assert.deepEqual(store.events().map(e=>e.kind).sort(),["changed","new"]);
    await synchronize(async()=>result(input("a","Concurso A","R$ 5.000"),input("b","Concurso B")),store);
    assert.equal(store.rows().length,2);
    assert.equal(store.events().length,2);
  });
  it("falha conserva registros vistos anteriormente e não conclui nem encerra ausentes",async()=>{
    await synchronize(async()=>result(input("kept","Ainda listado")),store);
    const original=store.rows()[0];
    await assert.rejects(()=>synchronize(async()=>{throw new Error("offline");},store),/offline/);
    assert.equal(store.rows().length,1);
    assert.equal(store.rows()[0].id,original.id);
    assert.equal(store.rows()[0].status,original.status);
    assert.equal(store.runs().at(-1)!.status,"failed");
    assert.equal(store.runs().filter(x=>x.status==="success").length,1);
  });
  it("gera o aviso de prazo próximo uma vez por janela e usa dias de São Paulo",async()=>{
    const end=new Date(Date.now()+3*86_400_000).toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
    const item=input("deadline","Prazo de teste","R$ 3.000",end);
    await synchronize(async()=>result(item),store);
    await synchronize(async()=>result(item),store);
    assert.equal(store.events().filter(e=>e.kind==="deadline").length,1);
  });
  it("grava o total anunciado pela fonte para o painel detectar truncamento",async()=>{
    const item=input("a","Concurso A");
    const run=await synchronize(async()=>({...result(item),expectedCount:5,complete:false}),store);
    assert.equal(run.count,1);
    assert.equal(run.expectedCount,5);
    assert.equal(store.runs().at(-1)!.expectedCount,5);
    const source=await synchronize(async()=>({...result(item),expectedCount:undefined}),store);
    assert.equal(source.expectedCount,null);
  });
});
