// middleware.ts — hardening layer: per-IP rate limiting on APIs + security headers on every response.
// In-memory buckets are per-instance (fine for pilot on one Vercel region; swap to Upstash at scale).
import { NextRequest, NextResponse } from "next/server";

const buckets = new Map<string, { n: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMITS: [RegExp, number][] = [
  [/^\/api\/auth/, 10],        // OTP endpoints: strictest (credential-stuffing surface)
  [/^\/api\/translate/, 30],
  [/^\/api\/(comments|posts|react|report|polls)/, 60],
  [/^\/api\//, 120],
];

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = LIMITS.find(([re]) => re.test(req.nextUrl.pathname))?.[1] ?? 120;
    const key = `${ip}:${limit}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || now - b.ts > WINDOW_MS) buckets.set(key, { n: 1, ts: now });
    else if (++b.n > limit)
      return NextResponse.json({ error: "rate limit — slow down" }, { status: 429 });
    if (buckets.size > 10_000) buckets.clear(); // memory guard
  }
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");                       // clickjacking
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon).*)"] };
