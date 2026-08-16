import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [item] = (await db.execute(sql`
    select ci.id, ci.type, ci.category, ci.headline_rewritten as "headlineRewritten",
      ci.five_w as "fiveW", ci.body,
      coalesce((select json_agg(json_build_object('publisher', publisher, 'url', url))
        from content_sources where content_item_id = ci.id), '[]'::json) as sources
    from content_items ci where ci.id = ${id} and ci.status = 'published'`)) as any[];
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  const comments = (await db.execute(sql`
    select c.id, p.username, p.archetype, c.body, c.parent_id as "parentId",
      c.created_at as "createdAt",
      coalesce(cc.corrected_label, case when cc.confidence >= 0.55 then cc.label end) as label,
      cc.user_corrected as "userCorrected"
    from comments c join personas p on p.id = c.persona_id
    left join comment_classifications cc on cc.comment_id = c.id
    where c.target_type = 'content_item' and c.target_id = ${id}
    order by c.created_at desc limit 200`)) as any[];
  return NextResponse.json({ ...item, comments });
}
