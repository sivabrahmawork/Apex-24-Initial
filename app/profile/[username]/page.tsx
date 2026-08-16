import { LangSetting } from "../../../components/lang-setting";
// ---------- app/profile/[username]/page.tsx ----------
// Persona board: counts derive from effective classifications + group publications.
export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let board = { questions: 4, solutions: 2, analyses: 7, publishedSolutions: 1, followers: 23 };
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/profile/${username}`, { cache: "no-store" });
    if (r.ok) board = await r.json();
  } catch {}
  const rows: [string, number][] = [
    ["Questions asked", board.questions], ["Solutions proposed", board.solutions],
    ["Analyses written", board.analyses], ["Group solutions published", board.publishedSolutions],
    ["Followers", board.followers],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-bold">@{username}</h1>
        <div className="flex gap-2">
          <a href="/groups" className="rounded-lg border px-3 py-1.5 text-xs font-bold"
             style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>Groups</a>
          <a href="/feedback" className="rounded-lg border px-3 py-1.5 text-xs font-bold"
             style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>Feedback</a>
        </div>
      </div>
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
        {rows.map(([label, n]) => (
          <div key={label} className="flex items-center justify-between p-3 text-sm">
            <span>{label}</span>
            <span className="display text-lg font-bold" style={{ color: "var(--accent)" }}>{n}</span>
          </div>
        ))}
      </div>
      <LangSetting />
      <a href="/groups" className="card block p-3 text-sm font-semibold" style={{ color: "var(--accent)" }}>
        Your groups → create, discuss, publish solutions
      </a>
      <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
        Your identity here is earned from what you write. Questioner — you ask the questions that move
        discussions. Solver — you propose solutions. Analyst — you contribute analysis, pros and cons.
        Badges unlock at 10+ classified comments when one style is at least 40% of your writing; individual
        comments still carry their own small tag, which you can correct if the AI gets one wrong.
      </p>
    </div>
  );
}