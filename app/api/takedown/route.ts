import { NextRequest, NextResponse } from "next/server";
import { fileTakedown } from "../../../services/editorial";
export async function POST(req: NextRequest) {
  const { contentItemId, requesterEmail, reason } = await req.json();
  if (!contentItemId || !requesterEmail) return NextResponse.json({ error: "contentItemId and requesterEmail required" }, { status: 400 });
  await fileTakedown({ contentItemId, requesterEmail, reason });
  return NextResponse.json({ ok: true, sla: "reviewed within 24h" });
}
