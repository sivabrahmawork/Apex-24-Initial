import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
import { requireEditor } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  await requireEditor(req);
  const items = (await db.execute(sql`
    select id, topic, body, created_at from user_feedback order by created_at desc limit 200`)) as any[];
  return NextResponse.json({ items });
}

