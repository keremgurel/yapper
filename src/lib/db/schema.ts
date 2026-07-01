import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
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
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("credit_ledger_user_idx").on(t.userId, t.createdAt)],
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
  (t) => [index("submissions_user_idx").on(t.userId, t.createdAt)],
);
