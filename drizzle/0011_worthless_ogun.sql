CREATE TABLE "library_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'table' NOT NULL,
	"stage" text DEFAULT 'library' NOT NULL,
	"group_by" text,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_views_kind_check" CHECK ("library_views"."kind" in ('table','board')),
	CONSTRAINT "library_views_group_check" CHECK ("library_views"."group_by" is null or "library_views"."group_by" in ('status','pillar','format'))
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "formats" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "library_views" ADD CONSTRAINT "library_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_views_user_idx" ON "library_views" USING btree ("user_id","stage","sort_order");