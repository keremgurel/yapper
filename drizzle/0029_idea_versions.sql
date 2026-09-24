ALTER TABLE "content_items" ADD COLUMN "lead_format" text DEFAULT 'short' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_lead_format_check" CHECK ("content_items"."lead_format" in ('short','long','article'));--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_format" text DEFAULT 'short' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_format_check" CHECK ("projects"."default_format" in ('short','long','article'));--> statement-breakpoint
ALTER TABLE "project_skills" ADD COLUMN "formats" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"format" text NOT NULL,
	"title" text,
	"hooks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"script" text,
	"written_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_versions_format_check" CHECK ("content_versions"."format" in ('short','long','article')),
	CONSTRAINT "content_versions_written_from_check" CHECK ("content_versions"."written_from" is null or "content_versions"."written_from" in ('short','long','article'))
);--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_versions_item_format_unique" ON "content_versions" USING btree ("content_item_id","format");
