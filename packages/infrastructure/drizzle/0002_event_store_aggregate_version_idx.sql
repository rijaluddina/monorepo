DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'event_store'
      AND column_name = 'aggregate_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "event_store_aggregate_version_idx"
    ON "event_store" USING btree ("aggregate_id", "version");
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "event_store_aggregate_version_idx"
    ON "event_store" USING btree ("aggregateId", "version");
  END IF;
END $$;--> statement-breakpoint
