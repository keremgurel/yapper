CREATE TABLE "scrape_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scrape_cache_created_idx" ON "scrape_cache" USING btree ("created_at");
