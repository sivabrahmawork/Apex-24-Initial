// Apex — Phase (a) database schema (Drizzle ORM, PostgreSQL/Supabase)
// Decisions encoded: personas (1+1 usernames), post-hoc comment classification,
// Pros/Cons >50% min 4, group 75%/100% rule + 72h poll, cached AI summaries (>5 comments),
// RSS-only essay ingestion + link-card submissions, editor-created news, takedown pipeline.

import {
  pgTable, pgEnum, uuid, text, varchar, boolean, integer, real,
  timestamp, jsonb, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
export const contentType = pgEnum("content_type", ["news", "essay"]);
export const contentOrigin = pgEnum("content_origin", ["editor", "rss", "link_submission"]);
export const contentStatus = pgEnum("content_status", ["draft", "published", "takedown"]);
export const userPostType = pgEnum("user_post_type", ["discussion", "article"]);
export const commentTarget = pgEnum("comment_target", ["content_item", "user_post", "group"]);
export const commentLabel = pgEnum("comment_label", ["question", "assumption", "analysis", "pro", "con", "solution"]);
export const queueStatus = pgEnum("queue_status", ["pending", "processing", "done", "failed"]);
export const summaryKind = pgEnum("summary_kind", ["summary", "swot", "pros_cons", "solutions", "assumptions"]);
export const solutionStatus = pgEnum("solution_status", ["discussing", "polling", "published", "failed"]);
export const feedKind = pgEnum("feed_kind", ["substack", "medium", "news_rss"]);
export const takedownStatus = pgEnum("takedown_status", ["open", "removed", "rejected"]);

// ---------- identity ----------
// users = Supabase auth mirror (email OTP). personas = public identities.
// Rule (app-enforced): max 2 personas per user, exactly one is_primary.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = supabase auth.users.id
  email: text("email").notNull().unique(),
  isEditor: boolean("is_editor").notNull().default(false), // admin console access
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  username: varchar("username", { length: 30 }).notNull().unique(),
  isPrimary: boolean("is_primary").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("personas_user_idx").on(t.userId)]);

// ---------- sourced content (NEVER mixed with user posts) ----------
export const contentItems = pgTable("content_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: contentType("type").notNull(),
  origin: contentOrigin("origin").notNull(),
  status: contentStatus("status").notNull().default("draft"),
  headlineRewritten: text("headline_rewritten").notNull(),
  // news: {what,when,where,why,how}; essay: same keys now, swappable labels later.
  fiveW: jsonb("five_w").$type<Record<string, string>>(),
  excerpt: text("excerpt"), // essays only: publisher-provided RSS excerpt, verbatim, length-capped in app
  authorName: text("author_name"),
  createdByUser: uuid("created_by_user").references(() => users.id), // editor, for origin=editor
  submittedByPersona: uuid("submitted_by_persona").references(() => personas.id), // for link_submission
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("content_status_type_idx").on(t.status, t.type, t.publishedAt)]);

// First-class sources → queryable attribution + takedown by publisher.
export const contentSources = pgTable("content_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentItemId: uuid("content_item_id").notNull().references(() => contentItems.id),
  publisher: text("publisher").notNull(),
  author: text("author"),
  url: text("url").notNull(),
  accessedAt: timestamp("accessed_at").notNull().defaultNow(),
}, (t) => [index("sources_item_idx").on(t.contentItemId), index("sources_publisher_idx").on(t.publisher)]);

// ---------- ingestion (RSS only; no scraping code paths exist) ----------
export const feedSources = pgTable("feed_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: feedKind("kind").notNull(),
  feedUrl: text("feed_url").notNull().unique(),
  publisher: text("publisher").notNull(),
  enabled: boolean("enabled").notNull().default(true), // news_rss rows ship disabled (AGGREGATION_ENABLED gate)
  lastPolledAt: timestamp("last_polled_at"),
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedSourceId: uuid("feed_source_id").notNull().references(() => feedSources.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  itemsFound: integer("items_found").notNull().default(0),
  itemsCreated: integer("items_created").notNull().default(0),
  error: text("error"),
});

