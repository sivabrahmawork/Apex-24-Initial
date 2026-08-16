// POST /api/admin/actions — editor-only: {kind: "gov_takedown", postId, agency, orderRef, legalBasis}
//                                     or {kind: "editor_delete", postId, reason}
import { NextRequest, NextResponse } from "next/server";
import { govTakedownWithReason, editorDeleteWithNotice } from "../../../../services/moderation";
import { requireEditor } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const editor = await requireEditor(req);
  const b = await req.json();
  try {
    if (b.kind === "gov_takedown")
      return NextResponse.json(await govTakedownWithReason({ ...b, confidential: !!b.confidential, editorUserId: editor.id }));
    if (b.kind === "editor_delete")
      return NextResponse.json(await editorDeleteWithNotice(b.postId, b.reason, editor.id));
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
}
