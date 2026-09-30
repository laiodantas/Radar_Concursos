import "dotenv/config";
import { db } from "../src/lib/db";
import { synchronize } from "../src/lib/sync";
synchronize().then(result => { console.log(JSON.stringify(result, null, 2)); }).catch(error => { console.error(`Sincronização falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`); process.exitCode = 1; }).finally(() => db.$disconnect());
