import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSummary } from "../../../services/editorial";
export async function POST(req: NextRequest) {
  const { targetType, targetId, kind } = await req.json();
  try { return NextResponse.json(await getOrCreateSummary(targetType, targetId, kind)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 403 }); }
}
