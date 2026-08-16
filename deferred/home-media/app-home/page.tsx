"use client";
// app/home/page.tsx — Home: user photo/carousel posts (Instagram-style composer + feed).
// Fences: images only (video deferred); every image passes the Claude vision screen server-side
// before publish (fail-closed); posts inherit the standard report/takedown rail.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type MediaPost = {
  id: string; username: string; caption: string; createdAt: string;
  media: { url: string }[]; likes: number; dislikes: number; commentCount: number;
};

export default function Home() {
  const [posts, setPosts] = useState<MediaPost[]>(DEMO);

  useEffect(() => {
    fetch("/api/posts?type=media").then(r => r.ok ? r.json() : { posts: DEMO })
      .catch(() => ({ posts: DEMO })).then(d => setPosts(d.posts?.length ? d.posts : DEMO));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="display text-2xl font-bold">Home</h1>
        <span className="text-xs" style={{ color: "var(--ink-soft)" }}>photos & carousels · video coming later</span>
      </div>
      <Composer onPosted={p => setPosts(ps => [p, ...ps])} />
      {posts.map(p => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

function Composer({ onPosted }: { onPosted: (p: MediaPost) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function post() {
    if (!files.length) return setMsg("Add at least one photo.");
    setBusy(true); setMsg(null);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, 10)) {           // carousel cap: 10, like the reference apps
        const path = `media/${crypto.randomUUID()}-${f.name}`;
        const { error } = await supabase.storage.from("media").upload(path, f, { upsert: false });
        if (error) throw new Error(error.message);
        urls.push(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
      }
      // server screens each image (Claude vision, fail-closed) then creates the post
      const res = await fetch("/api/posts/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, urls }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Blocked by image screen.");
      onPosted({ id: j.id, username: "you", caption, createdAt: new Date().toISOString(),
                 media: urls.map(u => ({ url: u })), likes: 0, dislikes: 0, commentCount: 0 });
      setFiles([]); setCaption("");
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="card space-y-2 p-3">
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple
             onChange={e => setFiles([...(e.target.files ?? [])])} className="text-xs" />
      <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2}
                placeholder="Write a caption…" className="w-full resize-none rounded border px-2 py-1 text-sm"
                style={{ borderColor: "var(--line)" }} />
      <div className="flex items-center gap-3">
        <button onClick={post} disabled={busy}
                className="rounded-lg px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}>{busy ? "Screening & posting…" : "Post"}</button>
        <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
          {files.length ? `${Math.min(files.length, 10)} photo(s)` : "JPEG/PNG/WebP · every image is safety-screened"}
        </span>
      </div>
      {msg && <p className="text-xs font-medium" style={{ color: "var(--tag-con)" }}>{msg}</p>}
    </div>
  );
}

function PostCard({ post }: { post: MediaPost }) {
  const [i, setI] = useState(0);
  const [reaction, setReaction] = useState<null | boolean>(null);
  const n = post.media.length;

  async function react(liked: boolean) {
    setReaction(r => (r === liked ? null : liked));
    await fetch(`/api/posts/${post.id}/react`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked }),
    }).catch(() => {});
  }

  return (
    <article className="card overflow-hidden">
      <p className="px-3 pt-2 text-sm font-semibold">@{post.username}</p>
      <div className="relative mt-1">
        <img src={post.media[i]?.url} alt="" className="max-h-[480px] w-full object-cover" />
        {n > 1 && (
          <>
            <button onClick={() => setI(x => (x - 1 + n) % n)}
                    className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2">‹</button>
            <button onClick={() => setI(x => (x + 1) % n)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2">›</button>
            <span className="absolute bottom-1 right-2 rounded bg-black/60 px-1.5 text-[10px] text-white">
              {i + 1}/{n}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4 px-3 py-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
        <button onClick={() => react(true)} style={reaction === true ? { color: "var(--tag-pro)" } : {}}>
          ♥ {post.likes + (reaction === true ? 1 : 0)}
        </button>
        <button onClick={() => react(false)} style={reaction === false ? { color: "var(--tag-con)" } : {}}>
          ↓ {post.dislikes + (reaction === false ? 1 : 0)}
        </button>
        <Link href={`/posts/${post.id}`} style={{ color: "var(--accent)" }}>
          {post.commentCount} comments
        </Link>
        <form action="/api/report" method="post" className="ml-auto">
          <input type="hidden" name="targetType" value="user_post" />
          <input type="hidden" name="targetId" value={post.id} />
          <button style={{ color: "var(--tag-con)" }}>⚑</button>
        </form>
      </div>
      {post.caption && <p className="px-3 pb-3 text-sm"><b>@{post.username}</b> {post.caption}</p>}
    </article>
  );
}

const DEMO: MediaPost[] = [{
  id: "m1", username: "meera_k", caption: "Varthur lake at sunrise — froth is back.",
  createdAt: new Date().toISOString(),
  media: [{ url: "https://placehold.co/800x500/eef0fc/3d4ec7?text=Photo+1" },
          { url: "https://placehold.co/800x500/eef0fc/3d4ec7?text=Photo+2" }],
  likes: 14, dislikes: 1, commentCount: 3,
}];
