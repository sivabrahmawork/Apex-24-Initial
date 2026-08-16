import { NextRequest, NextResponse } from "next/server";
import { requestDraft } from "../../../../../services/topics/pipeline";
import { requireEditor } from "../../../../../lib/auth";
const ALLOWED = ["india","world","business","tech","science","health","sports","entertainment","environment","lifestyle","education","crime"];
export async function POST(req: NextRequest) {
  await requireEditor(req);
  const { topic, category } = await req.json();
  if (!topic?.trim() || !ALLOWED.includes(category))
    return NextResponse.json({ ok: false, reason: "topic and valid category required" }, { status: 400 });
  const out = await requestDraft(topic.trim(), category);
  return NextResponse.json(out, { status: out.ok ? 200 : 422 });
}
