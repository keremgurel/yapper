ALTER TABLE "content_items" ADD COLUMN "editor_revision" text;
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "editor_updated_at" timestamp with time zone;
