ALTER TABLE "outbox" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "next_retry_at" timestamp (3);