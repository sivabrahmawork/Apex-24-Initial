// services/topics/pipeline.ts — daily cron (~06:00 IST via Vercel cron / Supabase edge).
// Claude + web_search drafts ~20 cards/day across 6 categories (Indian politics excluded by prompt AND gate).
// Editor console: view-locked checkboxes → Submit publishes. Drafts retained per day, forever.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../../lib/db";
import { dailyDrafts } from "../../lib/drafts-schema";
import { sql } from "drizzle-orm";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const CATEGORIES: { key: string; label: string; n: number }[] = [
  { key: "india", label: "India NON-POLITICAL news: policy outcomes as facts, courts, infrastructure, economy on the ground, disasters, culture. STRICTLY EXCLUDE parties, elections, politicians' statements or feuds", n: 3 },
  { key: "world", label: "World/Global news (geopolitics, international economy; EXCLUDE Indian domestic politics entirely)", n: 3 },
  { key: "business", label: "Business & Economy (companies, markets, macro data; India and global)", n: 2 },
  { key: "tech", label: "Technology", n: 2 },
  { key: "science", label: "Science", n: 2 },
  { key: "sports", label: "Sports", n: 2 },
  { key: "health", label: "Health", n: 2 },
  { key: "entertainment", label: "Entertainment (avoid unverified celebrity claims)", n: 1 },
  { key: "environment", label: "Environment & Climate", n: 1 },
  { key: "lifestyle", label: "Lifestyle (food, travel, culture, trends; no unverified claims about named people)", n: 1 },
  { key: "education", label: "Education (exams, admissions, institutions, edtech; policy outcomes as facts, EXCLUDE party politics)", n: 1 },
  // Total = 20/day. "crime" remains request-only via requestDraft(), never auto-generated.
];

const SYSTEM = `You draft neutral news cards for an Indian discussion platform.
Rules (legal-compliance, non-negotiable):
- Use web search. Every story MUST be corroborated by at least 3 distinct publishers; include their URLs.
- Write ONLY facts, entirely in your own words. Never quote or closely paraphrase any source sentence.
- Rewrite the headline; never reuse any publisher's headline.
- 5W total must be under 100 words. If a fact (esp. a person's name/role) is uncertain, write "unconfirmed".
- Exclude Indian domestic politics, elections, parties and politicians completely.
Return ONLY JSON:
{"cards":[{"headline":"","fiveW":{"what":"","when":"","where":"","why":"","how":""},
"sources":[{"publisher":"","url":""}]}]}`;

export async function runDailyPipeline(forDate = new Date().toISOString().slice(0, 10)) {
  const existing = (await db.execute(
    sql`select 1 from daily_drafts where draft_date = ${forDate} limit 1`)) as any[];
  if (existing.length) return { skipped: true }; // idempotent per day

  let created = 0;
  for (const cat of CATEGORIES) {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      messages: [{
        role: "user",
        content: `Find the ${cat.n} most significant ${cat.label} stories of the last 24 hours and draft cards.`,
      }],
    });
    const text = res.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    let parsed: any;
    try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { continue; }

    for (const c of parsed.cards ?? []) {
      const words = Object.values(c.fiveW ?? {}).join(" ").split(/\s+/).filter(Boolean).length;
      if (!c.headline || words > 100 || (c.sources ?? []).length < 3) continue; // hard gates
      await db.insert(dailyDrafts).values({
        draftDate: forDate, category: cat.key as any,
        headlineRewritten: c.headline, fiveW: c.fiveW, sources: c.sources,
      });
      created++;
    }
    await db.execute(sql`insert into ai_calls (purpose, model, in_tokens, out_tokens, ms)
      values ('draft_pipeline', 'claude-sonnet-4-6', ${res.usage.input_tokens}, ${res.usage.output_tokens}, 0)`);
  }
  return { created };
}

// Console "Submit": publish ticked drafts → content_items. Refuses unreviewed drafts.
export async function publishDrafts(draftIds: string[], editorUserId: string) {
  const results: { id: string; ok: boolean; reason?: string }[] = [];
  for (const id of draftIds) {
    const [d] = (await db.execute(sql`select * from daily_drafts where id = ${id}`)) as any[];
    if (!d) { results.push({ id, ok: false, reason: "not found" }); continue; }
    if (!d.opened_at) { results.push({ id, ok: false, reason: "not reviewed — open the draft first" }); continue; }
    if (d.status !== "pending") { results.push({ id, ok: false, reason: `already ${d.status}` }); continue; }

    const [item] = (await db.execute(sql`
      insert into content_items (type, origin, status, headline_rewritten, five_w, category, created_by_user, published_at)
      values ('news', 'editor', 'published', ${d.headline_rewritten}, ${JSON.stringify(d.five_w)}::jsonb,
              ${d.category}, ${editorUserId}, now())
      returning id`)) as any[];
    for (const s of d.sources)
      await db.execute(sql`insert into content_sources (content_item_id, publisher, url)
        values (${item.id}, ${s.publisher}, ${s.url})`);
    await db.execute(sql`update daily_drafts set status = 'published',
      published_content_item_id = ${item.id} where id = ${id}`);
    results.push({ id, ok: true });
  }
  return results;
}

export async function markOpened(draftId: string) {
  await db.execute(sql`update daily_drafts set opened_at = coalesce(opened_at, now()) where id = ${draftId}`);
}

// ---------- On-demand draft: editor types a topic, Claude web-searches and drafts, review gate unchanged ----------
const CRIME_RULES = `
ADDITIONAL RULES FOR CRIME STORIES (non-negotiable):
- NEVER name a suspect or accused person who has not been convicted. Write "a suspect" / "the accused".
- Attribute every allegation to its source: "police said", "according to the chargesheet", "the court recorded".
- No details identifying victims of sexual offences or minors (illegal to publish in India).`;

const REQUEST_GUARD = `
If the requested topic concerns Indian domestic politics, elections, parties or politicians,
do NOT draft. Return ONLY: {"refused": "<one-line reason>"}.`;

export async function requestDraft(topic: string, category: string, forDate = new Date().toISOString().slice(0, 10)) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM + REQUEST_GUARD + (category === "crime" ? CRIME_RULES : ""),
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{
      role: "user",
      content: `Editor request — research this and draft ONE card (category: ${category}): ${topic}`,
    }],
  });
  const text = res.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
  await db.execute(sql`insert into ai_calls (purpose, model, in_tokens, out_tokens, ms)
    values ('draft_request', 'claude-sonnet-4-6', ${res.usage.input_tokens}, ${res.usage.output_tokens}, 0)`);

  let parsed: any;
  try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch {
    return { ok: false, reason: "Draft failed to parse — try rephrasing the topic." };
  }
  if (parsed.refused) return { ok: false, reason: `Refused: ${parsed.refused}` };

  const c = (parsed.cards ?? [])[0];
  if (!c) return { ok: false, reason: "No card returned." };
  const words = Object.values(c.fiveW ?? {}).join(" ").split(/\s+/).filter(Boolean).length;
  if (words > 100) return { ok: false, reason: `5W is ${words} words (cap 100).` };
  if ((c.sources ?? []).length < 3) return { ok: false, reason: "Fewer than 3 corroborating sources found — not publishable." };

  const [row] = (await db.execute(sql`
    insert into daily_drafts (draft_date, category, headline_rewritten, five_w, sources, requested_topic)
    values (${forDate}, ${category}, ${c.headline}, ${JSON.stringify(c.fiveW)}::jsonb,
            ${JSON.stringify(c.sources)}::jsonb, ${topic})
    returning id`)) as any[];
  return { ok: true, draftId: row.id };
}
