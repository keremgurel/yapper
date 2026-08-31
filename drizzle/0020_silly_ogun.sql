CREATE TABLE "brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"media_key" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"media_bytes" bigint DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_assets_media_bytes_check" CHECK ("brand_assets"."media_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "r2_objects" DROP CONSTRAINT "r2_objects_purpose_check";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "brand_colors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_assets_media_key_unique" ON "brand_assets" USING btree ("media_key");--> statement-breakpoint
CREATE INDEX "brand_assets_project_idx" ON "brand_assets" USING btree ("project_id","sort_order");--> statement-breakpoint
ALTER TABLE "r2_objects" ADD CONSTRAINT "r2_objects_purpose_check" CHECK ("r2_objects"."purpose" in ('recording','import','thumbnail','brand_logo'));