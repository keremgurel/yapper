import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
  plan: text("plan"), // plan key from the plans config (e.g. "creator_monthly")
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

/** Which half of the product a submission came from. */
export const submissionSurfaces = ["studio", "training"] as const;
export type SubmissionSurface = (typeof submissionSurfaces)[number];
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
    /**
     * Which part of the product produced this rep. Studio submissions coach a
     * clip a creator is about to post; training submissions coach a practice
     * answer and also judge the English. The progress dashboard and the
     * Studio history read the same table, so they need to be told apart.
     */
    surface: text("surface", { enum: submissionSurfaces })
      .notNull()
      .default("studio"),
    /** What the speaker was answering: drill, prompt, timer. Shape lives in
     * `TrainingContext` (src/lib/training-feedback/types.ts). */
    context: jsonb("context"),
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
    index("submissions_surface_idx").on(t.userId, t.surface, t.createdAt),
    check("submissions_kind_check", sql`${t.kind} in ('audio','video')`),
    check(
      "submissions_surface_check",
      sql`${t.surface} in ('studio','training')`,
    ),
    check(
      "submissions_status_check",
      sql`${t.status} in ('pending','processing','complete','failed')`,
    ),
  ],
);

/**
 * A creator's project: the standing context every AI call needs in order to
 * write like them rather than like a generic content bot. One row per user
 * today (`getActiveProject` creates it on first sight), but the table is keyed
 * so a future account switcher is a UI change and not a data migration.
 *
 * `contextVersion` is bumped on every write and used as the cache key for the
 * compiled context block, so the block is rebuilt only when the brain changes.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    // Every field is free text on purpose: a creator describes their own
    // account better than any set of enums we could invent for them.
    whatIMake: text("what_i_make").notNull().default(""),
    audience: text("audience").notNull().default(""),
    voice: text("voice").notNull().default(""),
    offers: text("offers").notNull().default(""),
    doNots: text("do_nots").notNull().default(""),
    links: jsonb("links").$type<string[]>().notNull().default([]),
    /** Ordered swatches for generated graphics. The first colour is primary. */
    brandColors: jsonb("brand_colors").$type<string[]>().notNull().default([]),
    contextVersion: integer("context_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One project per user, for now. This is what makes `getActiveProject`'s
    // get-or-create race-safe (ON CONFLICT DO NOTHING needs a conflict target),
    // so two concurrent first requests cannot both insert. Adding the account
    // switcher later drops this one index; it is not a data migration.
    uniqueIndex("projects_user_unique").on(t.userId),
  ],
);

/** Logos a creator wants Chirpy to use when it creates branded visuals. */
export const brandAssets = pgTable(
  "brand_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mediaKey: text("media_key").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    mediaBytes: bigint("media_bytes", { mode: "number" }).notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("brand_assets_media_key_unique").on(t.mediaKey),
    index("brand_assets_project_idx").on(t.projectId, t.sortOrder),
    check("brand_assets_media_bytes_check", sql`${t.mediaBytes} >= 0`),
  ],
);

/**
 * One content pillar. Unlike the free-text `contentItems.pillar` it replaces, a
 * pillar carries a description and example angles, which is what lets the model
 * classify into it and write for it instead of pattern-matching on a bare name.
 */
export const projectPillars = pgTable(
  "project_pillars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    examples: jsonb("examples").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("project_pillars_project_idx").on(t.projectId, t.sortOrder),
    // Two pillars with the same name would make classification ambiguous and
    // the reconciliation of legacy free-text pillars non-deterministic.
    uniqueIndex("project_pillars_name_unique").on(t.projectId, t.name),
  ],
);

/** How a brain block holds what it holds. `note` is prose and `list` is lines
 * the creator collects; `table` is imported rows (keyword research, a content
 * gap export) and `doc` is a long pasted document that is chunked rather than
 * read whole. */
export const brainBlockKinds = ["note", "list", "table", "doc"] as const;
export type BrainBlockKind = (typeof brainBlockKinds)[number];

/**
 * How much of a block reaches a prompt, and when.
 *
 * This is the whole contract that lets the brain hold more than a prompt can.
 * `core` is identity-grade truth that every writing prompt carries. `auto` is
 * routable: its one-line digest is always visible, its contents load only for
 * the task that needs them. `manual` is loaded only when the creator attaches
 * it by hand. `private` never leaves the page.
 */
