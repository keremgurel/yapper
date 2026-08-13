CREATE TABLE "r2_objects" (
	"media_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"state" text NOT NULL,
	"media_bytes" bigint DEFAULT 0 NOT NULL,
	"upload_expires_at" timestamp with time zone,
	"delete_not_before" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delete_reason" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "r2_objects_purpose_check" CHECK ("r2_objects"."purpose" in ('recording','import','thumbnail')),
	CONSTRAINT "r2_objects_state_check" CHECK ("r2_objects"."state" in ('pending_upload','active','delete_pending','deleting','deleted')),
	CONSTRAINT "r2_objects_media_bytes_check" CHECK ("r2_objects"."media_bytes" >= 0),
	CONSTRAINT "r2_objects_attempts_check" CHECK ("r2_objects"."attempts" >= 0),
	CONSTRAINT "r2_objects_lease_check" CHECK (("r2_objects"."state" = 'deleting' and "r2_objects"."lease_token" is not null and "r2_objects"."lease_expires_at" is not null) or ("r2_objects"."state" <> 'deleting' and "r2_objects"."lease_token" is null and "r2_objects"."lease_expires_at" is null)),
	CONSTRAINT "r2_objects_deleted_at_check" CHECK (("r2_objects"."state" = 'deleted' and "r2_objects"."deleted_at" is not null) or ("r2_objects"."state" <> 'deleted' and "r2_objects"."deleted_at" is null)),
	CONSTRAINT "r2_objects_upload_expiry_check" CHECK ("r2_objects"."state" <> 'pending_upload' or "r2_objects"."upload_expires_at" is not null)
);
--> statement-breakpoint
CREATE INDEX "r2_objects_state_attempt_idx" ON "r2_objects" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "r2_objects_user_state_idx" ON "r2_objects" USING btree ("user_id","state");
--> statement-breakpoint
WITH "live_r2_references" AS (
	SELECT
		"media_key",
		"user_id",
		"media_bytes",
		'recording'::text AS "purpose"
	FROM "submissions"
	WHERE "media_key" IS NOT NULL
	UNION ALL
	SELECT
		"media_key",
		"user_id",
		"media_bytes",
		'import'::text AS "purpose"
	FROM "imported_platform_media"
)
INSERT INTO "r2_objects" (
	"media_key",
	"user_id",
	"purpose",
	"state",
	"media_bytes"
)
SELECT
	"media_key",
	"user_id",
	CASE
		WHEN bool_or("purpose" = 'import') THEN 'import'
		ELSE 'recording'
	END,
	'active',
	max("media_bytes")
FROM "live_r2_references"
GROUP BY "media_key", "user_id";
