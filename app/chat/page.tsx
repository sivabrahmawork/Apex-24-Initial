"use client";
// app/chat/page.tsx — 1:1 text chat, scoped to the ACTIVE persona (your ghost's inbox ≠ your primary's).
// Live delivery via Supabase Realtime channel per conversation (wired in Phase d smoke test).
import { apexFetch } from "../lib/persona";
import { useState } from "react";

type Convo = { id: string; withUsername: string; last: string };
type Msg = { id: string; mine: boolean; body: string; at: string };

export default function Chat() {
  const [convos] = useState<Convo[]>([{ id: "cv1", withUsername: "meera_k", last: "Did you see the transport fund card?" }]);
  const [active, setActive] = useState<Convo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "m1", mine: false, body: "Did you see the transport fund card?", at: "12:01" },
  ]);
  const [draft, setDraft] = useState("");

  async function send() {
    if (!draft.trim() || !active) return;
    setMsgs(m => [...m, { id: crypto.randomUUID(), mine: true, body: draft, at: "now" }]);
    setDraft("");
    await apexFetch(`/api/conversations/${active.id}/messages`, { method: "POST", body: JSON.stringify({ body: draft }) }).catch(() => {});
  }

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <aside className="card p-2">
        <h1 className="display px-2 py-1 font-bold">Chat</h1>
        {convos.map(c => (
          <button key={c.id} onClick={() => setActive(c)}
            className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50">
            <span className="font-semibold">@{c.withUsername}</span>
            <span className="block truncate text-xs" style={{ color: "var(--ink-soft)" }}>{c.last}</span>
          </button>
        ))}
      </aside>
      <section className="card flex min-h-[360px] flex-col p-3">
        {!active ? (
          <p className="m-auto text-sm" style={{ color: "var(--ink-soft)" }}>
            Select a conversation. Messages are sent as your active username.
          </p>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {msgs.map(m => (
                <p key={m.id}
                   className={`max-w-[70%] rounded-2xl px-3 py-1.5 text-sm ${m.mine ? "ml-auto text-white" : "bg-gray-100"}`}
                   style={m.mine ? { background: "var(--accent)" } : {}}>
                  {m.body}
                </p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)}
                     onKeyDown={e => e.key === "Enter" && send()}
                     placeholder="Message…" className="w-full rounded-full border px-3 py-1.5 text-sm"
                     style={{ borderColor: "var(--line)" }} />
              <button onClick={send} className="rounded-full px-4 text-sm font-semibold text-white"
                      style={{ background: "var(--accent)" }}>Send</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
