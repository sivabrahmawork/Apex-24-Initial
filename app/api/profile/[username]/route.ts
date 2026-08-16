import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const [p] = (await db.execute(sql`select id, archetype from personas where username = ${username}`)) as any[];
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [b] = (await db.execute(sql`
    select
      count(*) filter (where coalesce(cc.corrected_label, cc.label) = 'question')::int as questions,
      count(*) filter (where coalesce(cc.corrected_label, cc.label) = 'solution')::int as solutions,
      count(*) filter (where coalesce(cc.corrected_label, cc.label) in ('analysis','pro','con'))::int as analyses
    from comments c join comment_classifications cc on cc.comment_id = c.id
    where c.persona_id = ${p.id}`)) as any[];
  const [g] = (await db.execute(sql`
    select count(*)::int as n from group_solutions gs
    join group_members gm on gm.group_id = gs.group_id
    where gm.persona_id = ${p.id} and gs.status = 'published'`)) as any[];
  const [f] = (await db.execute(sql`
    select count(*)::int as n from follows where followed_persona_id = ${p.id}`)) as any[];
  return NextResponse.json({ ...b, publishedSolutions: g.n, followers: f.n, archetype: p.archetype });
}