export const brainBlockUsages = ["core", "auto", "manual", "private"] as const;
export type BrainBlockUsage = (typeof brainBlockUsages)[number];

/** An imported grid, as it is stored. Ragged rows are padded on ingest so a
 * row's nth cell always belongs to the nth column. */
export interface BrainTable {
  columns: string[];
  rows: string[][];
}

/**
 * One section of the creator's brain, written by them.
 *
 * The fixed project fields (what I make, who it's for, how I sound) answer the
 * questions everyone has. These answer the ones only this creator has: why they
 * are posting at all, what they are actually chasing, the hooks that keep
 * working, the formats they trust, the rule they keep breaking. Free-form on
 * purpose, because a brain that shipped as a fixed form would be the same brain
 * for everybody, and the whole point is that it is theirs.
 *
 * `digest` is the one line that is always in the prompt, even for a block whose
 * body never loads. It is what makes an unbounded brain compile into a bounded
 * prompt: the model always knows the block exists and what it is for, and pays
 * for the contents only when the task calls for them.
 */
export const projectBrainBlocks = pgTable(
  "project_brain_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").$type<BrainBlockKind>().notNull().default("note"),
    body: text("body").notNull().default(""),
    items: jsonb("items").$type<string[]>().notNull().default([]),
    /** Rows for a `table` block. Null for every other kind. */
    rows: jsonb("rows").$type<BrainTable | null>(),
    /** One line: what this is and when it matters. Always in the prompt. */
    digest: text("digest").notNull().default(""),
    usage: text("usage").$type<BrainBlockUsage>().notNull().default("auto"),
    /** Routing hints, and how the page groups sections. */
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** Where an imported block came from, in the creator's words. */
    sourceLabel: text("source_label").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    /** Total size of the block's contents, so the budget meter does not have to
     * recompute it for every row on every render. */
    charCount: integer("char_count").notNull().default(0),
    /** @deprecated Superseded by `usage`; kept for one release so a rollback
     * does not lose which blocks were private. Nothing reads it. */
    inContext: boolean("in_context").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("project_brain_blocks_project_idx").on(t.projectId, t.sortOrder),
  ],
);

/**
 * A slice of a `doc` block.
 *
 * A pasted research document is worth keeping whole and worth never sending
 * whole. Chunks are what the compiler actually selects from: the router picks
 * the block, then the chunks that overlap the task are the ones that spend
 * prompt budget.
 */
export const projectBrainChunks = pgTable(
  "project_brain_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => projectBrainBlocks.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull().default(0),
    /** The heading this slice sat under, when the source had one. */
    heading: text("heading").notNull().default(""),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull().default(0),
  },
  (t) => [index("project_brain_chunks_block_idx").on(t.blockId, t.ord)],
);

/** The prompts a skill can apply to. One vocabulary, shared by the catalog, the
 * creator's installed skills, and the compiler's budgets. */
export const brainSurfaces = [
  "ideate",
  "hooks",
  "script",
  "caption",
  "expand",
  "chat",
  "capture",
] as const;
export type BrainSurface = (typeof brainSurfaces)[number];

/**
 * A skill the creator has installed or written.
 *
 * A block states a fact; a skill states a procedure. "When you write a script
 * for me, open on the turn and hold the reveal until the last five seconds" is
 * not something the fixed fields can hold, and it is the half of the brain that
 * changes what the output looks like rather than who it sounds like.
 *
 * Installing from the catalog copies the text rather than referencing it, so
 * the creator owns their copy and a catalog edit never rewrites a brain behind
 * someone's back. `catalogVersion` is what surfaces "update available", and
 * `customized` is what makes that update ask first.
 */
export const projectSkills = pgTable(
  "project_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Null for a skill the creator wrote themselves. */
    catalogSlug: text("catalog_slug"),
    catalogVersion: integer("catalog_version"),
    name: text("name").notNull(),
    /** The line the router reads when deciding whether to load this. */
    whenToUse: text("when_to_use").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    surfaces: jsonb("surfaces").$type<BrainSurface[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    /** Set the first time the creator edits an installed skill. */
    customized: boolean("customized").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("project_skills_project_idx").on(t.projectId, t.sortOrder),
    // Installing the same catalog entry twice updates the copy rather than
    // leaving two of it in the brain.
    uniqueIndex("project_skills_catalog_unique").on(t.projectId, t.catalogSlug),
  ],
);

