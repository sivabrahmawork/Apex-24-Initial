import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../../../lib/auth";
const LABELS = ["question", "assumption", "analysis", "pro", "con", "solution"];
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { personaId } = await requirePersona(req);
  const { id } = await ctx.params;
  const { label } = await req.json();
  if (!LABELS.includes(label)) return NextResponse.json({ error: "invalid label" }, { status: 400 });
  const [c] = (await db.execute(sql`select persona_id from comments where id = ${id}`)) as any[];
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (c.persona_id !== personaId) return NextResponse.json({ ok: true, queued: "editor review" });
  await db.execute(sql`
    insert into comment_classifications (comment_id, label, confidence, model_version, user_corrected, corrected_label)
    values (${id}, ${label}, 1, 'user', true, ${label})
    on conflict (comment_id) do update set corrected_label = ${label}, user_corrected = true`);
  return NextResponse.json({ ok: true });
}
