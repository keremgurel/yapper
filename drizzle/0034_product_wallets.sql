-- Yapper Studio and Yapper Train are sold separately. Train gets its own wallet
-- and subscription mirror on the user row, and every ledger entry records which
-- wallet moved. Additive only: no balance, plan or ledger row is rewritten.
-- Existing rows default to Studio, which is what every earlier purchase was.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "train_credits_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "train_subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "train_plan" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "train_current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "product" text DEFAULT 'studio' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_product_check";--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_product_check" CHECK ("credit_ledger"."product" in ('studio','train'));