export const takedownRequests = pgTable("takedown_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentItemId: uuid("content_item_id").notNull().references(() => contentItems.id),
  requesterEmail: text("requester_email").notNull(),
  reason: text("reason"),
  status: takedownStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"), // SLA: 24h, enforced by ops
});

// ---------- user content ----------
export const userPosts = pgTable("user_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id").notNull().references(() => personas.id),
  type: userPostType("type").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("user_posts_persona_idx").on(t.personaId)]);

// ---------- comments + post-hoc classification ----------
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id").notNull().references(() => personas.id),
  targetType: commentTarget("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  parentId: uuid("parent_id"), // self-ref thread
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("comments_target_idx").on(t.targetType, t.targetId, t.createdAt)]);

export const commentClassifications = pgTable("comment_classifications", {
  commentId: uuid("comment_id").primaryKey().references(() => comments.id),
  label: commentLabel("label").notNull(),
  confidence: real("confidence").notNull(),
  modelVersion: text("model_version").notNull(),
  userCorrected: boolean("user_corrected").notNull().default(false),
  correctedLabel: commentLabel("corrected_label"), // effective label = correctedLabel ?? label
  classifiedAt: timestamp("classified_at").notNull().defaultNow(),
});

export const classificationQueue = pgTable("classification_queue", {
  commentId: uuid("comment_id").primaryKey().references(() => comments.id),
  status: queueStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Pros/Cons badge is COMPUTED on read (no table):
//   replies with effective label in (pro, con) >= 4  →  pros_high if pro_share > 0.5, cons_high if con_share > 0.5.

// ---------- cached AI thread summaries (unlocked at >5 comments) ----------
export const threadSummaries = pgTable("thread_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: commentTarget("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  kind: summaryKind("kind").notNull(),
  content: jsonb("content").notNull(),
  commentsAtGeneration: integer("comments_at_generation").notNull(), // regenerate only when count grows ≥ +5
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("summary_unique_idx").on(t.targetType, t.targetId, t.kind)]);

// ---------- groups: discuss → poll (72h) → publish ----------
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 60 }).notNull(),
  description: varchar("description", { length: 100 }).notNull(),
  createdByPersona: uuid("created_by_persona").notNull().references(() => personas.id),
  shareToken: uuid("share_token").notNull().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groups.id),
  personaId: uuid("persona_id").notNull().references(() => personas.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.groupId, t.personaId] })]);

export const groupSolutions = pgTable("group_solutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id),
  proposedByPersona: uuid("proposed_by_persona").notNull().references(() => personas.id),
  body: text("body").notNull(),
  status: solutionStatus("status").notNull().default("discussing"),
  pollOpensAt: timestamp("poll_opens_at"),
  pollClosesAt: timestamp("poll_closes_at"), // opensAt + 72h
  eligibleCount: integer("eligible_count"),  // members snapshot at poll start
  thresholdPct: integer("threshold_pct"),    // 100 if eligibleCount < 4 else 75
  publishedContentItemId: uuid("published_content_item_id").references(() => contentItems.id),
});

export const solutionVotes = pgTable("solution_votes", {
  solutionId: uuid("solution_id").notNull().references(() => groupSolutions.id),
  personaId: uuid("persona_id").notNull().references(() => personas.id),
  approve: boolean("approve").notNull(),
  votedAt: timestamp("voted_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.solutionId, t.personaId] })]);

// ---------- chat (1:1, text only, persona-scoped) ----------
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationParticipants = pgTable("conversation_participants", {
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  personaId: uuid("persona_id").notNull().references(() => personas.id),
}, (t) => [primaryKey({ columns: [t.conversationId, t.personaId] })]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  senderPersonaId: uuid("sender_persona_id").notNull().references(() => personas.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("messages_convo_idx").on(t.conversationId, t.createdAt)]);

// ---------- follows (persona → persona) ----------
export const follows = pgTable("follows", {
  followerPersonaId: uuid("follower_persona_id").notNull().references(() => personas.id),
  followedPersonaId: uuid("followed_persona_id").notNull().references(() => personas.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.followerPersonaId, t.followedPersonaId] })]);
