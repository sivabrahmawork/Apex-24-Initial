"use client";
import { apexFetch } from "../lib/persona";
// app/home/page.tsx — News feed with DYNAMIC category chips.
// Chips are derived from the categories of actually-published cards, so the filter row
// reflects the editor's real selections (no empty chips). Multi-select: any combination; All clears.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiveWLedger, SourcesSheet, ProsConsBadge, ActionBar } from "../../components/apex";
import { t, useLocale } from "../../lib/i18n";

const LABELS: Record<string, string> = { world: "global" }; // display names; others render as-is

export default function NewsFeed() {
  const [all, setAll] = useState<any[]>(DEMO);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // empty = All

  useEffect(() => {
    Promise.all([
      apexFetch(`/api/content`).then(r => r.ok ? r.json() : { items: DEMO }).catch(() => ({ items: DEMO })),
      apexFetch(`/api/content?type=challenge`).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      apexFetch(`/api/posts?type=article`).then(r => r.ok ? r.json() : { posts: [] }).catch(() => ({ posts: [] })),
    ]).then(([news, challenges, community]) => {
      const challengeItems = (challenges.items ?? []).map((c: any) => ({
        ...c, isChallenge: true, category: "challenges",
      }));
      const articles = (community.posts ?? []).map((p: any) => ({
        id: p.id, isCommunity: true, category: "community",
        headlineRewritten: p.title, username: p.username,
        excerpt: p.body?.slice(0, 220), commentCount: p.commentCount ?? 0,
      }));
      setAll([...challengeItems, ...news.items, ...articles]);
    });
  }, []);

  // chips = categories that actually exist in published content, stable order
  const cats = useMemo(() => {
    const order = ["india", "world", "business", "tech", "science", "health",
                   "sports", "entertainment", "environment", "lifestyle", "education", "crime", "challenges", "community"];
    const present = new Set(all.map(i => i.category).filter(Boolean));
    return order.filter(c => present.has(c));
  }, [all]);

  const items = selected.size === 0 ? all
    : all.filter(i => i.category && selected.has(i.category));

  function toggle(cat: string) {
    setSelected(s => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-bold">Home</h1>
        <a href="/home/post" className="rounded-lg border px-3 py-1.5 text-xs font-bold"
           style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>✍ Write an article</a>
      </div>

      <TweetBox onPosted={(p: any) => setAll(a => [{ id: p.id, isCommunity: true, category: "community",
        headlineRewritten: null, username: p.username ?? "you", excerpt: p.body, commentCount: 0 }, ...a])} />

      <div className="sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto bg-[var(--paper)] px-4 py-2">
        <Chip label="All" active={selected.size === 0} onClick={() => setSelected(new Set())} />
        {cats.map(c => (
          <Chip key={c} label={LABELS[c] ?? c} active={selected.has(c)} onClick={() => toggle(c)} />
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Nothing published in these categories yet.</p>
      )}

      {items.map((it: any) => it.isChallenge ? (
        <article key={it.id} className="card p-4" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                Apex Challenges
              </p>
              <Link href={`/home/${it.id}`} className="display text-lg font-semibold leading-snug hover:underline">
                {it.headlineRewritten}
              </Link>
            </div>
            <SourcesSheet sources={it.sources ?? []} label="s" />
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            {(it.body ?? "").slice(0, 260)}…
          </p>
          <Link href={`/home/${it.id}`} className="mt-2 block text-xs font-semibold" style={{ color: "var(--accent)" }}>
            {it.commentCount ?? 0} comments → discuss & solve
          </Link>
        </article>
      ) : it.isCommunity ? (
        <article key={it.id} className="card p-4" style={{ borderStyle: "dashed" }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tag-question)" }}>
            Community article — @{it.username}
          </p>
          {it.headlineRewritten ? (
            <>
              <Link href={`/posts/${it.id}`} className="display text-lg font-semibold leading-snug hover:underline">
                {it.headlineRewritten}
              </Link>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>{it.excerpt}…</p>
            </>
          ) : it.type === "poll" && it.pollOptions ? (
            <PollCard post={it} />
          ) : (
            <p className="mt-1 text-[15px]">{it.excerpt}</p>
          )}
          <Link href={`/posts/${it.id}`} className="mt-2 block text-xs font-semibold" style={{ color: "var(--accent)" }}>
            {it.commentCount} comments → read & discuss
          </Link>
        </article>
      ) : (
        <article key={it.id} className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            Apex · verified 5W
          </p>
          <div className="flex items-start justify-between gap-3">
            <Link href={`/home/${it.id}`} className="display text-lg font-semibold leading-snug hover:underline">
              {it.headlineRewritten}
            </Link>
            <SourcesSheet sources={it.sources} />
          </div>
          {it.category && (
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              {LABELS[it.category] ?? it.category}
            </span>
          )}
          <FiveWLedger w={it.fiveW} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs"
               style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            <ActionBar targetType="content_item" targetId={it.id}
                       likes={it.likes ?? 0} dislikes={it.dislikes ?? 0}
                       shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/home/${it.id}`} />
            <ProsConsBadge pros={it.badge?.pros ?? 0} cons={it.badge?.cons ?? 0} />
            <Link href={`/home/${it.id}`} className="ml-auto font-semibold" style={{ color: "var(--accent)" }}>
              💡 {it.commentCount} comments → discuss & summarize
            </Link>
          </div>
          {it.isGroupSolution && (
            <p className="mt-2 rounded-lg px-2 py-1 text-xs font-semibold"
               style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              Group Solution — published by {it.authorName}. Add, build, validate or criticize it.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-semibold capitalize"
      style={active
        ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
        : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>
      {label}
    </button>
  );
}

function TweetBox({ onPosted }: { onPosted: (p: any) => void }) {
  const [body, setBody] = useState("");
  const [isPoll, setIsPoll] = useState(false);
  const [opts, setOpts] = useState<string[]>(["", ""]);
  async function post() {
    if (!body.trim()) return;
    const payload = isPoll
      ? { type: "poll", body, pollOptions: opts.map(o => o.trim()).filter(Boolean) }
      : { type: "tweet", body };
    if (isPoll && (payload as any).pollOptions.length < 2) return;
    const res = await apexFetch("/api/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const p = res?.ok ? await res.json() : { id: crypto.randomUUID(), body };
    onPosted({ ...p, body, type: isPoll ? "poll" : "tweet",
               pollOptions: isPoll ? (payload as any).pollOptions : undefined });
    setBody(""); setIsPoll(false); setOpts(["", ""]);
  }
  return (
    <>
    <div className="card flex gap-2 p-3">
      <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 280))} rows={2}
        placeholder="Share a short post (280 chars) — appears under Community. You own what you write."
        className="w-full resize-none bg-transparent text-sm outline-none" />
      <div className="flex flex-col items-end justify-between gap-1">
        <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>{body.length}/280</span>
        <button onClick={() => { setIsPoll(p => !p); }} title={t("poll")}
                className="rounded-full border px-2 text-[11px] font-bold"
                style={isPoll ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                              : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>
          {t("poll")}
        </button>
        <button onClick={post} className="rounded-lg px-4 py-1 text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>{t("post")}</button>
      </div>
    </div>
    {isPoll && (
      <div className="card mt-1 space-y-1 p-2">
        {opts.map((o, i) => (
          <input key={i} value={o} placeholder={`${t("option")} ${i + 1}`}
                 onChange={e => setOpts(a => a.map((x, j) => j === i ? e.target.value.slice(0, 80) : x))}
                 className="w-full rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--line)" }} />
        ))}
        {opts.length < 4 && (
          <button onClick={() => setOpts(a => [...a, ""])}
                  className="text-xs font-semibold" style={{ color: "var(--accent)" }}>+ {t("option")}</button>
        )}
      </div>
    )}
  </>
  );
}

function PollCard({ post }: { post: any }) {
  const [tallies, setTallies] = useState<Record<string, number>>(post.tallies ?? {});
  const [voted, setVoted] = useState<number | null>(null);
  const total = Object.values(tallies).reduce((a, b) => a + b, 0);
  async function vote(i: number) {
    setVoted(i);
    setTallies(tt => ({ ...tt, [i]: (tt[i] ?? 0) + 1 }));
    const res = await apexFetch("/api/polls/vote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, optionIndex: i }),
    }).catch(() => null);
    if (res?.ok) { const j = await res.json();
      const m: Record<string, number> = {}; for (const r of j.tallies) m[r.option_index] = r.n; setTallies(m); }
  }
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[15px] font-medium">{post.body ?? post.excerpt}</p>
      {post.pollOptions.map((o: string, i: number) => {
        const n = tallies[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <button key={i} onClick={() => vote(i)} disabled={voted !== null}
            className="relative block w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-sm"
            style={{ borderColor: voted === i ? "var(--accent)" : "var(--line)" }}>
            <span className="absolute inset-y-0 left-0" style={{ width: pct + "%", background: "var(--accent-soft)" }} />
            <span className="relative flex justify-between">
              <span>{o}</span><span className="text-xs" style={{ color: "var(--ink-soft)" }}>{pct}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-[10px]" style={{ color: "var(--ink-soft)" }}>{total} {t("vote")}s</p>
    </div>
  );
}

const DEMO = [{
  id: "demo-1", category: "india",
  headlineRewritten: "Centre clears new urban transport fund for 12 cities",
  fiveW: {
    what: "A \u20b918,000 crore fund for metro and bus expansion was approved.",
    when: "Cabinet decision on Friday; disbursal starts next fiscal.",
    where: "Twelve tier-1 and tier-2 cities, list to be notified.",
    why: "Congestion costs and air-quality targets under the national plan.",
    how: "50:30:20 split between Centre, states and multilateral loans.",
  },
  sources: [
    { publisher: "PTI (licensed wire)", url: "https://example.com/pti" },
    { publisher: "The Hindu", url: "https://example.com/hindu" },
    { publisher: "Mint", url: "https://example.com/mint" },
  ],
  commentCount: 12, badge: { pros: 5, cons: 2 }, isGroupSolution: false,
}];
