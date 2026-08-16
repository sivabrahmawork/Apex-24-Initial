import { NextRequest, NextResponse } from "next/server";
import { markOpened } from "../../../../../../services/topics/pipeline";
import { requireEditor } from "../../../../../../lib/auth";
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireEditor(req);
  const { id } = await ctx.params;
  await markOpened(id);
  return NextResponse.json({ ok: true });
}
