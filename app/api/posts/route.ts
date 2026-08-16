import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../lib/auth";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "article";
  const posts = (await db.execute(sql`
    select up.id, up.type, up.title, up.body, up.poll_options as "pollOptions",
      up.created_at as "createdAt", p.username,
      coalesce((select count(*) from comments where target_type='user_post' and target_id=up.id),0)::int as "commentCount",
      case when up.type = 'poll' then
        (select coalesce(json_object_agg(option_index, n), '{}'::json) from
          (select option_index, count(*)::int as n from poll_votes where post_id = up.id group by option_index) v)
      end as tallies
    from user_posts up join personas p on p.id = up.persona_id
    where up.type = ${type} and not up.hidden
    order by up.created_at desc limit 50`)) as any[];
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const { personaId } = await requirePersona(req);
  const { type, title, body, pollOptions } = await req.json();
  if (!["discussion", "article", "tweet", "poll"].includes(type) || !body?.trim())
    return NextResponse.json({ error: "invalid post" }, { status: 400 });
  if (type === "tweet" && body.length > 280)
    return NextResponse.json({ error: "tweets are 280 chars" }, { status: 400 });
  let opts: string[] | null = null;
  if (type === "poll") {
    opts = Array.isArray(pollOptions) ? pollOptions.map((o: any) => String(o).slice(0, 80)).filter(Boolean) : [];
    if (opts.length < 2 || opts.length > 4)
      return NextResponse.json({ error: "polls need 2-4 options" }, { status: 400 });
  }
  const [row] = (await db.execute(sql`
    insert into user_posts (persona_id, type, title, body, poll_options)
    values (${personaId}, ${type}, ${title ?? null}, ${body},
            ${opts ? JSON.stringify(opts) : null}::jsonb)
    returning id`)) as any[];
  return NextResponse.json({ id: row.id });
}
