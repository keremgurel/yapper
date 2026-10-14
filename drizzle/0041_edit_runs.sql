CREATE TABLE "edit_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"usage_id" text NOT NULL,
	"footage_seconds" real NOT NULL,
	"cut_count" integer NOT NULL,
	"cut_seconds" real NOT NULL,
	"word_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edit_runs" ADD CONSTRAINT "edit_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edit_runs_user_idx" ON "edit_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "edit_runs_usage_unique" ON "edit_runs" USING btree ("usage_id");