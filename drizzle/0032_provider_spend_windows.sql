CREATE TABLE "provider_spend_windows" (
	"window" text PRIMARY KEY NOT NULL,
	"reserved_microusd" bigint DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
