// app/posts/[id]/page.tsx — Community article: read + typed discussion + report (safe-harbor machinery).
import { CommentThread } from "../../../components/apex";

async function getPost(id: string) {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/posts/${id}`, { cache: "no-store" });
    if (r.ok) return r.json();
  } catch {}
  return {
    id, title: "Why Bengaluru's lakes keep frothing", username: "meera_k",
    createdAt: new Date().toISOString(),
    body: "Every winter the same photos circulate: white foam spilling over Varthur's fences…\n\n(Demo article body.)",
    comments: [],
  };
}

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  return (
    <article className="mx-auto max-w-2xl">
      <div className="card p-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tag-question)" }}>
          Community article — written by a user, not Apex-verified news
        </p>
        <h1 className="display text-2xl font-bold leading-snug">{post.title}</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
          @{post.username} · {new Date(post.createdAt).toLocaleDateString()}
        </p>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed">
          {post.body.split("\n\n").map((p: string, i: number) => <p key={i}>{p}</p>)}
        </div>
        <form action={`/api/report`} method="post" className="mt-4 flex flex-wrap items-center gap-2 border-t pt-2"
              style={{ borderColor: "var(--line)" }}>
          <input type="hidden" name="targetType" value="user_post" />
          <input type="hidden" name="targetId" value={post.id} />
          <input name="reason" placeholder="Why are you reporting this? (helps review)"
                 className="min-w-[240px] flex-1 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--line)" }} />
          <button className="text-xs font-semibold" style={{ color: "var(--tag-con)" }}>
            ⚑ Report (copied text, defamation, abuse)
          </button>
        </form>
      </div>
      <CommentThread targetType="user_post" targetId={post.id} initial={post.comments} />
    </article>
  );
}
