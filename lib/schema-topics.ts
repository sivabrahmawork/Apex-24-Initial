// lib/schema-topics.ts — Phase B addendum: daily topic discovery queue
// Merge into schema.ts exports; migration: drizzle-kit generate.
import { pgTable, pgEnum, uuid, text, date, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const topicCategory = pgEnum("topic_category", [
  "world", "tech", "science", "sports", "health", "entertainment",
]); // NOTE: no india_politics category by product decision (2026-07). Reversal = add enum value + prompt line.

export const topicStatus = pgEnum("topic_status", [
  "candidate",   // discovered, awaiting editor pick
  "selected",    // editor picked → drafting queued
  "drafted",     // draft content_item created, awaiting review/publish
  "dismissed",   // editor rejected
]);

export const topicCandidates = pgTable("topic_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  forDate: date("for_date").notNull(),               // discovery run date (IST)
  category: topicCategory("category").notNull(),
  title: text("title").notNull(),                    // short working title, not the published headline
  rationale: text("rationale").notNull(),            // why it's discussion-worthy (one line)
  seedSources: jsonb("seed_sources").$type<{ publisher: string; url: string }[]>().notNull(),
  status: topicStatus("status").notNull().default("candidate"),
  draftContentItemId: uuid("draft_content_item_id"), // set once drafted
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("topics_date_idx").on(t.forDate, t.status)]);
