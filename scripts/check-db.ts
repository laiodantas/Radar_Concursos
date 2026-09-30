import "dotenv/config";
const url = process.env.DATABASE_URL ?? "";
console.log("1) DATABASE_URL length:", url.length, "| host:", url.split("@")[1]?.split("/")[0] ?? "(vazio)");

import("@neondatabase/serverless")
  .then(async ({ neon }) => {
    const sql = neon(url);
    const rows = await sql.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
    console.log("2) driver neon() via HTTPS OK — tabelas públicas:", rows[0].n);
    process.exit(0);
  })
  .catch(e => { console.error("ERRO:", (e.message || String(e)).slice(0, 300)); process.exit(1); });
