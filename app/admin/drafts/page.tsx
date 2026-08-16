"use client";
import { apexFetch } from "../../lib/persona";
// app/admin/drafts/page.tsx — Daily drafts console.
// Flow: pipeline fills the day's batch → editor opens drafts (checkbox unlocks on open) →
// ticks → Submit publishes to the News feed. Batches are retained per date (history dropdown).
import { useEffect, useState } from "react";
import { FiveWLedger } from "../../../components/apex";

type Draft = {
  id: string; category: string; headlineRewritten: string;
  fiveW: any; sources: { publisher: string; url: string }[];
  status: "pending" | "published" | "discarded"; openedAt: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function DraftsConsole() {
  const [date, setDate] = useState(today());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reqTopic, setReqTopic] = useState("");
  const [reqCat, setReqCat] = useState("world");
  const [requesting, setRequesting] = useState(false);

  async function requestDraft() {
    if (!reqTopic.trim()) return;
    setRequesting(true); setMsg(null);
    const res = await apexFetch("/api/admin/drafts/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: reqTopic, category: reqCat }),
    }).catch(() => null);
    const out = res ? await res.json() : { ok: false, reason: "Backend unreachable." };
    setMsg(out.ok ? "Draft ready below — open it, verify the sources, then tick to publish." : out.reason);
    if (out.ok) {
      setDate(today()); // re-fetch today's batch so the new draft appears
      const r = await apexFetch(`/api/admin/drafts?date=${today()}`).catch(() => null);
      if (r?.ok) setDrafts((await r.json()).drafts);
      setReqTopic("");
    }
    setRequesting(false);
  }

  useEffect(() => {
    apexFetch(`/api/admin/drafts?date=${date}`)
      .then(r => r.ok ? r.json() : { drafts: DEMO })
      .catch(() => ({ drafts: DEMO }))
      .then(d => { setDrafts(d.drafts); setTicked(new Set()); setOpenId(null); });
  }, [date]);

  async function openDraft(d: Draft) {
    setOpenId(openId === d.id ? null : d.id);
    if (!d.openedAt) {
      setDrafts(ds => ds.map(x => x.id === d.id ? { ...x, openedAt: new Date().toISOString() } : x));
      apexFetch(`/api/admin/drafts/${d.id}/opened`, { method: "POST" }).catch(() => {});
    }
  }

  function toggle(d: Draft) {
    if (!d.openedAt || d.status !== "pending") return; // review gate: must open before ticking
    setTicked(t => { const n = new Set(t); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; });
  }

  async function submit() {
    setMsg(null);
    const res = await apexFetch("/api/admin/drafts/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...ticked] }),
    }).catch(() => null);
    if (!res) return setMsg("Backend unreachable — see README for keys.");
    const out = await res.json();
    const ok = out.results.filter((r: any) => r.ok).length;
    setDrafts(ds => ds.map(d => ticked.has(d.id) ? { ...d, status: "published" } : d));
    setTicked(new Set());
    setMsg(`${ok} card(s) published to the News feed.`);
  }

  const [catFilter, setCatFilter] = useState<Set<string>>(new Set()); // empty = all categories
  const [statusFilter, setStatusFilter] = useState<"all" | "unopened" | "reviewed" | "published">("all");

  const visible = drafts.filter(d => {
    const st = d.status === "published" ? "published" : d.openedAt ? "reviewed" : "unopened";
    if (statusFilter !== "all" && st !== statusFilter) return false;
    if (catFilter.size && !catFilter.has(d.category)) return false;
    return true;
  });

  const byCat = visible.reduce<Record<string, Draft[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-bold">Daily drafts</h1>
        <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)}
               className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
      </div>
      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        Checkboxes unlock after you open a draft. Verify names, numbers and dates against the sources
        before ticking — you are the publisher of record for every card you submit.
      </p>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-bold uppercase" style={{ color: "var(--accent)" }}>Request a draft</span>
        <input value={reqTopic} onChange={e => setReqTopic(e.target.value)}
               placeholder='e.g. "Champions Trophy final result" or "new Alzheimer\u2019s drug approval"'
               className="min-w-[260px] flex-1 rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
        <select value={reqCat} onChange={e => setReqCat(e.target.value)}
                className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }}>
          {["india", "world", "business", "tech", "science", "health", "sports", "entertainment", "environment", "crime"].map(c =>
            <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={requestDraft} disabled={requesting}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}>
          {requesting ? "Researching…" : "Draft it"}
        </button>
        <span className="w-full text-xs" style={{ color: "var(--ink-soft)" }}>
          Indian politics requests are refused server-side. Crime drafts never name unconvicted suspects.
        </span>
      </div>

      {/* console filters: status + category (multi-select) */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {(["all", "unopened", "reviewed", "published"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="rounded-full border px-3 py-1 text-xs font-semibold capitalize"
              style={statusFilter === s
                ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" }
                : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>
              {s}
            </button>
          ))}
          <span className="ml-auto self-center text-xs" style={{ color: "var(--ink-soft)" }}>
            {visible.length} of {drafts.length} drafts
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => setCatFilter(new Set())}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={catFilter.size === 0
              ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
              : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            All
          </button>
          {["india", "world", "business", "tech", "science", "health", "sports",
            "entertainment", "environment", "lifestyle", "education", "crime"].map(c => (
            <button key={c} onClick={() => setCatFilter(f => {
                const n = new Set(f); n.has(c) ? n.delete(c) : n.add(c); return n;
              })}
              className="rounded-full border px-3 py-1 text-xs font-semibold capitalize"
              style={catFilter.has(c)
                ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>
              {c === "world" ? "global" : c}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(byCat).map(([cat, ds]) => (
        <section key={cat}>
          <h2 className="display mb-1 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            {cat}
          </h2>
          <ul className="space-y-2">
            {ds.map(d => (
              <li key={d.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox"
                         checked={ticked.has(d.id)}
                         disabled={!d.openedAt || d.status !== "pending"}
                         onChange={() => toggle(d)}
                         title={!d.openedAt ? "Open the draft to unlock" : ""}
                         className="h-4 w-4 accent-[#3d4ec7] disabled:opacity-30" />
                  <button onClick={() => openDraft(d)} className="flex-1 text-left text-sm font-semibold hover:underline">
                    {d.headlineRewritten}
                  </button>
                  <span className="text-xs font-semibold"
                        style={{ color: d.status === "published" ? "var(--tag-pro)" : "var(--ink-soft)" }}>
                    {d.status === "published" ? "published" : d.openedAt ? "reviewed" : "unopened"}
                  </span>
                </div>
                {openId === d.id && (
                  <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
                    <FiveWLedger w={d.fiveW} />
                    <p className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>Sources (verify before ticking)</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {d.sources.map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                             className="underline" style={{ color: "var(--accent)" }}>{s.publisher}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3">
        <button onClick={submit} disabled={ticked.size === 0}
                className="rounded-lg px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}>
          Submit — publish {ticked.size} selected
        </button>
        {msg && <span className="text-sm font-medium">{msg}</span>}
      </div>
    </div>
  );
}

const DEMO: Draft[] = [
  {
    id: "d1", category: "tech", status: "pending", openedAt: null,
    headlineRewritten: "EU opens formal probe into cloud licensing practices",
    fiveW: { what: "Regulators opened an antitrust investigation into cloud software licensing.",
             when: "Announced Monday.", where: "Brussels, covering the EEA market.",
             why: "Complaints that bundling raises rivals' costs.", how: "Formal Article 102 proceedings; decision within 18 months." },
    sources: [{ publisher: "Reuters", url: "https://example.com/1" },
              { publisher: "FT", url: "https://example.com/2" },
              { publisher: "The Verge", url: "https://example.com/3" }],
  },
];
