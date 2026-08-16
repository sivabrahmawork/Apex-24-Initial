// app/api/report/route.ts — files a report (with complaint text) and runs the threshold →
// Claude review → editor-console case pipeline in services/moderation.ts.
import { NextRequest, NextResponse } from "next/server";
import { fileReport } from "../../../services/moderation";

export async function POST(req: NextRequest) {
  let targetId: string | null = null, reason: string | null = null, persona: string | null = null;
  const form = await req.formData().catch(() => null);
  if (form) {
    targetId = String(form.get("targetId") ?? "");
    reason = form.get("reason") ? String(form.get("reason")) : null;
  } else {
    const body = await req.json().catch(() => ({}));
    targetId = body.targetId; reason = body.reason ?? null;
  }
  persona = req.headers.get("x-active-persona");
  if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
  const out = await fileReport(targetId, reason, persona);
  return NextResponse.json(out);
}
