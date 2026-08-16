"use client";
import { apexFetch } from "../../lib/persona";
// app/admin/feedback/page.tsx — editor view: raw feedback list + Claude theme synthesis.
import { useEffect, useState } from "react";

export default function FeedbackConsole() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apexFetch("/api/admin/feedback").then(r => r.ok ? r.json() : { items: [] })
      .catch(() => ({ items: [] })).then(d => setItems(d.items));
  }, []);

  async function summarize() {
    setBusy(true);
    const r = await apexFetch("/api/admin/feedback/summary", { method: "POST" }).catch(() => null);
    setSummary(r?.ok ? await r.json() : { themes: [], actions: ["Backend unreachable."] });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-bold">User feedback</h1>
        <button onClick={summarize} disabled={busy}
                className="rounded-lg px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}>{busy ? "Synthesizing…" : "💡 Claude summary"}</button>
      </div>
      {summary && (
        <div className="card p-4" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
          {summary.themes?.map((t: any, i: number) => (
            <p key={i} className="text-sm"><b>{t.theme}</b> (~{t.count_estimate}) — <i>{t.example}</i></p>
          ))}
          {summary.actions?.length > 0 && (
            <p className="mt-2 text-sm"><b>Suggested actions:</b> {summary.actions.join(" · ")}</p>
          )}
        </div>
      )}
      <ul className="space-y-2">
        {items.map(f => (
          <li key={f.id} className="card p-3 text-sm">
            <span className="tag mr-2" style={{ color: "var(--accent)" }}>{f.topic ?? "other"}</span>
            {f.body}
            <span className="block text-xs" style={{ color: "var(--ink-soft)" }}>
              {new Date(f.created_at).toLocaleString()}
            </span>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No feedback yet.</p>}
      </ul>
    </div>
  );
}
