"use client";
// app/groups/page.tsx — group list/search/create + inline detail with the discuss → poll → publish flow.
import { apexFetch } from "../lib/persona";
import { useState } from "react";
import { CommentThread } from "../../components/apex";

type Group = { id: string; title: string; description: string; members: number; joined: boolean };
type Solution = {
  id: string; body: string; status: "discussing" | "polling" | "published" | "failed";
  approvals: number; eligible: number; threshold: number; closesAt?: string;
};

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([
    { id: "g1", title: "Bengaluru lake restoration", description: "Practical fixes for Bellandur & Varthur.", members: 9, joined: true },
  ]);
  const [active, setActive] = useState<Group | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });

  async function createGroup() {
    if (!form.title || form.title.length > 60 || form.description.length > 100) return;
    const g = { id: crypto.randomUUID(), ...form, members: 1, joined: true };
    setGroups(gs => [g, ...gs]); setForm({ title: "", description: "" });
    await apexFetch("/api/groups", { method: "POST", body: JSON.stringify(form) }).catch(() => {});
  }

  if (active) return <GroupDetail group={active} back={() => setActive(null)} />;

  return (
    <div className="space-y-4">
      <h1 className="display text-2xl font-bold">Groups</h1>
      <div className="card flex gap-2 p-3">
        <input value={form.title} maxLength={60} placeholder="Title (≤60 chars)"
               onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
               className="w-1/3 rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
        <input value={form.description} maxLength={100} placeholder="Description (≤100 chars)"
               onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
               className="flex-1 rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
        <button onClick={createGroup} className="rounded-lg px-3 text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>Create</button>
      </div>
      <ul className="space-y-2">
        {groups.map(g => (
          <li key={g.id} className="card flex items-center justify-between p-3">
            <button onClick={() => setActive(g)} className="text-left">
              <p className="font-semibold">{g.title}</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{g.description} · {g.members} members</p>
            </button>
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
              {g.joined ? "Open →" : "Join"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupDetail({ group, back }: { group: Group; back: () => void }) {
  const [solution, setSolution] = useState<Solution | null>({
    id: "s1", body: "Petition BBMP for a dedicated wetland officer; crowd-monitor inflows monthly.",
    status: "polling", approvals: 6, eligible: 9, threshold: 75,
    closesAt: new Date(Date.now() + 48 * 3600e3).toISOString(),
  });
  const [voted, setVoted] = useState(false);

  const pct = solution ? Math.round((solution.approvals / solution.eligible) * 100) : 0;

  return (
    <div className="space-y-4">
      <button onClick={back} className="text-sm font-semibold" style={{ color: "var(--accent)" }}>← Groups</button>
      <div className="card p-4">
        <h1 className="display text-xl font-bold">{group.title}</h1>
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{group.description}</p>
      </div>

      {solution && (
        <div className="card p-4" style={{ borderColor: "var(--accent)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--accent)" }}>
            Proposed solution — poll {solution.status === "polling" ? "open" : solution.status}
          </p>
          <p className="my-2 text-sm">{solution.body}</p>
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span>{solution.approvals}/{solution.eligible} approve ({pct}%)</span>
            <span>needs {solution.threshold}%{solution.eligible < 4 && " (small group → unanimity)"}</span>
            <span>closes {new Date(solution.closesAt!).toLocaleString()}</span>
            <button disabled={voted}
              onClick={() => { setVoted(true); setSolution(s => s && ({ ...s, approvals: s.approvals + 1 })); 
                apexFetch(`/api/solutions/${solution.id}/vote`, { method: "POST", body: JSON.stringify({ approve: true }) }).catch(() => {}); }}
              className="ml-auto rounded-lg px-3 py-1 font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {voted ? "Voted" : "Publish (approve)"}
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            If approved, this publishes to the News screen where anyone can add, build, validate or criticize it.
            Failed polls are final — propose a fresh solution.
          </p>
        </div>
      )}

      <CommentThread targetType="group" targetId={group.id} initial={[]} />
    </div>
  );
}
