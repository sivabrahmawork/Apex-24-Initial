"use client";
import { apexFetch } from "../../lib/persona";
// app/admin/reports/page.tsx — Reports screen: article on top, complaint + Claude assessment
// attached right below, Takedown / Dismiss. Takedown needs no further review (per spec).
import { useEffect, useState } from "react";

type Case = {
  id: string; post_id: string; title: string | null; body: string; username: string;
  report_count: number; view_count: number; created_at: string;
  claude_assessment: { summary?: string; complaint_summary?: string; categories?: string[];
                       severity?: string; recommendation?: string; reasoning?: string } | null;
};

export default function ReportsScreen() {
  const [cases, setCases] = useState<Case[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apexFetch("/api/admin/reports").then(r => r.ok ? r.json() : { cases: [] })
      .catch(() => ({ cases: [] })).then(d => setCases(d.cases));
  }, []);

  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function act(id: string, action: "taken_down" | "dismissed") {
    const reason = reasons[id]?.trim();
    if (action === "taken_down" && !reason)
      return setMsg("Reason for takedown is required — it is emailed to the author.");
    const res = await apexFetch(`/api/admin/reports/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }).catch(() => null);
    if (res && !res.ok) { const j = await res.json(); return setMsg(j.error); }
    setCases(cs => cs.filter(c => c.id !== id));
    setMsg(action === "taken_down" ? "Post hidden — reason logged and emailed to the author." : "Report dismissed.");
  }

  const hoursOld = (iso: string) => Math.round((Date.now() - +new Date(iso)) / 36e5);

  return (
    <div className="space-y-4">
      <h1 className="display text-2xl font-bold">Reports</h1>
      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        IT Rules clocks: acknowledge ≤24h, unlawful-content takedown ≤36h of knowledge, resolve ≤15 days.
        Case age is shown on each card.
      </p>
      {msg && <p className="text-sm font-medium">{msg}</p>}
      {cases.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No open cases.</p>}

      {cases.map(c => {
        const a = c.claude_assessment ?? {};
        const sev = a.severity ?? "unknown";
        const sevColor = sev === "high" ? "var(--tag-con)" : sev === "medium" ? "var(--tag-question)" : "var(--ink-soft)";
        return (
          <article key={c.id} className="card p-4">
            <div className="mb-1 flex items-center gap-3 text-xs" style={{ color: "var(--ink-soft)" }}>
              <span className="font-semibold" style={{ color: "var(--ink)" }}>@{c.username}</span>
              <span>{c.report_count} reports / {c.view_count} views</span>
              <span style={{ color: hoursOld(c.created_at) > 24 ? "var(--tag-con)" : undefined }}>
                case age: {hoursOld(c.created_at)}h
              </span>
            </div>
            {c.title && <h2 className="display font-semibold">{c.title}</h2>}
            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">{c.body}</p>

            <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: sevColor }}>
              <p className="text-xs font-bold uppercase" style={{ color: sevColor }}>
                Claude review — severity: {sev} · recommends: {a.recommendation ?? "editor_judgment"}
              </p>
              {a.complaint_summary && <p className="mt-1"><b>Complaint:</b> {a.complaint_summary}</p>}
              {a.summary && <p><b>Post:</b> {a.summary}</p>}
              {a.categories?.length ? <p><b>Flags:</b> {a.categories.join(", ")}</p> : null}
              {a.reasoning && <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>{a.reasoning}</p>}
              <p className="mt-1 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                Advisory only — the decision below is yours and is logged.
              </p>
            </div>

            <input value={reasons[c.id] ?? ""}
                   onChange={e => setReasons(r => ({ ...r, [c.id]: e.target.value }))}
                   placeholder="Reason for takedown (required; emailed to the author)"
                   className="mt-3 w-full rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--line)" }} />
            <div className="mt-2 flex gap-2">
              <button onClick={() => act(c.id, "taken_down")}
                className="rounded-lg px-4 py-1.5 text-sm font-bold text-white" style={{ background: "var(--tag-con)" }}>
                Takedown
              </button>
              <button onClick={() => act(c.id, "dismissed")}
                className="rounded-lg border px-4 py-1.5 text-sm font-semibold"
                style={{ borderColor: "var(--line)" }}>
                Dismiss
              </button>
            </div>
          </article>
        );
      })}

      <AdminActions />
    </div>
  );
}

function AdminActions() {
  const [gov, setGov] = useState({ postId: "", agency: "", orderRef: "", legalBasis: "", reason: "", confidential: false });
  const [del, setDel] = useState({ postId: "", reason: "" });
  const [out, setOut] = useState<string | null>(null);

  async function send(kind: "gov_takedown" | "editor_delete") {
    setOut(null);
    const body = kind === "gov_takedown" ? { kind, ...gov } : { kind, ...del };
    const res = await apexFetch("/api/admin/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = res ? await res.json() : { error: "Backend unreachable." };
    setOut(j.ok ? "Done — post hidden, action logged, author notified." : j.error);
  }

  const inputCls = "rounded border px-2 py-1 text-xs";
  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="display text-sm font-bold">Legal order takedown</h2>
        <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
          Executes immediately, but only with order particulars — an informal complaint is not an order
          (Shreya Singhal). Reason is mandatory and emailed to the author; tick confidential to restrict
          order details in the email (kept in the internal log). Content is hidden, never erased.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["postId", "agency", "orderRef", "legalBasis", "reason"] as const).map(f => (
            <input key={f} placeholder={f} value={(gov as any)[f]}
                   onChange={e => setGov(g => ({ ...g, [f]: e.target.value }))}
                   className={inputCls} style={{ borderColor: "var(--line)" }} />
          ))}
          <label className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={gov.confidential}
                   onChange={e => setGov(g => ({ ...g, confidential: e.target.checked }))}
                   className="h-3.5 w-3.5 accent-[#3d4ec7]" />
            confidential order (S.69A Rule 16 — email omits details)
          </label>
          <button onClick={() => send("gov_takedown")}
                  className="rounded-lg px-3 py-1 text-xs font-bold text-white" style={{ background: "var(--tag-con)" }}>
            Takedown on order
          </button>
        </div>
      </div>
      <div>
        <h2 className="display text-sm font-bold">Delete any post</h2>
        <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
          Available anytime; a one-line reason is mandatory and logged to the audit trail.
        </p>
        <div className="flex flex-wrap gap-2">
          <input placeholder="postId" value={del.postId}
                 onChange={e => setDel(d => ({ ...d, postId: e.target.value }))}
                 className={inputCls} style={{ borderColor: "var(--line)" }} />
          <input placeholder="reason (logged)" value={del.reason}
                 onChange={e => setDel(d => ({ ...d, reason: e.target.value }))}
                 className={inputCls + " min-w-[240px]"} style={{ borderColor: "var(--line)" }} />
          <button onClick={() => send("editor_delete")}
                  className="rounded-lg border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: "var(--tag-con)", color: "var(--tag-con)" }}>
            Delete post
          </button>
        </div>
      </div>
      {out && <p className="text-xs font-medium">{out}</p>}
    </div>
  );
}
