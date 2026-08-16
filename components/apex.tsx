"use client";
// components/apex.tsx — FiveWLedger, SourcesSheet, TagChip, CommentThread, SummarizePanel
import { useState } from "react";
import { apexFetch } from "../lib/persona";
import { getLocale, t } from "../lib/i18n";

export type FiveW = { what: string; when: string; where: string; why: string; how: string };
export type Source = { publisher: string; author?: string; url: string };
export type Label = "question" | "assumption" | "analysis" | "pro" | "con" | "solution";
export type Comment = {
  id: string; username: string; body: string; createdAt: string;
  label: Label | null; userCorrected?: boolean; parentId?: string | null;
  likes?: number; dislikes?: number; archetype?: "questioner" | "solver" | "analyst" | null;
};

const ARCHETYPE_STYLE: Record<string, { bg: string; title: string }> = {
  questioner: { bg: "var(--tag-question)", title: "Questioner — usually asks the questions that move a discussion" },
  solver:     { bg: "var(--tag-solution)", title: "Solver — usually proposes solutions" },
  analyst:    { bg: "var(--tag-analysis)", title: "Analyst — usually contributes analysis, pros and cons" },
};

export function ArchetypeBadge({ archetype }: { archetype?: string | null }) {
  if (!archetype || !ARCHETYPE_STYLE[archetype]) return null;
  const a = ARCHETYPE_STYLE[archetype];
  return (
    <span className="rounded-full px-2 py-[1px] text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ background: a.bg }} title={a.title}>
      {archetype}
    </span>
  );
}

const TAG_COLOR: Record<Label, string> = {
  question: "var(--tag-question)", assumption: "var(--tag-assumption)",
  analysis: "var(--tag-analysis)", pro: "var(--tag-pro)",
  con: "var(--tag-con)", solution: "var(--tag-solution)",
};

// ---------- signature element ----------
export function FiveWLedger({ w }: { w: FiveW }) {
  return (
    <div className="ledger my-3">
      {(["what", "when", "where", "why", "how"] as const).map(k => (
        <FragmentRow key={k} k={k} v={w[k]} />
      ))}
    </div>
  );
}
function FragmentRow({ k, v }: { k: string; v: string }) {
  return (<><div className="w">{k}</div><div className="v">{v}</div></>);
}

