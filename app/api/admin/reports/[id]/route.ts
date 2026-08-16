import { NextRequest, NextResponse } from "next/server";
import { resolveCaseWithReason } from "../../../../../services/moderation";
import { requireEditor } from "../../../../../lib/auth";
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireEditor(req);
  const { id } = await ctx.params;
  const { action, reason } = await req.json();
  if (!["taken_down", "dismissed"].includes(action)) return NextResponse.json({ error: "invalid action" }, { status: 400 });
  try { await resolveCaseWithReason(id, action, reason); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 422 }); }
}
