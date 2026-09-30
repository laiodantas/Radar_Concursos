/* eslint-disable @typescript-eslint/no-explicit-any */
import type { db } from "./db";

type AnyRow = Record<string, any>;
/** Armazenamento em memória que imita a superfície do Prisma usada por `synchronize`. */
export function memoryStore() {
  const runs: AnyRow[]=[]; const contests: AnyRow[]=[]; const events: AnyRow[]=[];
  let sequence=0;
  const store={
    syncRun:{
      create:async({data}:AnyRow)=>{const row={id:`run-${++sequence}`,startedAt:new Date(),...data};runs.push(row);return row;},
      update:async({where,data}:AnyRow)=>{const row=runs.find(x=>x.id===where.id)!;Object.assign(row,data);return row;},
      findFirst:async({where}:AnyRow)=>runs.filter(x=>x.source===where.source&&x.status===where.status).at(-1)??null
    },
    concurso:{
      findUnique:async({where}:AnyRow)=>{const row=contests.find(x=>x.sourceKey===where.sourceKey);return row?{...row}:null;},
      create:async({data}:AnyRow)=>{const row={id:`contest-${++sequence}`,createdAt:new Date(),updatedAt:new Date(),...data};contests.push(row);return row;},
      update:async({where,data}:AnyRow)=>{const row=contests.find(x=>x.id===where.id)!;Object.assign(row,data,{updatedAt:new Date()});return row;}
    },
    radarEvent:{
      findFirst:async({where}:AnyRow)=>events.find(x=>x.concursoId===where.concursoId&&x.kind===where.kind&&x.createdAt>=where.createdAt.gte)??null,
      create:async({data}:AnyRow)=>{const row={id:`event-${++sequence}`,createdAt:new Date(),...data};events.push(row);return row;}
    },
    rows:()=>contests, runs:()=>runs, events:()=>events
  };
  return store as unknown as typeof db & {rows:()=>AnyRow[];runs:()=>AnyRow[];events:()=>AnyRow[]};
}
