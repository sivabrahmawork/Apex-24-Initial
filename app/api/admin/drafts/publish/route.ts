import { NextRequest, NextResponse } from "next/server";
import { publishDrafts } from "../../../../../services/topics/pipeline";
import { requireEditor } from "../../../../../lib/auth";
export async function POST(req: NextRequest) {
  const editor = await requireEditor(req);
  const { ids } = await req.json();
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "no drafts selected" }, { status: 400 });
  return NextResponse.json({ results: await publishDrafts(ids, editor.id) });
}
