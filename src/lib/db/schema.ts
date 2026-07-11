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
    // At most one refund per submission — makes refunds idempotent so the
    // inline catch and the reconciliation sweep can never double-refund.
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
