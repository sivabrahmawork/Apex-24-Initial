"use client";
import { apexFetch } from "../../lib/persona";
// app/admin/topics/page.tsx — daily topic picker.
// Flow: cron fills candidates by 05:30 IST → you scan 20, tick the ones worth covering →
// Draft selected → drafts appear in the review editor (existing /admin card form, prefilled) → you verify → Publish.
import { useEffect, useState } from "react";

type Topic = {
  id: string; category: string; title: string; rationale: string;
  seedSources: { publisher: string; url: string }[];
  status: "candidate" | "selected" | "drafted" | "dismissed";
};

const CAT_LABEL: Record<string, string> = {
  world: "World", tech: "Tech", science: "Science",
  sports: "Sports", health: "Health", entertainment: "Entertainment",
};

export default function TopicPicker() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apexFetch(`/api/admin/topics?date=${new Date().toISOString().slice(0, 10)}`)
      .then(r => r.ok ? r.json() : { topics: DEMO })
      .catch(() => ({ topics: DEMO }))
      .then(d => setTopics(d.topics));
  }, []);

  function toggle(id: string) {
    setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function draftSelected() {
    setBusy(true); setMsg(null);
    let ok = 0, skipped = 0, failed = 0;
    for (const id of picked) {
      const r = await apexFetch(`/api/admin/topics/${id}/select`, { method: "POST" }).catch(() => null);
      if (!r) { failed++; continue; }
      const body = await r.json();
      body.skipped ? skipped++ : r.ok ? ok++ : failed++;
      setTopics(ts => ts.map(t => t.id === id ? { ...t, status: body.skipped ? "dismissed" : "drafted" } : t));
    }
    setPicked(new Set()); setBusy(false);
    setMsg(`${ok} drafted → review queue · ${skipped} auto-skipped (allegation guard) · ${failed} failed`);
  }

  const byCat = Object.keys(CAT_LABEL).map(c => [c, topics.filter(t => t.category === c)] as const);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-bold">Today's topics</h1>
        <button onClick={draftSelected} disabled={busy || picked.size === 0}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}>
          {busy ? "Drafting…" : `Draft ${picked.size} selected`}
        </button>
      </div>
      {msg && <p className="text-sm font-medium">{msg}</p>}
      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        Drafts are never auto-published. Every card still passes your review — verify names, numbers
        and dates against the linked sources before hitting Publish.
      </p>

      {byCat.map(([cat, list]) => list.length > 0 && (
        <section key={cat}>
          <h2 className="display mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            {CAT_LABEL[cat]}
          </h2>
          <ul className="space-y-2">
            {list.map(t => (
              <li key={t.id} className="card flex items-start gap-3 p-3"
                  style={t.status !== "candidate" ? { opacity: 0.55 } : {}}>
                <input type="checkbox" className="mt-1" disabled={t.status !== "candidate"}
                       checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{t.rationale}</p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    {t.seedSources.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                         className="underline" style={{ color: "var(--accent)" }}>{s.publisher}</a>
                    ))}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>
                  {t.status !== "candidate" ? t.status : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const DEMO: Topic[] = [
  { id: "t1", category: "tech", status: "candidate",
    title: "EU opens probe into app-store steering rules",
    rationale: "Clear trade-off debate: platform control vs developer freedom.",
    seedSources: [{ publisher: "Reuters", url: "https://example.com" }, { publisher: "The Verge", url: "https://example.com" }] },
  { id: "t2", category: "health", status: "candidate",
    title: "WHO updates guidance on ultra-processed food labelling",
    rationale: "Directly debatable: should India adopt front-of-pack warnings?",
    seedSources: [{ publisher: "BBC", url: "https://example.com" }, { publisher: "The Guardian", url: "https://example.com" }] },
];
