ALTER TABLE "content_items" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "stage" text DEFAULT 'library' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "original_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "idea_type" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "pillar_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source_transcript" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source_summary" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source_reference_type" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source_platform" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "transcript_status" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_pillar_id_project_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."project_pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_items_stage_idx" ON "content_items" USING btree ("user_id","stage","updated_at");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_stage_check" CHECK ("content_items"."stage" in ('bank','library'));--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_idea_type_check" CHECK ("content_items"."idea_type" is null or "content_items"."idea_type" in ('original','semi-original','inspiration'));--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_transcript_status_check" CHECK ("content_items"."transcript_status" is null or "content_items"."transcript_status" in ('ready','pending','needs_media','unavailable'));