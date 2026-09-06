CREATE TABLE "publishing_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"request_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"entry_index" integer NOT NULL,
	"platform" text NOT NULL,
	"external_account_id" text NOT NULL,
	"account_label" text NOT NULL,
	"title" text NOT NULL,
	"content_item_id" uuid,
	"input" jsonb NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"publish_job_id" uuid,
	"error" text,
	"external_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishing_schedules_status_check" CHECK ("publishing_schedules"."status" in ('scheduled','running','published','draft','failed','needs_attention','cancelled')),
	CONSTRAINT "publishing_schedules_platform_check" CHECK ("publishing_schedules"."platform" in ('youtube','instagram','tiktok'))
);
--> statement-breakpoint
ALTER TABLE "publishing_schedules" ADD CONSTRAINT "publishing_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_schedules" ADD CONSTRAINT "publishing_schedules_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_schedules" ADD CONSTRAINT "publishing_schedules_publish_job_id_publish_jobs_id_fk" FOREIGN KEY ("publish_job_id") REFERENCES "public"."publish_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_schedules_request_entry_unique" ON "publishing_schedules" USING btree ("user_id","request_key","entry_index");--> statement-breakpoint
CREATE INDEX "publishing_schedules_due_idx" ON "publishing_schedules" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "publishing_schedules_user_idx" ON "publishing_schedules" USING btree ("user_id","scheduled_for");