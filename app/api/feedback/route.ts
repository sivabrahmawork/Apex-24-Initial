import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";
export async function POST(req: NextRequest) {
  const { topic, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  const persona = req.headers.get("x-active-persona");
  await db.execute(sql`insert into user_feedback (persona_id, topic, body)
    values (${persona}, ${topic ?? null}, ${body.slice(0, 4000)})`);
  return NextResponse.json({ ok: true });
}
