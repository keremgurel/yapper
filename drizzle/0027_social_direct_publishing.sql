ALTER TABLE "imported_platform_media" DROP CONSTRAINT "imported_platform_media_platform_check";--> statement-breakpoint
ALTER TABLE "platform_connections" DROP CONSTRAINT "platform_connections_platform_check";--> statement-breakpoint
ALTER TABLE "publish_jobs" DROP CONSTRAINT "publish_jobs_platform_check";--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD COLUMN "provider_state" jsonb;--> statement-breakpoint
ALTER TABLE "imported_platform_media" ADD CONSTRAINT "imported_platform_media_platform_check" CHECK ("imported_platform_media"."platform" in ('youtube','tiktok','instagram','facebook'));--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_platform_check" CHECK ("platform_connections"."platform" in ('youtube','tiktok','instagram','facebook'));--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_platform_check" CHECK ("publish_jobs"."platform" in ('youtube','tiktok','instagram','facebook'));--> statement-breakpoint
ALTER TABLE "publishing_schedules" DROP CONSTRAINT "publishing_schedules_platform_check";--> statement-breakpoint
ALTER TABLE "publishing_schedules" ADD CONSTRAINT "publishing_schedules_platform_check" CHECK ("publishing_schedules"."platform" in ('youtube','instagram','tiktok','facebook'));
