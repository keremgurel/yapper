-- People apply to the Studio private beta, an admin approves them, and each
-- approved tester gets a personal access code. Only the code's hash is stored.
CREATE TABLE IF NOT EXISTS "studio_beta_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"link" text,
	"use_case" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"access_code_hash" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_beta_applications_email_unique" UNIQUE("email"),
	CONSTRAINT "studio_beta_applications_status_check" CHECK ("studio_beta_applications"."status" in ('pending','approved','rejected','revoked'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "studio_beta_applications_status_idx" ON "studio_beta_applications" USING btree ("status","created_at");
