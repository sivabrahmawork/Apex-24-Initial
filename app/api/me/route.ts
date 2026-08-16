// GET /api/me — session identity + editor flag (drives editor-only UI affordances).
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const [row] = (await db.execute(sql`select is_editor from users where id = ${user.id}`)) as any[];
    return NextResponse.json({ id: user.id, email: user.email, isEditor: !!row?.is_editor });
  } catch {
    return NextResponse.json({ isEditor: false }, { status: 200 });
  }
}
