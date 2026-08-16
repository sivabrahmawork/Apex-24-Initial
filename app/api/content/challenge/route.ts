import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "../../../../lib/auth";
import { createChallenge } from "../../../../services/editorial";
export async function POST(req: NextRequest) {
  const editor = await requireEditor(req);
  try {
    const b = await req.json();
    const item = await createChallenge(editor.id, b);
    return NextResponse.json({ id: item.id });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 422 }); }
}