/** A catalog entry is either a procedure to install as a skill, or a starting
 * section to install as a context block. */
export const catalogEntryKinds = ["skill", "context"] as const;
export type CatalogEntryKind = (typeof catalogEntryKinds)[number];

/**
 * The skill catalog: what a creator can browse and install.
 *
 * In the database rather than in the repo so entries can be written, edited and
 * published without a deploy. Seeded by migration so the shelf is never empty
 * on a fresh install, and versioned so an improved entry can offer itself to
 * the brains that already took a copy.
 */
export const skillCatalog = pgTable(
  "skill_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    version: integer("version").notNull().default(1),
    kind: text("kind").$type<CatalogEntryKind>().notNull().default("skill"),
    name: text("name").notNull(),
    /** One line on the browse card. */
    tagline: text("tagline").notNull().default(""),
    whenToUse: text("when_to_use").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    surfaces: jsonb("surfaces").$type<BrainSurface[]>().notNull().default([]),
    category: text("category").notNull().default(""),
    published: boolean("published").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("skill_catalog_slug_unique").on(t.slug),
    index("skill_catalog_browse_idx").on(t.published, t.sortOrder),
  ],
);

export const contentStatuses = [
  "drafted",
  "planned",
  "scheduled",
  "posted",
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

/** Which surface an item lives on. `bank` is the Idea Bank inbox, `library` the
 * pipeline you actually shoot. Sending an idea to the library is a stage flip,
 * not a copy, so nothing about it is transformed on the way. */
export const contentStages = ["bank", "library"] as const;
export type ContentStage = (typeof contentStages)[number];

/** What kind of idea this is, derived from what the creator dropped in. */
export const ideaTypes = ["original", "semi-original", "inspiration"] as const;
export type IdeaTypeValue = (typeof ideaTypes)[number];

/** Whether we have the reference's actual words. Reported honestly rather than
 * silently degrading a video to a page summary. */
export const transcriptStatuses = [
  "ready",
  "pending",
  "needs_media",
  "unavailable",
] as const;
export type TranscriptStatus = (typeof transcriptStatuses)[number];

/** One flexible body block. Labels are free-form on purpose: an audio-led
 * sketch needs "Joke mechanics", an explainer needs "Argument". */
export interface ContentBlock {
  label: string;
  kind: "paragraph" | "bullets" | "steps" | "script";
  text?: string;
  items?: string[];
}

/** A hook variation. `pattern` names the archetype it uses and `why` explains
 * the mechanism, so a creator can see why it should work. Legacy rows hold
 * plain strings; the normalizer widens those on read. */
export interface ContentHook {
  text: string;
  pattern?: string | null;
  why?: string | null;
}

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
    // The project this belongs to. Nullable so the column could be added to
    // existing rows without a backfill window; every new write sets it.
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    /**
     * Which surface this sits on. Defaults to `library` so that adding the
     * column left every pre-existing row (all of which were library items)
     * correctly classified. Idea capture passes `bank` explicitly.
     */
    stage: text("stage", { enum: contentStages }).notNull().default("library"),
    title: text("title").notNull().default(""),
    /** Hook variations. `ContentHook[]` going forward, `string[]` on legacy
     * rows; read through `normalizeItem` rather than directly. */
    hooks: jsonb("hooks")
      .$type<ContentHook[] | string[]>()
      .notNull()
      .default([]),
    /** The flexible body: whatever blocks fit THIS idea. */
    blocks: jsonb("blocks").$type<ContentBlock[]>().notNull().default([]),
    /**
     * The creator's exact words, verbatim and immutable. Never regenerated,
     * never paraphrased. Everything else about an item can be rebuilt by AI;
     * this cannot, so it is the one field nothing is allowed to overwrite.
     */
    originalNote: text("original_note").notNull().default(""),
    /** The source's actual creative form, not a forced content bucket. */
    format: text("format"),
    /** The read on the reference and the intended adaptation angle. */
    summary: text("summary"),
    /**
     * What this will be published as: short, long, article, thread and so on.
     * An array because one angle often ships as several things. Distinct from
     * `format` above, which is the AI's read on the SOURCE's creative shape;
     * this one is the creator's distribution decision.
     */
    formats: jsonb("formats").$type<string[]>().notNull().default([]),
    ideaType: text("idea_type", { enum: ideaTypes }),
    // Legacy body columns. Read through the normalizer for old rows; never
    // written again, and dropped once nothing falls back to them.
    points: jsonb("points").notNull().default([]),
    example: text("example").notNull().default(""),
    cta: text("cta").notNull().default(""),
    script: text("script"),
    status: text("status", { enum: contentStatuses })
      .notNull()
      .default("drafted"),
    // The content pillar this idea belongs to (a free-form name, matched to the
    // user's inspiration pillars at capture time). Superseded by pillarId;
    // retained so legacy rows keep their classification until reconciled.
    pillar: text("pillar"),
    pillarId: uuid("pillar_id").references(() => projectPillars.id, {
      onDelete: "set null",
    }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    /** The reference's complete spoken transcript, verbatim, never AI-rewritten.
     * Previously client-only; without it, moving ideas to the server would lose
     * the single most valuable thing an idea carries. */
    sourceTranscript: text("source_transcript"),
    /** A faithful summary, for articles and papers that never had dialogue. */
    sourceSummary: text("source_summary"),
    sourceReferenceType: text("source_reference_type"),
    sourcePlatform: text("source_platform"),
    transcriptStatus: text("transcript_status", { enum: transcriptStatuses }),
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
    // Both surfaces list by stage, so the stage leads the index.
    index("content_items_stage_idx").on(t.userId, t.stage, t.updatedAt),
    check(
      "content_items_status_check",
      sql`${t.status} in ('drafted','planned','scheduled','posted')`,
    ),
    check("content_items_stage_check", sql`${t.stage} in ('bank','library')`),
    check(
      "content_items_idea_type_check",
      sql`${t.ideaType} is null or ${t.ideaType} in ('original','semi-original','inspiration')`,
    ),
    check(
      "content_items_transcript_status_check",
      sql`${t.transcriptStatus} is null or ${t.transcriptStatus} in ('ready','pending','needs_media','unavailable')`,
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
    // One browser-created intent maps to exactly one platform operation. A
    // nullable column keeps historical jobs decodable while every new route
    // claim supplies a key.
    idempotencyKey: text("idempotency_key"),
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
    uniqueIndex("publish_jobs_user_platform_idempotency_unique").on(
      t.userId,
      t.platform,
      t.idempotencyKey,
    ),
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

/**
 * One of the creator's own platform posts whose video file we pulled back into
 * their storage, so it can be cross-posted.
 *
 * This exists to make that pull happen once. Recovering the file for a post
 * published outside Yapper costs a metered third-party lookup, and without a
 * record of the result every re-post of the same video pays for it again. The
 * unique index is the whole point: one row per (user, platform, post).
 *
 * Distinct from `publish_jobs.media_key`, which is the original Yapper already
 * held because the post went out through the app. Both answer "can this post be
 * reused", from opposite directions.
 */
export const importedPlatformMedia = pgTable(
  "imported_platform_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: publishPlatforms }).notNull(),
    /** The platform's own id for the post the file came from. */
    externalPostId: text("external_post_id").notNull(),
    mediaKey: text("media_key").notNull(),
    /** Actual object size at registration time. Imported media participates in
     * the same storage counter as recordings, so every durable reference keeps
     * the byte value needed for deletion and reconciliation. */
    mediaBytes: bigint("media_bytes", { mode: "number" }).notNull().default(0),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("imported_platform_media_post_unique").on(
      t.userId,
      t.platform,
      t.externalPostId,
    ),
    check(
      "imported_platform_media_platform_check",
      sql`${t.platform} in ('youtube','tiktok','instagram')`,
    ),
  ],
);

export const r2ObjectPurposes = [
  "recording",
  "import",
  "thumbnail",
  "brand_logo",
] as const;
export type R2ObjectPurpose = (typeof r2ObjectPurposes)[number];

export const r2ObjectStates = [
  "pending_upload",
  "active",
  "delete_pending",
  "deleting",
  "deleted",
] as const;
export type R2ObjectState = (typeof r2ObjectStates)[number];

/**
 * Durable lifecycle state for every R2 object Yapper knows about.
 *
 * `userId` intentionally has no foreign key: account deletion removes the
 * owner row before the asynchronous R2 delete is guaranteed to finish, and the
 * deletion record must survive that cascade. `mediaKey` is the identity of the
 * physical object and therefore the primary key rather than an incidental
 * surrogate id.
 */
export const r2Objects = pgTable(
  "r2_objects",
  {
    mediaKey: text("media_key").primaryKey(),
    userId: text("user_id").notNull(),
    purpose: text("purpose", { enum: r2ObjectPurposes }).notNull(),
    state: text("state", { enum: r2ObjectStates }).notNull(),
    mediaBytes: bigint("media_bytes", { mode: "number" }).notNull().default(0),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    deleteNotBefore: timestamp("delete_not_before", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    deleteReason: text("delete_reason"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("r2_objects_state_attempt_idx").on(t.state, t.nextAttemptAt),
    index("r2_objects_user_state_idx").on(t.userId, t.state),
    check(
      "r2_objects_purpose_check",
      sql`${t.purpose} in ('recording','import','thumbnail','brand_logo')`,
    ),
    check(
      "r2_objects_state_check",
      sql`${t.state} in ('pending_upload','active','delete_pending','deleting','deleted')`,
    ),
    check("r2_objects_media_bytes_check", sql`${t.mediaBytes} >= 0`),
    check("r2_objects_attempts_check", sql`${t.attempts} >= 0`),
    check(
      "r2_objects_lease_check",
      sql`(${t.state} = 'deleting' and ${t.leaseToken} is not null and ${t.leaseExpiresAt} is not null) or (${t.state} <> 'deleting' and ${t.leaseToken} is null and ${t.leaseExpiresAt} is null)`,
    ),
    check(
      "r2_objects_deleted_at_check",
      sql`(${t.state} = 'deleted' and ${t.deletedAt} is not null) or (${t.state} <> 'deleted' and ${t.deletedAt} is null)`,
    ),
    check(
      "r2_objects_upload_expiry_check",
      sql`${t.state} <> 'pending_upload' or ${t.uploadExpiresAt} is not null`,
    ),
  ],
);

/** Cross-instance token buckets. Subjects are opaque HMACs rather than raw
 * user ids, email addresses, or network addresses. There is deliberately no
 * user FK: public subjects have no user row and short-lived abuse protection
 * should survive account deletion until expiry. */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    scope: text("scope").notNull(),
    subjectHash: text("subject_hash").notNull(),
    tokens: doublePrecision("tokens").notNull(),
    capacity: integer("capacity").notNull(),
    refillPerSecond: doublePrecision("refill_per_second").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.subjectHash] }),
    index("rate_limit_buckets_expiry_idx").on(t.expiresAt),
    check("rate_limit_buckets_tokens_check", sql`${t.tokens} >= 0`),
    check(
      "rate_limit_buckets_token_capacity_check",
      sql`${t.tokens} <= ${t.capacity}`,
    ),
    check("rate_limit_buckets_capacity_check", sql`${t.capacity} > 0`),
    check("rate_limit_buckets_refill_check", sql`${t.refillPerSecond} > 0`),
  ],
);

