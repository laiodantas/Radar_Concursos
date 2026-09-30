import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Quando a porta 5432 é bloqueada pela rede (comum em redes corporativas), o Neon aceita
// tráfego por WebSocket/HTTPS na 443 — é o caminho usado aqui. O `PrismaNeon` recebe o
// PoolConfig (connectionString) e cria o Pool WebSocket contra o pooler do Neon.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (url?.includes("neon.tech")) {
    const adapter = new PrismaNeon({ connectionString: url });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
