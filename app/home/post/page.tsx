"use client";
// app/news/post/page.tsx — "Write an article" composer for the News section's Community layer.
// UGC regime: posted under the user's ACTIVE persona; Apex does not edit or verify these.
// Safe-harbor hygiene: originality attestation + report/takedown machinery on the read side.
import { apexFetch } from "../../lib/persona";
import { useState } from "react";

export default function WriteArticle() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attested, setAttested] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    if (title.trim().length < 8) return setMsg("Title too short.");
    if (body.trim().split(/\s+/).length < 100) return setMsg("Articles need at least 100 words — for shorter takes, comment on a news card instead.");
    if (!attested) return setMsg("Confirm the originality attestation.");
    const res = await apexFetch("/api/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "article", title, body }),
    }).catch(() => null);
    if (!res?.ok) return setMsg("Backend unreachable — see README for keys.");
    const { id } = await res.json();
    window.location.href = `/posts/${id}`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="display text-2xl font-bold">Write an article</h1>
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Published in the News section under the <b>Community</b> filter, clearly marked as your article —
        not Apex-verified news. Anyone can read and discuss it.
      </p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
             className="w-full rounded border px-3 py-2 text-lg font-semibold" style={{ borderColor: "var(--line)" }} />
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
                placeholder="Your article. Own words only — copying a publisher's text will be removed on report."
                className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
      <label className="flex items-start gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
        <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}
               className="mt-0.5 h-4 w-4 accent-[#3d4ec7]" />
        <span>This is my own writing. I have not copied text from news sites, books or other authors,
        and I take responsibility for factual claims about real people.</span>
      </label>
      <div className="flex items-center gap-3">
        <button onClick={submit} className="rounded-lg px-5 py-2 text-sm font-bold text-white"
                style={{ background: "var(--accent)" }}>Publish article</button>
        {msg && <span className="text-sm font-medium" style={{ color: "var(--tag-con)" }}>{msg}</span>}
      </div>
    </div>
  );
}
