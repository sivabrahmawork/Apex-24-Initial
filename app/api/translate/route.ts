// POST /api/translate {commentId, target} — cached en<->hi comment translation (Haiku).
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
import { claudeJSON, MODELS } from "../../../lib/claude";
export async function POST(req: NextRequest) {
  const { commentId, target } = await req.json();
  if (!commentId || !["en", "hi"].includes(target))
    return NextResponse.json({ error: "commentId and target en|hi required" }, { status: 400 });
  const [cached] = (await db.execute(sql`
    select body from comment_translations where comment_id = ${commentId} and lang = ${target}`)) as any[];
  if (cached) return NextResponse.json({ body: cached.body, cached: true });
  const [c] = (await db.execute(sql`select body from comments where id = ${commentId}`)) as any[];
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const out = await claudeJSON<{ translation: string }>({
    purpose: "summarize", model: MODELS.classify,
    system: `Translate the user's comment to ${target === "hi" ? "Hindi (Devanagari)" : "English"}.
Preserve tone and meaning exactly; do not add or remove content. Return JSON: {"translation":"..."}`,
    user: c.body.slice(0, 2000),
  });
  await db.execute(sql`insert into comment_translations (comment_id, lang, body)
    values (${commentId}, ${target}, ${out.translation}) on conflict do nothing`);
  return NextResponse.json({ body: out.translation, cached: false });
}
