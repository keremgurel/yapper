import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** One row per Clerk user. `creditsBalance` and `storageBytes` are running
 * counters kept in sync inside transactions (the ledger is the audit trail). */
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id (e.g. "user_...")
  email: text("email"),
  creditsBalance: integer("credits_balance").notNull().default(0),
  storageBytes: bigint("storage_bytes", { mode: "number" })
    .notNull()
    .default(0),
  // Billing (Stripe). All nullable — a user has no subscription until they
  // start one. subscriptionStatus mirrors Stripe's status verbatim (trialing /
  // active / past_due / canceled / …); entitlement is derived from it +
  // currentPeriodEnd, and only the webhook ever writes these fields.
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status"),
  plan: text("plan"), // plan key from the plans config (e.g. "starter", "pro")
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A user's preferred ASR spellings and the mishearings they explicitly chose
 * to correct. `termKey` is a punctuation/case-insensitive uniqueness key; the
 * display spelling remains untouched in `term`. */
export const transcriptionDictionary = pgTable(
  "transcription_dictionary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    termKey: text("term_key").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("transcription_dictionary_user_term_unique").on(
      t.userId,
      t.termKey,
    ),
    index("transcription_dictionary_user_idx").on(t.userId, t.updatedAt),
  ],
);

export const creditReasons = [
  "welcome_grant",
  "subscription_grant",
  "purchase",
  "deduction",
  "refund",
  "adjustment",
] as const;
export type CreditReason = (typeof creditReasons)[number];

/** Append-only audit log of every credit movement. `balanceAfter` snapshots the
 * user's balance right after this entry so the history is self-verifying. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(), // +grant / -deduction
    reason: text("reason", { enum: creditReasons }).notNull(),
    balanceAfter: integer("balance_after").notNull(),
    submissionId: uuid("submission_id"), // soft link (deductions/refunds)
    // Idempotency key for Stripe-driven grants (invoice / checkout-session id).
    // Nullable-unique: many NULLs allowed (non-Stripe rows), Stripe refs unique,
    // so a redelivered webhook can't grant credits twice.
    stripeRef: text("stripe_ref"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("credit_ledger_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("credit_ledger_stripe_ref_unique").on(t.stripeRef),
    // Enforce the reason vocabulary at the DB, not just in TypeScript.
    check(
      "credit_ledger_reason_check",
      sql`${t.reason} in ('welcome_grant','subscription_grant','purchase','deduction','refund','adjustment')`,
    ),
    // At most one welcome grant per user — double-grants become impossible.
    uniqueIndex("credit_ledger_one_welcome_per_user")
      .on(t.userId)
      .where(sql`${t.reason} = 'welcome_grant'`),
    // At most one refund per submission — a latent guard that keeps any
    // per-submission refund idempotent (no caller today; charging happens on
    // success, so nothing is charged-then-reversed).
    uniqueIndex("credit_ledger_one_refund_per_submission")
      .on(t.submissionId)
      .where(sql`${t.reason} = 'refund'`),
  ],
);

export const submissionKinds = ["audio", "video"] as const;
export type SubmissionKind = (typeof submissionKinds)[number];

export const submissionStatuses = [
  "pending",
  "processing",
  "complete",
  "failed",
] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

/** One AI feedback attempt: its media (R2 key, added in a later phase), the
 * transcript/feedback/scores JSON, and how many bytes/credits it used. */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: submissionKinds }).notNull(),
    status: text("status", { enum: submissionStatuses })
      .notNull()
      .default("pending"),
    title: text("title"),
    creditsCost: integer("credits_cost").notNull().default(0),
    mediaKey: text("media_key"), // R2 object key (Phase 4)
    mediaBytes: bigint("media_bytes", { mode: "number" }).notNull().default(0),
    durationSec: real("duration_sec"),
    transcript: jsonb("transcript"),
    feedback: jsonb("feedback"),
    scores: jsonb("scores"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("submissions_user_idx").on(t.userId, t.createdAt),
    check("submissions_kind_check", sql`${t.kind} in ('audio','video')`),
    check(
      "submissions_status_check",
      sql`${t.status} in ('pending','processing','complete','failed')`,
    ),
  ],
);

