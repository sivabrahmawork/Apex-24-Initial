import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [post] = (await db.execute(sql`
    select up.id, up.title, up.body, up.created_at as "createdAt", p.username, up.views
    from user_posts up join personas p on p.id = up.persona_id
    where up.id = ${id} and not up.hidden`)) as any[];
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.execute(sql`update user_posts set views = views + 1 where id = ${id}`);
  const comments = (await db.execute(sql`
    select c.id, p.username, p.archetype, c.body, c.parent_id as "parentId", c.created_at as "createdAt",
      coalesce(cc.corrected_label, case when cc.confidence >= 0.55 then cc.label end) as label
    from comments c join personas p on p.id = c.persona_id
    left join comment_classifications cc on cc.comment_id = c.id
    where c.target_type = 'user_post' and c.target_id = ${id}
    order by c.created_at desc limit 200`)) as any[];
  return NextResponse.json({ ...post, comments });
}
