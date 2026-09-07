CREATE TABLE "content_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_messages_role_check" CHECK ("content_messages"."role" in ('creator','chirpy'))
);
--> statement-breakpoint
ALTER TABLE "content_messages" ADD CONSTRAINT "content_messages_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_messages" ADD CONSTRAINT "content_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_messages_item_idx" ON "content_messages" USING btree ("content_item_id","created_at");