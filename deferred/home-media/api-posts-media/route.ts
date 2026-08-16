// POST /api/posts/media {caption, urls[]} — screens EVERY image (fail-closed), then creates the post.
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
import { requirePersona } from "../../../../lib/auth";
import { screenImage } from "../../../../services/mediaScreen";

export async function POST(req: NextRequest) {
  const { personaId } = await requirePersona(req);
  const { caption, urls } = await req.json();
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10)
    return NextResponse.json({ error: "1–10 images required" }, { status: 400 });

  const verdicts: string[] = [];
  for (const url of urls) {
    const img = await fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
    if (!img) return NextResponse.json({ error: "image unreachable" }, { status: 422 });
    const b64 = Buffer.from(img).toString("base64");
    const mediaType = url.endsWith(".png") ? "image/png" : url.endsWith(".webp") ? "image/webp" : "image/jpeg";
    const v = await screenImage(b64, mediaType);
    if (!v.pass)
      return NextResponse.json({ error: `Image blocked by safety screen (${v.category}).` }, { status: 422 });
    verdicts.push("pass");
  }

  const [post] = (await db.execute(sql`
    insert into user_posts (persona_id, type, title, body)
    values (${personaId}, 'media', null, ${caption ?? ""}) returning id`)) as any[];
  for (let i = 0; i < urls.length; i++)
    await db.execute(sql`insert into post_media (post_id, url, position, screen_verdict)
      values (${post.id}, ${urls[i]}, ${i}, ${verdicts[i]})`);
  return NextResponse.json({ id: post.id });
}
