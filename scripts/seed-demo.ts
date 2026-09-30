import "dotenv/config";
process.env.RADAR_SOURCE = "demo";
import("../src/lib/db").then(async ({db}) => {
  const { synchronize } = await import("../src/lib/sync");
  try { console.log(JSON.stringify(await synchronize(), null, 2)); }
  catch (error) { console.error(error); process.exitCode=1; }
  finally { await db.$disconnect(); }
});
