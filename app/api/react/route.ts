// POST /api/react {targetType, targetId, liked|null} — upsert; null removes the reaction.
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../lib/auth";

export async function POST(req: NextRequest) {
  const { personaId } = await requirePersona(req);
  const { targetType, targetId, liked } = await req.json();
  if (!["content_item", "user_post", "comment"].includes(targetType) || !targetId)
    return NextResponse.json({ error: "invalid target" }, { status: 400 });
  if (liked === null)
    await db.execute(sql`delete from reactions where target_type=${targetType}
      and target_id=${targetId} and persona_id=${personaId}`);
  else
    await db.execute(sql`insert into reactions (target_type, target_id, persona_id, liked)
      values (${targetType}, ${targetId}, ${personaId}, ${liked})
      on conflict (target_type, target_id, persona_id) do update set liked=${liked}`);
  const [t] = (await db.execute(sql`select
      count(*) filter (where liked) ::int as likes,
      count(*) filter (where not liked) ::int as dislikes
    from reactions where target_type=${targetType} and target_id=${targetId}`)) as any[];
  return NextResponse.json(t);
}
