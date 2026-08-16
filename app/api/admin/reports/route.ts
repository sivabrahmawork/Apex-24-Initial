import { NextRequest, NextResponse } from "next/server";
import { openCases } from "../../../../services/moderation";
import { requireEditor } from "../../../../lib/auth";
export async function GET(req: NextRequest) {
  await requireEditor(req);
  return NextResponse.json({ cases: await openCases() });
}
