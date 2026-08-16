"use client";
// app/login/page.tsx — email OTP (decision #1). Phone deferred.
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLocale, t } from "../../lib/i18n";

export default function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "done">("email");
  const [err, setErr] = useState<string | null>(null);
  const [loc, setLoc] = useLocale();

  async function sendCode() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return setErr(error.message);
    setStage("code");
  }
  async function verify() {
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return setErr(error.message);
    setStage("done");
    window.location.href = "/home";
  }

  return (
    <div className="card mx-auto mt-16 max-w-sm space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h1 className="display text-xl font-bold">{t("signin", loc)}</h1>
        <span className="flex gap-1 text-xs font-bold">
          <button onClick={() => setLoc("en")} className="rounded-full border px-2 py-0.5"
            style={loc === "en" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                                : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>EN</button>
          <button onClick={() => setLoc("hi")} className="rounded-full border px-2 py-0.5"
            style={loc === "hi" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                                : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>हिं</button>
        </span>
      </div>
      {stage === "email" && (
        <>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
                 type="email" className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
          <button onClick={sendCode} className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}>{t("sendCode", loc)}</button>
        </>
      )}
      {stage === "code" && (
        <>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code"
                 className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }} />
          <button onClick={verify} className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}>{t("verify", loc)}</button>
        </>
      )}
      {err && <p className="text-sm" style={{ color: "var(--tag-con)" }}>{err}</p>}
      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        First sign-in creates your primary username. You can add one ghost username later (2 identities max).
      </p>
    </div>
  );
}

// ---------- lib/supabase.ts (separate file in repo; inlined here for review) ----------
// import { createClient } from "@supabase/supabase-js";
// export const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
// );
//
// ---------- lib/persona.ts ----------
// export function apexFetch(url: string, init: RequestInit = {}) {
//   const persona = localStorage.getItem("activePersonaId");
//   return fetch(url, { ...init, headers: { ...init.headers,
//     ...(persona ? { "X-Active-Persona": persona } : {}) } });
// }
// Server middleware verifies persona ownership on every write (RLS + app check).
