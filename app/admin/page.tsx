"use client";
// app/admin/page.tsx — editor console: the content factory (manual-editorial assumption hard-coded).
// Draft with Claude outside or inside; every card passes the 100-word cap + verbatim-overlap guard server-side.
import { apexFetch } from "../lib/persona";
import { useState } from "react";

const W = ["what", "when", "where", "why", "how"] as const;

export default function EditorConsole() {
  const [headline, setHeadline] = useState("");
  const [fiveW, setFiveW] = useState<Record<string, string>>({});
  const [sources, setSources] = useState([{ publisher: "", author: "", url: "" }]);
  const [checkText, setCheckText] = useState(""); // pasted source text — used for overlap check, never stored
  const [msg, setMsg] = useState<string | null>(null);

  const words = W.map(k => fiveW[k] ?? "").join(" ").trim().split(/\s+/).filter(Boolean).length;

  async function save(publish: boolean) {
    setMsg(null);
    const res = await apexFetch("/api/content", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headlineRewritten: headline, fiveW,
        sources: sources.filter(s => s.url),
        sourceExcerptsForCheck: checkText ? [checkText] : [],
        publish,
      }),
    }).catch(() => null);
    if (!res) return setMsg("Backend unreachable — configure keys (see README).");
    const body = await res.json();
    setMsg(res.ok ? (publish ? "Published." : "Saved as draft.") : `Blocked: ${body.error}`);
  }

  return (
    <div className="space-y-5">
      <h1 className="display text-2xl font-bold">Editor console</h1>

      <div className="card space-y-3 p-4">
        <input value={headline} onChange={e => setHeadline(e.target.value)}
               placeholder="Rewritten headline (never copy the publisher's)"
               className="w-full border-b bg-transparent pb-1 text-lg font-semibold outline-none"
               style={{ borderColor: "var(--line)" }} />
        {W.map(k => (
          <label key={k} className="block text-sm">
            <span className="text-xs font-bold uppercase" style={{ color: "var(--accent)" }}>{k}</span>
            <input value={fiveW[k] ?? ""} onChange={e => setFiveW(f => ({ ...f, [k]: e.target.value }))}
                   className="mt-0.5 w-full rounded border px-2 py-1" style={{ borderColor: "var(--line)" }} />
          </label>
        ))}
        <p className="text-xs" style={{ color: words > 100 ? "var(--tag-con)" : "var(--ink-soft)" }}>
          {words}/100 words {words > 100 && "— over cap, will be rejected"}
        </p>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>
            Sources (min 1; aim for 3+ per policy)
          </legend>
          {sources.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              {(["publisher", "author", "url"] as const).map(f => (
                <input key={f} value={s[f]} placeholder={f}
                  onChange={e => setSources(ss => ss.map((x, j) => j === i ? { ...x, [f]: e.target.value } : x))}
                  className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
              ))}
            </div>
          ))}
          <button onClick={() => setSources(s => [...s, { publisher: "", author: "", url: "" }])}
                  className="text-xs font-semibold" style={{ color: "var(--accent)" }}>+ add source</button>
        </fieldset>

        <label className="block text-sm">
          <span className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>
            Paste source text for verbatim check (not stored)
          </span>
          <textarea value={checkText} onChange={e => setCheckText(e.target.value)} rows={3}
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
        </label>

        <div className="flex gap-2">
          <button onClick={() => save(false)} className="rounded-lg border px-4 py-1.5 text-sm font-semibold"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>Save draft</button>
          <button onClick={() => save(true)} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}>Publish</button>
        </div>
        {msg && <p className="text-sm font-medium">{msg}</p>}
      </div>

      <TakedownQueue />
    </div>
  );
}

function TakedownQueue() {
  // Lists open takedown requests; Remove pulls the item within the 24h SLA. Wire: GET /api/admin/takedowns
  return (
    <div className="card p-4">
      <h2 className="display mb-2 font-semibold">Takedown queue (24h SLA)</h2>
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        No open requests. Requests filed at /api/takedown appear here with Remove / Reject actions.
      </p>
    </div>
  );
}
