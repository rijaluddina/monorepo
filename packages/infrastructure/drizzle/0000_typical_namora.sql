CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TABLE "event_store" (
	"id" text PRIMARY KEY NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer NOT NULL,
	"occurred_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'MEMBER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "event_store_aggregate_id_idx" ON "event_store" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "event_store_event_type_idx" ON "event_store" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "event_store_aggregate_version_idx" ON "event_store" USING btree ("aggregate_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");