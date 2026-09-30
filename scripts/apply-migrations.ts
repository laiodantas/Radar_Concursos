import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

/**
 * Aplica as migrações do Prisma através do driver HTTPS do Neon, para redes que
 * bloqueiam a porta 5432 (o CLI `prisma migrate deploy` precisa de TCP direto).
 * Cada arquivo SQL simples é dividido em comandos e aplicado em uma única
 * transação HTTP junto do registro de migração. Uma falha reverte o lote.
 * Cada migração aplicada é registrada em `_prisma_migrations` com o checksum do arquivo original.
 */
const MIGRATIONS_DIR = "prisma/migrations";
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

function statements(sqlFile: string): string[] {
  const withoutComments = sqlFile
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const folders = (await readdir(MIGRATIONS_DIR)).filter(name => /^2026\d{4}/.test(name)).sort();

  await sql`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    migration_name TEXT NOT NULL,
    logs TEXT,
    applied_steps_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ
  )`;

  await sql`ALTER TABLE "_prisma_migrations" ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ`;
  const done = await sql`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const applied = new Map(done.map(r => [r.migration_name, r.checksum]));

  for (const folder of folders) {
    const file = path.join(MIGRATIONS_DIR, folder, "migration.sql");
    const content = await readFile(file, "utf8");
    const checksum = createHash("sha256").update(content).digest("hex");
    if (applied.has(folder)) {
      if (applied.get(folder) !== checksum) throw new Error(`Checksum alterado na migração já aplicada: ${folder}`);
      console.log("· já aplicada:", folder); continue;
    }
    const steps = statements(content);
    try {
      await sql.transaction(tx => [
        ...steps.map(step => tx.query(step)),
        tx`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, applied_steps_count, finished_at)
           VALUES (${`manual-${folder}`}, ${checksum}, ${folder}, ${steps.length}, now())`
      ]);
    } catch (error) {
      throw new Error(`migração ${folder} revertida: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
    console.log(`✔ aplicada: ${folder} (${steps.length} comandos)`);
  }

  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("Tabelas públicas:", tables.map(t => t.table_name).join(", "));
  process.exit(0);
}

main().catch(e => { console.error("ERRO:", (e.message || String(e)).slice(0, 300)); process.exit(1); });
