import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
import { requireEditor } from "../../../../lib/auth";
export async function GET(req: NextRequest) {
  await requireEditor(req);
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const rows = (await db.execute(sql`
    select id, category, headline_rewritten as "headlineRewritten", five_w as "fiveW",
           sources, status, opened_at as "openedAt"
    from daily_drafts where draft_date = ${date} order by category, created_at`)) as any[];
  return NextResponse.json({ drafts: rows });
}
