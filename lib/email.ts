// lib/email.ts — transactional email via Resend (env RESEND_API_KEY, EMAIL_FROM).
// Single purpose here: takedown notices to post authors (IT Rules user-notification hygiene).
export async function sendTakedownEmail(to: string, subject: string, bodyText: string) {
  if (!process.env.RESEND_API_KEY) { console.warn("RESEND_API_KEY unset — notice logged only"); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "notices@apex.app", to, subject, text: bodyText }),
  }).catch(() => null);
  return !!r?.ok;
}

export function takedownNotice(opts: {
  postTitle: string | null; source: "report" | "legal" | "editor";
  reason: string; orderRef?: string; confidential?: boolean;
}) {
  const what = opts.postTitle ? `your post "${opts.postTitle}"` : "your post";
  if (opts.source === "legal" && opts.confidential)
    return `Apex has removed ${what} pursuant to a legal direction from a competent authority. ` +
           `The details of the direction are restricted by law, so we are unable to share them. ` +
           `You may raise a grievance via grievance@apex.app; appellate options (GAC) are available under the IT Rules.`;
  const head = opts.source === "legal"
    ? `Apex has removed ${what} in compliance with a legal order (ref: ${opts.orderRef ?? "on file"}).`
    : `Apex has removed ${what} following ${opts.source === "report" ? "community reports and review" : "editorial review"}.`;
  return `${head}\n\nReason for takedown: ${opts.reason}\n\n` +
         `If you believe this was in error, reply to this email or write to grievance@apex.app. ` +
         `Your content is retained in hidden state pending any appeal.`;
}
