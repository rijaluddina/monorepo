CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TABLE "event_store" (
	"id" text PRIMARY KEY NOT NULL,
	"aggregateId" text NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer NOT NULL,
	"occurredAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'MEMBER' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "event_store_aggregateId_idx" ON "event_store" USING btree ("aggregateId");--> statement-breakpoint
CREATE INDEX "event_store_eventType_idx" ON "event_store" USING btree ("eventType");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");