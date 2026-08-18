ALTER TABLE "submissions" ADD COLUMN "surface" text DEFAULT 'studio' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "context" jsonb;--> statement-breakpoint
CREATE INDEX "submissions_surface_idx" ON "submissions" USING btree ("user_id","surface","created_at");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_surface_check" CHECK ("submissions"."surface" in ('studio','training'));