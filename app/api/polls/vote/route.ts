import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../../lib/auth";
export async function POST(req: NextRequest) {
  const { personaId } = await requirePersona(req);
  const { postId, optionIndex } = await req.json();
  const [p] = (await db.execute(sql`
    select poll_options from user_posts where id = ${postId} and type = 'poll' and not hidden`)) as any[];
  if (!p) return NextResponse.json({ error: "poll not found" }, { status: 404 });
  const n = (p.poll_options ?? []).length;
  if (typeof optionIndex !== "number" || optionIndex < 0 || optionIndex >= n)
    return NextResponse.json({ error: "invalid option" }, { status: 400 });
  await db.execute(sql`insert into poll_votes (post_id, persona_id, option_index)
    values (${postId}, ${personaId}, ${optionIndex})
    on conflict (post_id, persona_id) do update set option_index = ${optionIndex}`);
  const tallies = (await db.execute(sql`
    select option_index, count(*)::int as n from poll_votes where post_id = ${postId}
    group by option_index`)) as any[];
  return NextResponse.json({ tallies });
}
