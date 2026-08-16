// services/editorial.ts — editor console backend + takedown ops + poll closer + summaries.
// Route handlers in app/api/* are thin wrappers around these functions (auth checked there).
import { db } from "../lib/db";
import {
  contentItems, contentSources, takedownRequests, comments,
  groupSolutions, solutionVotes, threadSummaries, groups,
} from "../lib/schema";
import { verbatimOverlap } from "../lib/overlap";
import { claudeJSON, MODELS } from "../lib/claude";
import { and, eq, sql, count } from "drizzle-orm";

// ---------- Editor: create/publish news card ----------
export async function createNewsItem(editorUserId: string, input: {
  headlineRewritten: string;
  fiveW: { what: string; when: string; where: string; why: string; how: string };
  sources: { publisher: string; author?: string; url: string }[];
  sourceExcerptsForCheck: string[]; // pasted source text, used ONLY for overlap check, never stored
}) {
  if (input.sources.length < 1) throw new Error("At least one source required.");
  const cardText = [input.headlineRewritten, ...Object.values(input.fiveW)].join(" ");
  const wordCount = Object.values(input.fiveW).join(" ").split(/\s+/).length;
  if (wordCount > 100) throw new Error(`5W is ${wordCount} words; cap is 100.`);
  const check = verbatimOverlap(cardText, input.sourceExcerptsForCheck);
  if (check.blocked) throw new Error(`Verbatim overlap with source: "${check.matches[0]}…" — rewrite.`);

  const [item] = await db.insert(contentItems).values({
    type: "news", origin: "editor", status: "draft",
    headlineRewritten: input.headlineRewritten, fiveW: input.fiveW,
    createdByUser: editorUserId,
  }).returning();
  await db.insert(contentSources).values(
    input.sources.map(s => ({ contentItemId: item.id, ...s })),
  );
  return item;
}

export async function publishItem(id: string) {
  return db.update(contentItems)
    .set({ status: "published", publishedAt: new Date() })
    .where(and(eq(contentItems.id, id), eq(contentItems.status, "draft")));
}

// ---------- Takedown (24h SLA) ----------
export async function fileTakedown(input: { contentItemId: string; requesterEmail: string; reason?: string }) {
  return db.insert(takedownRequests).values(input).returning();
}
export async function resolveTakedown(requestId: string, action: "removed" | "rejected") {
  const [req] = await db.select().from(takedownRequests).where(eq(takedownRequests.id, requestId));
  if (!req) throw new Error("Not found");
  if (action === "removed")
    await db.update(contentItems).set({ status: "takedown" }).where(eq(contentItems.id, req.contentItemId));
  return db.update(takedownRequests)
    .set({ status: action, resolvedAt: new Date() }).where(eq(takedownRequests.id, requestId));
}

// ---------- Group poll closer (hourly cron) ----------
// threshold snapshotted at open-poll: eligible<4 → 100, else 75. Approvals only count toward pass.
export async function closeExpiredPolls() {
  const open = await db.select().from(groupSolutions)
    .where(and(eq(groupSolutions.status, "polling"), sql`${groupSolutions.pollClosesAt} <= now()`));
  for (const s of open) {
    const [tally] = await db.select({ approvals: count() }).from(solutionVotes)
      .where(and(eq(solutionVotes.solutionId, s.id), eq(solutionVotes.approve, true)));
    const passed = s.eligibleCount! > 0 &&
      (tally.approvals / s.eligibleCount!) * 100 >= s.thresholdPct!;
    if (!passed) {
      await db.update(groupSolutions).set({ status: "failed" }).where(eq(groupSolutions.id, s.id));
      continue;
    }
    const [g] = await db.select().from(groups).where(eq(groups.id, s.groupId));
    const [item] = await db.insert(contentItems).values({
      type: "essay", origin: "editor", status: "published",
      headlineRewritten: `Group Solution: ${g.title}`,
      excerpt: s.body.slice(0, 300), authorName: g.title, publishedAt: new Date(),
    }).returning(); // renders as distinct "Group Solution" card; open to all-user comments
    await db.update(groupSolutions)
      .set({ status: "published", publishedContentItemId: item.id })
      .where(eq(groupSolutions.id, s.id));
  }
  return open.length;
}

