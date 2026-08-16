import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../lib/auth";
export async function POST(req: NextRequest) {
  const { personaId } = await requirePersona(req);
  const { title, description } = await req.json();
  if (!title || title.length > 60 || (description ?? "").length > 100)
    return NextResponse.json({ error: "title<=60 and description<=100 required" }, { status: 400 });
  const [g] = (await db.execute(sql`
    insert into groups (title, description, created_by_persona)
    values (${title}, ${description ?? ""}, ${personaId}) returning id, share_token as "shareToken"`)) as any[];
  await db.execute(sql`insert into group_members (group_id, persona_id) values (${g.id}, ${personaId})`);
  return NextResponse.json(g);
}
