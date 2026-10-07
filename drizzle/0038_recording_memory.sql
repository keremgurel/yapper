ALTER TABLE "content_items" ADD COLUMN "memory_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "memory_attempted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "memory_script_manual" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "memory_pillar_manual" boolean DEFAULT false NOT NULL;
