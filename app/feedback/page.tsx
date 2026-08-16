"use client";
// app/feedback/page.tsx — user feedback screen (own nav slot: Home / Chat / Feedback / Profile).
import { apexFetch } from "../lib/persona";
import { useState } from "react";

export default function Feedback() {
  const [topic, setTopic] = useState("idea");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    if (body.trim().length < 5) return setMsg("Say a little more.");
    const res = await apexFetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, body }),
    }).catch(() => null);
    setMsg(res?.ok ? "Thanks — the editor reads every one of these." : "Backend unreachable.");
    if (res?.ok) setBody("");
  }

  return (
    <div className="mx-auto max-w-md space-y-3">
      <h1 className="display text-2xl font-bold">Feedback</h1>
      <div className="flex gap-2">
        {["bug", "idea", "content", "other"].map(t => (
          <button key={t} onClick={() => setTopic(t)}
            className="rounded-full border px-3 py-1 text-xs font-semibold capitalize"
            style={topic === t ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                               : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>{t}</button>
        ))}
      </div>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
                placeholder="What's working, what's broken, what's missing?"
                className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
      <button onClick={send} className="rounded-lg px-5 py-2 text-sm font-bold text-white"
              style={{ background: "var(--accent)" }}>Send</button>
      {msg && <p className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
