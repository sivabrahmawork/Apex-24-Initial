"use client";
// app/admin/layout.tsx — console shell: editor gate + shared tab bar for all admin screens.
// Real enforcement is server-side (requireEditor on every /api/admin/*); this gate is UX.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apexFetch } from "../../lib/persona";

const TABS = [
  { href: "/admin/drafts", label: "Drafts" },
  { href: "/admin", label: "Card editor" },
  { href: "/admin/challenge", label: "Challenge" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/feedback", label: "Feedback" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "editor" | "denied">("loading");
  const path = usePathname();

  useEffect(() => {
    apexFetch("/api/me").then(r => r.json())
      .then(d => setState(d.isEditor ? "editor" : "denied"))
      .catch(() => setState("denied"));
  }, []);

  if (state === "loading") return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Checking access…</p>;
  if (state === "denied") return (
    <div className="card mx-auto max-w-sm p-6 text-center">
      <p className="display font-bold">Editor access required</p>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
        This console is for the Apex editorial account. If that's you, sign in with your editor email.
      </p>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto border-b pb-2" style={{ borderColor: "var(--line)" }}>
        {TABS.map(t => (
          <Link key={t.href} href={t.href}
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={path === t.href
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--ink-soft)" }}>
            {t.label}
          </Link>
        ))}
        <span className="ml-auto self-center text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--tag-con)" }}>Editor console</span>
      </div>
      {children}
    </div>
  );
}