/** How a saved view renders its rows. */
export const libraryViewKinds = ["table", "board"] as const;
export type LibraryViewKind = (typeof libraryViewKinds)[number];

/** The axes a view can group or split by. `null` means one flat list. */
export const libraryGroupings = ["status", "pillar", "format"] as const;
export type LibraryGrouping = (typeof libraryGroupings)[number];

/**
 * A saved way of looking at the library, per creator.
 *
 * Server-backed rather than kept in the browser. Views are real preferences a
 * creator builds up over time, and this project has just finished moving ideas
 * out of localStorage precisely because that storage silently loses things and
 * does not follow you between devices; putting views there would repeat the
 * mistake on a smaller scale.
 *
 * `filters` and `columns` are jsonb because both are lists of ids from
 * source-defined vocabularies (statuses, pillars, formats, column keys) that
 * will keep growing, and neither is ever queried by the database.
 */
export const libraryViews = pgTable(
  "library_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: libraryViewKinds }).notNull().default("table"),
    /** Which surface it belongs to: the bank or the library. */
    stage: text("stage", { enum: contentStages }).notNull().default("library"),
    groupBy: text("group_by", { enum: libraryGroupings }),
    /** `{ status?: string[], pillarId?: string[], formats?: string[] }` */
    filters: jsonb("filters")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    /** Visible column keys, in order. Empty means the surface's default set. */
    columns: jsonb("columns").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("library_views_user_idx").on(t.userId, t.stage, t.sortOrder),
    check("library_views_kind_check", sql`${t.kind} in ('table','board')`),
    check(
      "library_views_group_check",
      sql`${t.groupBy} is null or ${t.groupBy} in ('status','pillar','format')`,
    ),
  ],
);
