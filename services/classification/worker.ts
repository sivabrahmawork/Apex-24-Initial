// services/classification/worker.ts — drains classification_queue in batches.
// Post-hoc labeling per product decision: users never pick a type; we infer it.
import { db } from "../../lib/db";
import { classificationQueue, comments, commentClassifications } from "../../lib/schema";
import { claudeJSON, MODELS } from "../../lib/claude";
import { eq, inArray } from "drizzle-orm";

const CONFIDENCE_FLOOR = 0.55; // below → stored but no visible tag (untagged beats wrong-tagged)
const BATCH = 20;
const MODEL_VERSION = `${MODELS.classify}/v1`;

const SYSTEM = `You label comments from a news-discussion platform with exactly one label:
- question: asks for information or challenges with an interrogative
- assumption: states an unverified premise or hypothesis
- analysis: reasons about causes, evidence, comparisons (incl. SWOT-style reasoning)
- pro: argues in favor of the subject/proposal
- con: argues against the subject/proposal
- solution: proposes a concrete action or fix
Return JSON: {"results":[{"id":"<comment id>","label":"<one label>","confidence":<0..1>}]}
Confidence reflects how clearly the comment fits ONE label. Mixed/ambiguous → lower confidence.`;

export async function runClassificationBatch(): Promise<number> {
  const pending = await db.select().from(classificationQueue)
    .where(eq(classificationQueue.status, "pending")).limit(BATCH);
  if (pending.length === 0) return 0;

  const ids = pending.map(p => p.commentId);
  await db.update(classificationQueue).set({ status: "processing", updatedAt: new Date() })
    .where(inArray(classificationQueue.commentId, ids));

  const rows = await db.select({ id: comments.id, body: comments.body })
    .from(comments).where(inArray(comments.id, ids));

  try {
    const out = await claudeJSON<{ results: { id: string; label: string; confidence: number }[] }>({
      purpose: "classify",
      model: MODELS.classify,
      system: SYSTEM,
      user: JSON.stringify(rows.map(r => ({ id: r.id, text: r.body.slice(0, 1500) }))),
    });
    const valid = new Set(["question", "assumption", "analysis", "pro", "con", "solution"]);
    for (const r of out.results) {
      if (!valid.has(r.label)) continue;
      await db.insert(commentClassifications).values({
        commentId: r.id, label: r.label as any,
        confidence: Math.max(0, Math.min(1, r.confidence)),
        modelVersion: MODEL_VERSION,
      }).onConflictDoNothing();
      await db.update(classificationQueue).set({ status: "done" })
        .where(eq(classificationQueue.commentId, r.id));
    }
    return out.results.length;
  } catch (e) {
    // failed batch → retry up to 3 attempts, then park as failed
    for (const p of pending) {
      const attempts = p.attempts + 1;
      await db.update(classificationQueue)
        .set({ status: attempts >= 3 ? "failed" : "pending", attempts, updatedAt: new Date() })
        .where(eq(classificationQueue.commentId, p.commentId));
    }
    throw e;
  }
}

// Effective label helper used by feed queries and badge math:
// effective = corrected_label ?? (confidence >= CONFIDENCE_FLOOR ? label : null)
export { CONFIDENCE_FLOOR };
