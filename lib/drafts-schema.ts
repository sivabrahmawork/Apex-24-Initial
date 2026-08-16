// lib/drafts-schema.ts — additions for the daily AI draft pipeline (Options A+B)
import { pgTable, pgEnum, uuid, text, jsonb, timestamp, date, index } from "drizzle-orm/pg-core";

export const draftStatus = pgEnum("draft_status", ["pending", "published", "discarded"]);
export const draftCategory = pgEnum("draft_category", [
  "world", "tech", "science", "sports", "health", "entertainment",
]);

export const dailyDrafts = pgTable("daily_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftDate: date("draft_date").notNull(),            // one batch per day; history retained forever
  category: draftCategory("category").notNull(),
  headlineRewritten: text("headline_rewritten").notNull(),
  fiveW: jsonb("five_w").$type<Record<string, string>>().notNull(),
  sources: jsonb("sources").$type<{ publisher: string; url: string }[]>().notNull(),
  status: draftStatus("status").notNull().default("pending"),
  openedAt: timestamp("opened_at"),                    // review gate: checkbox locked until non-null
  publishedContentItemId: uuid("published_content_item_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("drafts_date_idx").on(t.draftDate, t.status)]);
