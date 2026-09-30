import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { synchronize } from "@/lib/sync";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try { return NextResponse.json(await synchronize()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha de sincronização" }, { status: 502 }); }
}
