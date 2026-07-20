CREATE TABLE "transcription_dictionary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"term" text NOT NULL,
	"term_key" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcription_dictionary" ADD CONSTRAINT "transcription_dictionary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_dictionary_user_term_unique" ON "transcription_dictionary" USING btree ("user_id","term_key");--> statement-breakpoint
CREATE INDEX "transcription_dictionary_user_idx" ON "transcription_dictionary" USING btree ("user_id","updated_at");