"use client";
// app/admin/challenge/page.tsx — composer for Apex Challenges: neutral, sourced problem briefs.
import { apexFetch } from "../../lib/persona";
import { useState } from "react";

export default function ChallengeComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sources, setSources] = useState([{ publisher: "", author: "", url: "" }]);
  const [msg, setMsg] = useState<string | null>(null);
  const words = body.trim().split(/\s+/).filter(Boolean).length;

  async function publish() {
    setMsg(null);
    const res = await apexFetch("/api/content/challenge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, sources: sources.filter(s => s.url) }),
    }).catch(() => null);
    if (!res) return setMsg("Backend unreachable.");
    const j = await res.json();
    setMsg(res.ok ? "Challenge published to Home." : j.error);
  }

  return (
    <div className="space-y-3">
      <h1 className="display text-2xl font-bold">New Apex Challenge</h1>
      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        A Challenge is a researched, NEUTRAL problem brief that groups can pick up and solve —
        facts and evidence only, no opinion, no advocacy, every claim traceable to a source below.
        Verify every named person/company as you would a crime draft; Apex owns every sentence here.
      </p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Problem title"
             className="w-full rounded border px-3 py-2 text-lg font-semibold" style={{ borderColor: "var(--line)" }} />
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
                placeholder="The problem, its scale, who it affects, what's been tried — with evidence. Min 200 words."
                className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
      <p className="text-xs" style={{ color: words < 200 ? "var(--tag-con)" : "var(--ink-soft)" }}>{words} words (min 200)</p>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>Sources (min 3)</legend>
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
      <div className="flex items-center gap-3">
        <button onClick={publish} className="rounded-lg px-5 py-2 text-sm font-bold text-white"
                style={{ background: "var(--accent)" }}>Publish Challenge</button>
        {msg && <span className="text-sm font-medium">{msg}</span>}
      </div>
    </div>
  );
}
