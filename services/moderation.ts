// services/moderation.ts — Claude pre-review of reported UGC, then editor decision.
// Trigger (locked by product decision, env-tunable): (reports >= 3 AND reports/views >= 2%)
// OR reports >= 10 absolute — either path opens an editor-console case.
import { db } from "../lib/db";
import { claudeJSON, MODELS } from "../lib/claude";
import { sql } from "drizzle-orm";

const REPORT_MIN = Number(process.env.REPORT_MIN ?? 3);
const REPORT_RATIO = Number(process.env.REPORT_RATIO ?? 0.02);
const REPORT_ABSOLUTE = Number(process.env.REPORT_ABSOLUTE ?? 10);

const REVIEW_SYSTEM = `You are a content-moderation reviewer for an Indian discussion platform.
You receive a user post and the complaints filed against it. Assess neutrally:
- Does the post plausibly violate: defamation of a named person, incitement/violence, hate speech,
  identification of sexual-offence victims or minors (illegal in India), copied copyrighted text,
  doxxing/personal data, or none of these?
- You are advisory only; a human editor decides.
Return ONLY JSON:
{"summary":"one line on what the post says","complaint_summary":"one line on what reporters allege",
"categories":["..."],"severity":"low|medium|high","recommendation":"takedown|dismiss|editor_judgment",
"reasoning":"2-3 sentences"}`;

export async function fileReport(targetId: string, reason: string | null, reporterPersona: string | null) {
  await db.execute(sql`insert into moderation_reports (target_type, target_id, reason, reporter_persona)
    values ('user_post', ${targetId}, ${reason}, ${reporterPersona})`);

  const [post] = (await db.execute(sql`
    select id, title, body, views, hidden from user_posts where id = ${targetId}`)) as any[];
  if (!post) return { ok: false };

  const [{ n: reports }] = (await db.execute(sql`
    select count(*)::int as n from moderation_reports
    where target_type = 'user_post' and target_id = ${targetId}`)) as any[];

  const views = Math.max(post.views, 1);
  const tripped =
    (reports >= REPORT_MIN && reports / views >= REPORT_RATIO) || reports >= REPORT_ABSOLUTE;
  if (!tripped) return { ok: true, queued: false, reports };

  // idempotent: one open case per post
  const existing = (await db.execute(sql`
    select 1 from moderation_cases where target_id = ${targetId}`)) as any[];
  if (existing.length) return { ok: true, queued: true, reports };

  const complaints = (await db.execute(sql`
    select reason from moderation_reports
    where target_type = 'user_post' and target_id = ${targetId} and reason is not null
    limit 20`)) as any[];

  const assessment = await claudeJSON<object>({
    purpose: "summarize", model: MODELS.summarize,
    system: REVIEW_SYSTEM,
    user: JSON.stringify({
      post: { title: post.title, body: String(post.body).slice(0, 4000) },
      complaints: complaints.map(c => c.reason),
      stats: { reports, views },
    }),
  }).catch(() => ({ summary: "Claude review failed — editor must read directly.",
                    severity: "high", recommendation: "editor_judgment" }));

  await db.execute(sql`
    insert into moderation_cases (target_id, report_count, view_count, claude_assessment)
    values (${targetId}, ${reports}, ${views}, ${JSON.stringify(assessment)}::jsonb)`);
  return { ok: true, queued: true, reports };
}

// Editor actions — takedown is allowed WITHOUT reading further (per spec); dismissal reopens nothing.
export async function resolveCase(caseId: string, action: "taken_down" | "dismissed") {
  const [c] = (await db.execute(sql`select target_id from moderation_cases where id = ${caseId}`)) as any[];
  if (!c) throw new Error("case not found");
  if (action === "taken_down")
    await db.execute(sql`update user_posts set hidden = true where id = ${c.target_id}`);
  await db.execute(sql`update moderation_cases set status = ${action}, resolved_at = now()
    where id = ${caseId}`);
}

export async function openCases() {
  return (await db.execute(sql`
    select mc.id, mc.report_count, mc.view_count, mc.claude_assessment, mc.created_at,
           up.id as post_id, up.title, up.body, p.username
    from moderation_cases mc
    join user_posts up on up.id = mc.target_id
    join personas p on p.id = up.persona_id
    where mc.status = 'awaiting_editor'
    order by mc.created_at asc`)) as any[];
}

