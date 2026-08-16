// app/news/[id]/page.tsx — detail: full card + typed discussion (classification happens post-hoc)
import { FiveWLedger, SourcesSheet, CommentThread } from "../../../components/apex";

async function getItem(id: string) {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/content/${id}`, { cache: "no-store" });
    if (r.ok) return r.json();
  } catch {}
  return {
    id, headlineRewritten: "Centre clears new urban transport fund for 12 cities",
    fiveW: { what: "₹18,000 crore fund approved.", when: "Friday.", where: "12 cities.",
             why: "Congestion and air-quality targets.", how: "50:30:20 funding split." },
    sources: [{ publisher: "PTI (licensed wire)", url: "https://example.com" }],
    comments: [
      { id: "c1", username: "meera_k", body: "Which 12 cities? The last fund never published its list.",
        createdAt: new Date().toISOString(), label: "question", archetype: "questioner" },
      { id: "c2", username: "arvind.g", body: "Assuming states can absorb the 30% share — most can't.",
        createdAt: new Date().toISOString(), label: "assumption", archetype: "analyst" },
    ],
  };
}

export default async function NewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  return (
    <article>
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="display text-xl font-bold leading-snug">{item.headlineRewritten}</h1>
          <SourcesSheet sources={item.sources} label={item.type === "challenge" ? "s" : "i"} />
        </div>
        {item.type === "challenge" ? (
          <>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              Apex Challenges — a researched problem brief. Sources under "s". Discuss and solve below.
            </p>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
              {(item.body ?? "").split("\n\n").map((para: string, i: number) => <p key={i}>{para}</p>)}
            </div>
          </>
        ) : (
          <FiveWLedger w={item.fiveW} />
        )}
      </div>
      <CommentThread targetType="content_item" targetId={item.id} initial={item.comments} />
    </article>
  );
}