// ---------- "i" → sources ----------
export function SourcesSheet({ sources, label = "i" }: { sources: Source[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        title="Sources">{label}</button>
      {open && (
        <div className="card absolute right-0 z-10 mt-2 w-72 p-3 text-sm shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide"
             style={{ color: "var(--ink-soft)" }}>Sources</p>
          <ul className="space-y-2">
            {sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                   className="font-medium underline" style={{ color: "var(--accent)" }}>
                  {s.publisher}
                </a>
                {s.author && <span style={{ color: "var(--ink-soft)" }}> — {s.author}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs" style={{ color: "var(--ink-soft)" }}>
            Apex summarizes facts from multiple sources. Read the originals.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- classification chip + correction ----------
export function TagChip({ comment, onCorrect }: { comment: Comment; onCorrect: (id: string, l: Label) => void }) {
  const [picking, setPicking] = useState(false);
  if (!comment.label) return null;
  return (
    <span className="relative">
      <button className="tag" style={{ color: TAG_COLOR[comment.label] }}
              onClick={() => setPicking(p => !p)}
              title={comment.userCorrected ? "Corrected by author" : "AI-labeled — tap if wrong"}>
        {comment.label}{comment.userCorrected ? " ✓" : ""}
      </button>
      {picking && (
        <span className="card absolute left-0 z-10 mt-1 flex flex-wrap gap-1 p-2">
          {(Object.keys(TAG_COLOR) as Label[]).map(l => (
            <button key={l} className="tag" style={{ color: TAG_COLOR[l] }}
                    onClick={() => { onCorrect(comment.id, l); setPicking(false); }}>{l}</button>
          ))}
        </span>
      )}
    </span>
  );
}

// ---------- badges (>50%, min 4 classified pro/con replies) ----------
export function ProsConsBadge({ pros, cons }: { pros: number; cons: number }) {
  const total = pros + cons;
  if (total < 4) return null;
  const prosHigh = pros / total > 0.5, consHigh = cons / total > 0.5;
  return (
    <span className="flex gap-2 text-xs font-semibold">
      <span style={{ color: "var(--tag-pro)" }}>Pros {prosHigh ? "High" : "Low"}</span>
      <span style={{ color: "var(--tag-con)" }}>Cons {consHigh ? "High" : "Low"}</span>
    </span>
  );
}

// ---------- action bar: Like · Dislike · Reply · Share (deck spec) ----------
export function ActionBar({ targetType, targetId, likes = 0, dislikes = 0, onReply, shareUrl }: {
  targetType: "content_item" | "user_post" | "comment"; targetId: string;
  likes?: number; dislikes?: number; onReply?: () => void; shareUrl?: string;
}) {
  const [state, setState] = useState<{ mine: boolean | null; likes: number; dislikes: number }>(
    { mine: null, likes, dislikes });
  const [copied, setCopied] = useState(false);

  async function react(liked: boolean) {
    const next = state.mine === liked ? null : liked;
    setState(s0 => ({
      mine: next,
      likes: s0.likes + (next === true ? 1 : 0) - (s0.mine === true ? 1 : 0),
      dislikes: s0.dislikes + (next === false ? 1 : 0) - (s0.mine === false ? 1 : 0),
    }));
    await apexFetch("/api/react", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, liked: next }),
    }).catch(() => {});
  }

  async function share() {
    const url = shareUrl ?? window.location.href;
    if (navigator.share) { await navigator.share({ url }).catch(() => {}); return; }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const btn = "flex items-center gap-1 font-semibold";
  return (
    <span className="flex items-center gap-4 text-xs" style={{ color: "var(--ink-soft)" }}>
      <button className={btn} onClick={() => react(true)}
              style={state.mine === true ? { color: "var(--tag-pro)" } : {}}
              aria-label="Like" title="Like">
        <Ic d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        {state.likes}
      </button>
      <button className={btn} onClick={() => react(false)}
              style={state.mine === false ? { color: "var(--tag-con)" } : {}}
              aria-label="Dislike" title="Dislike">
        <Ic d="M17 14V2H6.6a2 2 0 0 0-2 1.7L3.3 12a2 2 0 0 0 2 2.3H10l-1 5.4a1.7 1.7 0 0 0 3.2 1L17 14zM21 2h-4v12h4z" />
        {state.dislikes}
      </button>
      {onReply && (
        <button className={btn} onClick={onReply} style={{ color: "var(--accent)" }}
                aria-label="Reply" title={t("reply")}>
          <Ic d="M9 14 4 9l5-5M4 9h11a4 4 0 0 1 4 4v7" />
        </button>
      )}
      <button className={btn} onClick={share} aria-label="Share" title={t("share")}>
        <Ic d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M12 2v13M8 6l4-4 4 4" />
        {copied ? "✓" : ""}
      </button>
    </span>
  );
}

function Ic({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// per-comment Translate (en<->hi, cached server-side)
export function TranslateButton({ commentId, original, onSwap }: {
  commentId: string; original: string; onSwap: (body: string, translated: boolean) => void;
}) {
  const [translated, setTranslated] = useState(false);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (translated) { onSwap(original, false); setTranslated(false); return; }
    setBusy(true);
    const res = await apexFetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, target: getLocale() }),  // translate to the reader's language
    }).catch(() => null);
    if (res?.ok) { const j = await res.json(); onSwap(j.body, true); setTranslated(true); }
    setBusy(false);
  }
  return (
    <button onClick={toggle} disabled={busy}
            className="text-[10px] font-bold" style={{ color: "var(--accent)" }}
            title={translated ? t("original") : t("translate")}>
      {busy ? "…" : translated ? "A" : "अ"}
    </button>
  );
}

// ---------- discussion ----------
export function CommentThread({ targetType, targetId, initial }: {
  targetType: "content_item" | "user_post" | "group"; targetId: string; initial: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [shown, setShown] = useState<Record<string, string | undefined>>({});

  async function submit() {
    if (!draft.trim()) return;
    const res = await apexFetch("/api/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, body: draft, parentId: replyTo?.id ?? null }),
    }).catch(() => null);
    const saved = res?.ok ? await res.json() : {
      id: crypto.randomUUID(), username: "you", body: draft,
      createdAt: new Date().toISOString(), label: null, // tag arrives after async classification
    };
    setComments(c => [{ ...saved, parentId: replyTo?.id ?? null }, ...c]);
    setDraft(""); setReplyTo(null);
  }

  async function correct(id: string, label: Label) {
    setComments(cs => cs.map(c => c.id === id ? { ...c, label, userCorrected: true } : c));
    await apexFetch(`/api/comments/${id}/correct-tag`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).catch(() => {});
  }

  return (
    <section className="mt-4">
      {replyTo && (
        <p className="mb-1 text-xs" style={{ color: "var(--accent)" }}>
          Replying to @{replyTo.username} — "{replyTo.body.slice(0, 60)}…"
          <button className="ml-2 font-bold" onClick={() => setReplyTo(null)}>✕</button>
        </p>
      )}
      <div className="card flex gap-2 p-3">
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
          placeholder="Add to the discussion — Apex will tag it as question, analysis, pro, con, assumption or solution."
          className="w-full resize-none bg-transparent text-sm outline-none" />
        <button onClick={submit} className="self-end rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>Post</button>
      </div>
      {comments.length > 5 && <SummarizePanel targetType={targetType} targetId={targetId} />}
      <ul className="mt-3 space-y-3">
        {comments.map(c => (
          <li key={c.id} className="card p-3" style={c.parentId ? { marginLeft: "1.5rem" } : {}}>
            <div className="mb-1 flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
              <span className="font-semibold" style={{ color: "var(--ink)" }}>@{c.username}</span>
              <ArchetypeBadge archetype={c.archetype} />
              <span>{new Date(c.createdAt).toLocaleString()}</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>this comment:</span>
                <TagChip comment={c} onCorrect={correct} />
              </span>
            </div>
            <p className="text-sm">{shown[c.id] ?? c.body}</p>
            <div className="mt-2 flex items-center gap-3 border-t pt-1.5" style={{ borderColor: "var(--line)" }}>
              <ActionBar targetType="comment" targetId={c.id}
                         likes={c.likes ?? 0} dislikes={c.dislikes ?? 0}
                         onReply={() => setReplyTo(c)} />
              <TranslateButton commentId={c.id} original={c.body}
                onSwap={(b, tr) => setShown(m => ({ ...m, [c.id]: tr ? b : undefined }))} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- AI Summarize (unlocks > 5 comments) ----------
const KINDS = ["summary", "swot", "pros_cons", "solutions", "assumptions"] as const;
export function SummarizePanel({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [out, setOut] = useState<{ title: string; points: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function run(kind: string) {
    setBusy(kind);
    const res = await apexFetch("/api/summarize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, kind }),
    }).catch(() => null);
    setOut(res?.ok ? await res.json() : { title: "Unavailable", points: ["Summary service not reachable."] });
    setBusy(null);
  }
  return (
    <div className="card mt-3 p-3" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
          💡 Analyze this discussion
        </span>
        {KINDS.map(k => (
          <button key={k} onClick={() => run(k)} disabled={!!busy}
            className="rounded-full border bg-white px-3 py-0.5 text-xs font-medium"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
            {busy === k ? "…" : k.replace("_", "/")}
          </button>
        ))}
        {out && <button className="ml-auto text-xs" onClick={() => setOut(null)}>✕</button>}
      </div>
      {out && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">{out.title}</p>
          <ul className="ml-4 list-disc">{out.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
