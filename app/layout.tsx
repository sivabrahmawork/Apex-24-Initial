// app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Apex — structured news discussion" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur"
                style={{ borderColor: "var(--line)" }}>
          <nav className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/home" className="display text-xl font-bold" style={{ color: "var(--accent)" }}>
              Apex
            </Link>
            <div className="flex items-center gap-5 text-sm font-medium">
              <Link href="/home">Home</Link>
              <Link href="/chat">Chat</Link>
              <Link href="/feedback">Feedback</Link>
              <Link href="/profile/me">Profile</Link>
              <EditorLink />
              {/* PersonaSwitcher: primary ⇄ ghost; every write is attributed to the active one */}
              <PersonaSwitcher />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
              <script dangerouslySetInnerHTML={{ __html: `
          (async () => { try {
            const s = JSON.parse(localStorage.getItem('sb-session') || 'null');
            const r = await fetch('/api/me', { headers: s?.access_token ? { Authorization: 'Bearer ' + s.access_token } : {} });
            const d = await r.json();
            if (d.isEditor) { const el = document.getElementById('editor-link'); if (el) el.style.display = 'inline'; }
          } catch (e) {} })();
        ` }} />
      </body>
    </html>
  );
}

function EditorLink() {
  return (
    <a href="/admin/drafts" id="editor-link" style={{ display: "none", color: "var(--tag-con)", fontWeight: 700 }}
       suppressHydrationWarning>Editor</a>
  );
}

function PersonaSwitcher() {
  // Client wiring in lib/persona.ts sets X-Active-Persona on all fetches (Phase d).
  return (
    <form action="/api/personas/switch" method="post">
      <button className="rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
              title="Switch between your primary and ghost username">
        @persona ▾
      </button>
    </form>
  );
}
