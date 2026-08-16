import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../lib/auth";
export async function POST(req: NextRequest) {
  const { personaId } = await requirePersona(req);
  const { targetType, targetId, parentId, body } = await req.json();
  if (!["content_item", "user_post", "group"].includes(targetType) || !targetId || !body?.trim())
    return NextResponse.json({ error: "invalid comment" }, { status: 400 });
  const [row] = (await db.execute(sql`
    insert into comments (persona_id, target_type, target_id, parent_id, body)
    values (${personaId}, ${targetType}, ${targetId}, ${parentId ?? null}, ${body})
    returning id, created_at as "createdAt"`)) as any[];
  await db.execute(sql`insert into classification_queue (comment_id) values (${row.id}) on conflict do nothing`);
  const [p] = (await db.execute(sql`select username, archetype from personas where id = ${personaId}`)) as any[];
  return NextResponse.json({ id: row.id, username: p.username, archetype: p.archetype,
    body, createdAt: row.createdAt, label: null });
}