export const contentStatuses = [
  "drafted",
  "planned",
  "scheduled",
  "posted",
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

/** A Content Library item: an idea that becomes a structured script (the Lab)
 * and moves through the posting pipeline. `submissionId` links the latest
 * recording of it; `sourceClientId` is the original localStorage id for the
 * one-time import (unique per user so re-imports can't duplicate). */
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    hooks: jsonb("hooks").notNull().default([]),
    points: jsonb("points").notNull().default([]),
    example: text("example").notNull().default(""),
    cta: text("cta").notNull().default(""),
    script: text("script"),
    status: text("status", { enum: contentStatuses })
      .notNull()
      .default("drafted"),
    // The content pillar this idea belongs to (a free-form name, matched to the
    // user's inspiration pillars at capture time).
    pillar: text("pillar"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    sourceClientId: text("source_client_id"),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("content_items_user_idx").on(t.userId, t.updatedAt),
    check(
      "content_items_status_check",
      sql`${t.status} in ('drafted','planned','scheduled','posted')`,
    ),
    // A scheduled item must have a date; enforced at the DB so no API path
    // (create, update, import, future writers) can produce the invalid pairing.
    check(
      "content_items_scheduled_check",
      sql`${t.status} <> 'scheduled' or ${t.scheduledFor} is not null`,
    ),
    uniqueIndex("content_items_import_unique").on(t.userId, t.sourceClientId),
  ],
);

/** The social platforms one edited video can be cross-posted to. Shared by the
 * connection and the job so a job can only target a platform we can connect. */
export const publishPlatforms = ["youtube", "tiktok", "instagram"] as const;
export type PublishPlatform = (typeof publishPlatforms)[number];

export const connectionStatuses = ["active", "revoked", "expired"] as const;
export type ConnectionStatus = (typeof connectionStatuses)[number];

/** One OAuth link between a user and a platform. Tokens are stored encrypted
 * (AES-GCM); only the server ever decrypts them, to refresh or to publish. At
 * most one connection per (user, platform) — reconnecting overwrites in place. */
export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: publishPlatforms }).notNull(),
    // The platform's own id for the connected account/channel, and a display
    // handle for the UI ("@name" / channel title). Both filled at callback.
    externalAccountId: text("external_account_id"),
    handle: text("handle"),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"), // absent when a platform omits it
    scope: text("scope"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: text("status", { enum: connectionStatuses })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_connections_user_platform_unique").on(
      t.userId,
      t.platform,
    ),
    check(
      "platform_connections_platform_check",
      sql`${t.platform} in ('youtube','tiktok','instagram')`,
    ),
    check(
      "platform_connections_status_check",
      sql`${t.status} in ('active','revoked','expired')`,
    ),
  ],
);

export const publishJobStatuses = [
  "queued",
  "uploading",
  "processing",
  "published",
  "failed",
] as const;
export type PublishJobStatus = (typeof publishJobStatuses)[number];

/** One attempt to post one video to one platform. `mediaKey` is the R2 object
 * (the exported MP4) being posted; `externalPostId`/`externalUrl` are filled on
 * success. A single "post everywhere" action creates one row per platform. */
export const publishJobs = pgTable(
  "publish_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optional link back to the Content Library item, so its status can flip to
    // 'posted' when a job publishes. Nulled if the item is later deleted.
    contentItemId: uuid("content_item_id").references(() => contentItems.id, {
      onDelete: "set null",
    }),
    platform: text("platform", { enum: publishPlatforms }).notNull(),
    mediaKey: text("media_key").notNull(),
    status: text("status", { enum: publishJobStatuses })
      .notNull()
      .default("queued"),
    caption: text("caption"),
    title: text("title"),
    externalPostId: text("external_post_id"),
    externalUrl: text("external_url"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("publish_jobs_user_idx").on(t.userId, t.createdAt),
    check(
      "publish_jobs_platform_check",
      sql`${t.platform} in ('youtube','tiktok','instagram')`,
    ),
    check(
      "publish_jobs_status_check",
      sql`${t.status} in ('queued','uploading','processing','published','failed')`,
    ),
  ],
);
