ALTER TABLE "content_items" ADD COLUMN "recorded_transcript" text;--> statement-breakpoint
-- Editor handoffs wrote the recording's words into the inspiration slot; move them.
UPDATE "content_items" SET "recorded_transcript" = "source_transcript", "source_transcript" = NULL WHERE "source_url" = 'yapper://poster-upload' AND "source_transcript" IS NOT NULL;