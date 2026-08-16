import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "../../../../../lib/auth";
import { getOrCreateFeedbackSummary } from "../../../../../services/editorial";
export async function POST(req: NextRequest) {
  await requireEditor(req);
  return NextResponse.json(await getOrCreateFeedbackSummary());
}
