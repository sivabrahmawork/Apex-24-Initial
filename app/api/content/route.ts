import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
export async function GET(req: NextRequest) {
  const rows = (await db.execute(sql`
    select ci.id, ci.type, ci.category, ci.headline_rewritten as "headlineRewritten",
      ci.five_w as "fiveW", ci.body, ci.excerpt, ci.author_name as "authorName",
      coalesce(s.sources, '[]'::json) as sources,
      coalesce(cc.n, 0)::int as "commentCount",
      coalesce(rl.n, 0)::int as likes, coalesce(rd.n, 0)::int as dislikes,
      (ci.author_name is not null and ci.type = 'essay') as "isGroupSolution"
    from content_items ci
    left join lateral (select json_agg(json_build_object('publisher', publisher, 'author', author, 'url', url)) as sources
      from content_sources where content_item_id = ci.id) s on true
    left join lateral (select count(*) as n from comments where target_type = 'content_item' and target_id = ci.id) cc on true
    left join lateral (select count(*) as n from reactions where target_type = 'content_item' and target_id = ci.id and liked) rl on true
    left join lateral (select count(*) as n from reactions where target_type = 'content_item' and target_id = ci.id and not liked) rd on true
    where ci.status = 'published'
    order by ci.published_at desc nulls last limit 50`)) as any[];
  return NextResponse.json({ items: rows });
}
