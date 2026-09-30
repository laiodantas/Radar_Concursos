import { NextResponse } from "next/server";
import { getRadarData } from "@/lib/radar-data";
export const dynamic = "force-dynamic";
export async function GET() { try { return NextResponse.json(await getRadarData()); } catch { return NextResponse.json({ error: "Banco indisponível" }, { status: 503 }); } }
