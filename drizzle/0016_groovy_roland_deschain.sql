CREATE TABLE "rate_limit_buckets" (
	"scope" text NOT NULL,
	"subject_hash" text NOT NULL,
	"tokens" double precision NOT NULL,
	"capacity" integer NOT NULL,
	"refill_per_second" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_buckets_scope_subject_hash_pk" PRIMARY KEY("scope","subject_hash"),
	CONSTRAINT "rate_limit_buckets_tokens_check" CHECK ("rate_limit_buckets"."tokens" >= 0),
	CONSTRAINT "rate_limit_buckets_token_capacity_check" CHECK ("rate_limit_buckets"."tokens" <= "rate_limit_buckets"."capacity"),
	CONSTRAINT "rate_limit_buckets_capacity_check" CHECK ("rate_limit_buckets"."capacity" > 0),
	CONSTRAINT "rate_limit_buckets_refill_check" CHECK ("rate_limit_buckets"."refill_per_second" > 0)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");