// ---------- Government / legal orders (Shreya Singhal-compliant intake) ----------
// Takedown executes immediately ONLY with order particulars on record. Content is hidden,
// never erased: the row is your compliance evidence and the author's appeal record.
export async function govTakedown(input: {
  postId: string; agency: string; orderRef: string; legalBasis: string; editorUserId: string;
}) {
  if (!input.agency?.trim() || !input.orderRef?.trim() || !input.legalBasis?.trim())
    throw new Error("Agency, order reference and legal basis are required — an informal complaint is not an order.");
  await db.execute(sql`insert into legal_orders (post_id, agency, order_ref, legal_basis, actioned_by)
    values (${input.postId}, ${input.agency}, ${input.orderRef}, ${input.legalBasis}, ${input.editorUserId})`);
  await db.execute(sql`update user_posts set hidden = true where id = ${input.postId}`);
  // author notification (in-app): surfaces order ref so the user can pursue grievance/GAC appeal
  await db.execute(sql`insert into author_notices (post_id, kind, detail)
    values (${input.postId}, 'legal_takedown', ${input.orderRef})`);
  return { ok: true };
}

// ---------- Editor delete-any-post (reason mandatory, logged) ----------
export async function editorDelete(postId: string, reason: string, editorUserId: string) {
  if (!reason?.trim()) throw new Error("A one-line reason is required and will be logged.");
  await db.execute(sql`update user_posts set hidden = true where id = ${postId}`);
  await db.execute(sql`insert into editor_actions (post_id, action, reason, editor_id)
    values (${postId}, 'deleted', ${reason}, ${editorUserId})`);
  return { ok: true };
}

// ---------- Unified takedown notice: one reason, logged + emailed, on EVERY path ----------
import { sendTakedownEmail, takedownNotice } from "../lib/email";

async function notifyAuthor(postId: string, source: "report" | "legal" | "editor",
                            reason: string, orderRef?: string, confidential?: boolean) {
  const [row] = (await db.execute(sql`
    select up.title, u.email from user_posts up
    join personas p on p.id = up.persona_id
    join users u on u.id = p.user_id
    where up.id = ${postId}`)) as any[];
  const body = takedownNotice({ postTitle: row?.title ?? null, source, reason, orderRef, confidential });
  const emailed = row?.email
    ? await sendTakedownEmail(row.email, "Your post on Apex was removed", body) : false;
  await db.execute(sql`insert into author_notices (post_id, kind, detail, reason, emailed)
    values (${postId}, ${source + "_takedown"}, ${orderRef ?? null}, ${reason}, ${emailed})`);
}

// Report-case takedown now REQUIRES a reason (breaking change: resolveCase for takedowns → use this)
export async function resolveCaseWithReason(caseId: string, action: "taken_down" | "dismissed", reason?: string) {
  const [c] = (await db.execute(sql`select target_id from moderation_cases where id = ${caseId}`)) as any[];
  if (!c) throw new Error("case not found");
  if (action === "taken_down") {
    if (!reason?.trim()) throw new Error("Reason for takedown is required — it is emailed to the author.");
    await db.execute(sql`update user_posts set hidden = true where id = ${c.target_id}`);
    await db.execute(sql`update moderation_cases set takedown_reason = ${reason} where id = ${caseId}`);
    await notifyAuthor(c.target_id, "report", reason);
  }
  await db.execute(sql`update moderation_cases set status = ${action}, resolved_at = now() where id = ${caseId}`);
}

// Legal-order takedown with reason + confidentiality toggle (S.69A Rule 16)
export async function govTakedownWithReason(input: {
  postId: string; agency: string; orderRef: string; legalBasis: string;
  reason: string; confidential: boolean; editorUserId: string;
}) {
  if (!input.agency?.trim() || !input.orderRef?.trim() || !input.legalBasis?.trim())
    throw new Error("Agency, order reference and legal basis are required — an informal complaint is not an order.");
  if (!input.reason?.trim()) throw new Error("Reason for takedown is required.");
  await db.execute(sql`insert into legal_orders (post_id, agency, order_ref, legal_basis, reason, confidential, actioned_by)
    values (${input.postId}, ${input.agency}, ${input.orderRef}, ${input.legalBasis},
            ${input.reason}, ${input.confidential}, ${input.editorUserId})`);
  await db.execute(sql`update user_posts set hidden = true where id = ${input.postId}`);
  await notifyAuthor(input.postId, "legal", input.reason, input.orderRef, input.confidential);
  return { ok: true };
}

// Editor delete: reason already mandatory — now also emailed
export async function editorDeleteWithNotice(postId: string, reason: string, editorUserId: string) {
  if (!reason?.trim()) throw new Error("Reason for takedown is required — it is emailed to the author.");
  await db.execute(sql`update user_posts set hidden = true where id = ${postId}`);
  await db.execute(sql`insert into editor_actions (post_id, action, reason, editor_id)
    values (${postId}, 'deleted', ${reason}, ${editorUserId})`);
  await notifyAuthor(postId, "editor", reason);
  return { ok: true };
}
