ALTER TABLE "credit_ledger" ADD COLUMN "stripe_ref" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_stripe_ref_unique" ON "credit_ledger" USING btree ("stripe_ref");