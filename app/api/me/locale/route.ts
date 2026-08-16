import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
export async function PATCH(req: NextRequest) {
  const user = await requireUser(req);
  const { locale } = await req.json();
  if (!["en", "hi"].includes(locale)) return NextResponse.json({ error: "en|hi" }, { status: 400 });
  await db.execute(sql`update users set locale = ${locale} where id = ${user.id}`);
  return NextResponse.json({ ok: true });
}
