// lib/claude.ts — single chokepoint for all model calls (cost visibility from day one)
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { sql } from "drizzle-orm";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const MODELS = {
  classify: "claude-haiku-4-5-20251001", // cheap, per-comment
  summarize: "claude-sonnet-4-6",        // per-thread, cached, quality matters
} as const;

export async function claudeJSON<T>(opts: {
  purpose: "classify" | "summarize" | "headline_rewrite";
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system + "\nRespond with ONLY valid JSON. No preamble, no markdown fences.",
    messages: [{ role: "user", content: opts.user }],
  });
  const text = res.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
  // cost log (raw SQL table ai_calls: purpose, model, in_tokens, out_tokens, ms)
  await db.execute(sql`insert into ai_calls (purpose, model, in_tokens, out_tokens, ms)
    values (${opts.purpose}, ${opts.model}, ${res.usage.input_tokens}, ${res.usage.output_tokens}, ${Date.now() - t0})`);
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as T;
}
