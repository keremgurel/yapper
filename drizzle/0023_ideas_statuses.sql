ALTER TABLE "content_items" DROP CONSTRAINT "content_items_scheduled_check";--> statement-breakpoint
ALTER TABLE "content_items" DROP CONSTRAINT "content_items_status_check";--> statement-breakpoint
ALTER TABLE "content_items" ALTER COLUMN "status" SET DEFAULT 'captured';--> statement-breakpoint
UPDATE "content_items" SET "status" = CASE
  WHEN "stage" = 'bank' THEN 'captured'
  WHEN "status" = 'drafted' THEN 'drafting'
  WHEN "status" = 'planned' THEN 'ready'
  WHEN "status" = 'scheduled' THEN 'ready'
  ELSE "status"
END;--> statement-breakpoint
UPDATE "library_views" SET "filters" = replace(replace(replace("filters"::text, '"drafted"', '"drafting"'), '"planned"', '"ready"'), '"scheduled"', '"ready"')::jsonb
WHERE "filters"::text LIKE '%"status"%';--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_status_check" CHECK ("content_items"."status" in ('captured','drafting','ready','posted'));