// ---------- AI Summarize (per post, >5 comments, cached, regen at +5) ----------
const SUMMARY_SYSTEMS: Record<string, string> = {
  summary: "Summarize this comment thread's main points neutrally.",
  swot: "Produce a SWOT analysis of the positions in this thread.",
  pros_cons: "Extract the distinct pro arguments and con arguments from this thread.",
  solutions: "List the concrete solutions proposed in this thread.",
  assumptions: "List the unstated or stated assumptions commenters are relying on.",
};

export async function getOrCreateSummary(targetType: "content_item" | "user_post", targetId: string, kind: keyof typeof SUMMARY_SYSTEMS) {
  const [{ n }] = await db.select({ n: count() }).from(comments)
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)));
  if (n <= 5) throw new Error("Summarize unlocks above 5 comments.");

  const [cached] = await db.select().from(threadSummaries).where(and(
    eq(threadSummaries.targetType, targetType),
    eq(threadSummaries.targetId, targetId),
    eq(threadSummaries.kind, kind as any),
  ));
  if (cached && n < cached.commentsAtGeneration + 5) return cached.content;

  const thread = await db.select({ body: comments.body }).from(comments)
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)))
    .limit(200);
  const content = await claudeJSON<object>({
    purpose: "summarize", model: MODELS.summarize,
    system: SUMMARY_SYSTEMS[kind] + ' Return JSON: {"title": string, "points": string[]}. Max 8 points.',
    user: thread.map(t => "- " + t.body.slice(0, 500)).join("\n"),
  });
  await db.insert(threadSummaries)
    .values({ targetType, targetId, kind: kind as any, content, commentsAtGeneration: n })
    .onConflictDoUpdate({
      target: [threadSummaries.targetType, threadSummaries.targetId, threadSummaries.kind],
      set: { content, commentsAtGeneration: n, createdAt: new Date() },
    });
  return content;
}

// ---------- Apex Challenges: researched problem briefs (neutral, sourced, long-form) ----------
export async function createChallenge(editorUserId: string, input: {
  title: string; body: string;
  sources: { publisher: string; author?: string; url: string }[];
  sourceExcerptsForCheck?: string[];
}) {
  if (input.sources.length < 3) throw new Error("Challenges need at least 3 sources — they carry Apex's name.");
  if (input.body.trim().split(/\s+/).length < 200) throw new Error("A Challenge is a researched brief — minimum 200 words.");
  const check = verbatimOverlap(input.title + " " + input.body, input.sourceExcerptsForCheck ?? []);
  if (check.blocked) throw new Error(`Verbatim overlap with source: "${check.matches[0]}…" — rewrite.`);
  const [item] = await db.insert(contentItems).values({
    type: "challenge" as any, origin: "editor", status: "published",
    headlineRewritten: input.title, body: input.body, category: "challenges",
    createdByUser: editorUserId, publishedAt: new Date(),
  } as any).returning();
  await db.insert(contentSources).values(input.sources.map(s => ({ contentItemId: item.id, ...s })));
  return item;
}

// ---------- Feedback synthesis for the editor (cached; regen at +10 new items) ----------
export async function getOrCreateFeedbackSummary() {
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from user_feedback`)) as any[];
  if (n === 0) return { themes: [], actions: ["No feedback yet."] };
  const cached = (await db.execute(sql`
    select content, feedback_count from feedback_summaries order by created_at desc limit 1`)) as any[];
  if (cached.length && n < cached[0].feedback_count + 10) return cached[0].content;

  const rows = (await db.execute(sql`
    select topic, body from user_feedback order by created_at desc limit 300`)) as any[];
  const content = await claudeJSON<object>({
    purpose: "summarize", model: MODELS.summarize,
    system: `You synthesize user feedback for a product editor. Group into themes with rough counts,
quote at most one short example per theme, and list concrete suggested actions.
Return JSON: {"themes":[{"theme":"","count_estimate":0,"example":""}],"actions":["..."]}`,
    user: JSON.stringify(rows),
  });
  await db.execute(sql`insert into feedback_summaries (content, feedback_count)
    values (${JSON.stringify(content)}::jsonb, ${n})`);
  return content;
}
