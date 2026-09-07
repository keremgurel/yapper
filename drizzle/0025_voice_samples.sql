CREATE TABLE "voice_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"thumbnail" text,
	"published_at" timestamp with time zone,
	"duration_sec" real,
	"transcript" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_samples_status_check" CHECK ("voice_samples"."status" in ('ready','failed'))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scripting_patterns" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_samples_post_unique" ON "voice_samples" USING btree ("project_id","platform","external_post_id");--> statement-breakpoint
CREATE INDEX "voice_samples_project_idx" ON "voice_samples" USING btree ("project_id","created_at");