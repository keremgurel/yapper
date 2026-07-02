CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"hooks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"example" text DEFAULT '' NOT NULL,
	"cta" text DEFAULT '' NOT NULL,
	"script" text,
	"status" text DEFAULT 'drafted' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"source_url" text,
	"source_title" text,
	"source_client_id" text,
	"submission_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_status_check" CHECK ("content_items"."status" in ('drafted','planned','scheduled','posted'))
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_items_user_idx" ON "content_items" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_import_unique" ON "content_items" USING btree ("user_id","source_client_id");