CREATE TABLE "chirpy_plans" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "execution_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "fingerprint" text NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chirpy_plans_user_id_execution_id_pk" PRIMARY KEY ("user_id", "execution_id")
);
