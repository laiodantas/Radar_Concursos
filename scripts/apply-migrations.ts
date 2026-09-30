import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

/**
 * Aplica as migrações do Prisma através do driver HTTPS do Neon, para redes que
 * bloqueiam a porta 5432 (o CLI `prisma migrate deploy` precisa de TCP direto).
 * O driver HTTP do Neon executa um comando por chamada, então cada arquivo é
 * dividido em comandos (removendo comentários de linha). Cada migração aplicada
 * é registrada em `_prisma_migrations` com o checksum do arquivo original.
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
    finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  const done = await sql`SELECT migration_name FROM "_prisma_migrations"`;
  const applied = new Set(done.map(r => r.migration_name));

  for (const folder of folders) {
    if (applied.has(folder)) { console.log("· já aplicada:", folder); continue; }
    const file = path.join(MIGRATIONS_DIR, folder, "migration.sql");
    const content = await readFile(file, "utf8");
    const checksum = createHash("sha256").update(content).digest("hex");
    const steps = statements(content);
    for (let i = 0; i < steps.length; i++) {
      try { await sql.query(steps[i]); }
      catch (e) { throw new Error(`migração ${folder}, comando ${i + 1}/${steps.length}: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`); }
    }
    await sql`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, applied_steps_count, finished_at)
              VALUES (${`manual-${folder}`}, ${checksum}, ${folder}, ${steps.length}, now())`;
    console.log(`✔ aplicada: ${folder} (${steps.length} comandos)`);
  }

  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("Tabelas públicas:", tables.map(t => t.table_name).join(", "));
  process.exit(0);
}

main().catch(e => { console.error("ERRO:", (e.message || String(e)).slice(0, 300)); process.exit(1); });
