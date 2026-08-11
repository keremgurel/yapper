CREATE TABLE "imported_platform_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"media_key" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imported_platform_media_platform_check" CHECK ("imported_platform_media"."platform" in ('youtube','tiktok','instagram'))
);
--> statement-breakpoint
ALTER TABLE "imported_platform_media" ADD CONSTRAINT "imported_platform_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "imported_platform_media_post_unique" ON "imported_platform_media" USING btree ("user_id","platform","external_post_id");