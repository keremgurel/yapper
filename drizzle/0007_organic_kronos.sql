CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"external_account_id" text,
	"handle" text,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"scope" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_connections_platform_check" CHECK ("platform_connections"."platform" in ('youtube','tiktok','instagram')),
	CONSTRAINT "platform_connections_status_check" CHECK ("platform_connections"."status" in ('active','revoked','expired'))
);
--> statement-breakpoint
CREATE TABLE "publish_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"content_item_id" uuid,
	"platform" text NOT NULL,
	"media_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"caption" text,
	"title" text,
	"external_post_id" text,
	"external_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publish_jobs_platform_check" CHECK ("publish_jobs"."platform" in ('youtube','tiktok','instagram')),
	CONSTRAINT "publish_jobs_status_check" CHECK ("publish_jobs"."status" in ('queued','uploading','processing','published','failed'))
);
--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_user_platform_unique" ON "platform_connections" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "publish_jobs_user_idx" ON "publish_jobs" USING btree ("user_id","created_at");