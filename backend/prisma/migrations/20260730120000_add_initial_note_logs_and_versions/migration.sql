-- Additive-only migration: adds the `initial_note_logs` and `initial_note_versions` tables
-- backing the Initial Note master change log and version history. No existing column, type,
-- constraint, or row is altered, so this is safe to run against the live database with zero
-- data loss.
--
-- Every statement is idempotent (`IF NOT EXISTS`, plus `pg_constraint` guards around the
-- foreign keys, which have no `IF NOT EXISTS` form). Re-running the file is a no-op, so a
-- table created out-of-band via `prisma db push` will not cause an error.
--
-- Table, column, index, and constraint names follow Prisma's defaults so the schema and the
-- database stay in sync for future introspection.

-- ─────────────────────────────────────────────
-- initial_note_logs
-- ─────────────────────────────────────────────
-- Patient-scoped, append-only, human-readable change log — the Initial Note counterpart of
-- `problem_logs` / `medication_logs`. Unlike `problem_logs` there is NO retention cleanup:
-- these rows are kept indefinitely.

CREATE TABLE IF NOT EXISTS "initial_note_logs" (
    "id"              UUID         NOT NULL,
    -- nullable: a DRAFT note is hard-deleted, and the log entry must outlive it
    "initial_note_id" UUID,
    -- set when the entry produced a row in initial_note_versions
    "version_id"      UUID,
    "patient_id"      UUID         NOT NULL,
    "action"          VARCHAR(50)  NOT NULL,
    "description"     TEXT         NOT NULL,
    "editor_id"       UUID         NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initial_note_logs_pkey" PRIMARY KEY ("id")
);

-- serves the only read path: WHERE patient_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "initial_note_logs_patient_id_created_at_idx"
    ON "initial_note_logs"("patient_id", "created_at" DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'initial_note_logs_editor_id_fkey'
    ) THEN
        ALTER TABLE "initial_note_logs"
            ADD CONSTRAINT "initial_note_logs_editor_id_fkey"
            FOREIGN KEY ("editor_id") REFERENCES "users"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'initial_note_logs_patient_id_fkey'
    ) THEN
        ALTER TABLE "initial_note_logs"
            ADD CONSTRAINT "initial_note_logs_patient_id_fkey"
            FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ─────────────────────────────────────────────
-- initial_note_versions
-- ─────────────────────────────────────────────
-- Immutable snapshot of an Initial Note. v1 is written on publish; each post-publish save
-- writes the next version. `changed_fields` is empty on v1. Never purged.

CREATE TABLE IF NOT EXISTS "initial_note_versions" (
    "id"              UUID         NOT NULL,
    "initial_note_id" UUID         NOT NULL,
    "patient_id"      UUID         NOT NULL,
    "version_number"  INTEGER      NOT NULL,
    "snapshot"        JSONB        NOT NULL,
    "changed_fields"  TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "change_summary"  TEXT,
    "editor_id"       UUID         NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initial_note_versions_pkey" PRIMARY KEY ("id")
);

-- backstop against a concurrent double-save racing to the same version number
CREATE UNIQUE INDEX IF NOT EXISTS "initial_note_versions_initial_note_id_version_number_key"
    ON "initial_note_versions"("initial_note_id", "version_number");

-- serves the version-history rail: WHERE initial_note_id = $1 ORDER BY version_number DESC
CREATE INDEX IF NOT EXISTS "initial_note_versions_initial_note_id_version_number_idx"
    ON "initial_note_versions"("initial_note_id", "version_number" DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'initial_note_versions_initial_note_id_fkey'
    ) THEN
        -- ON DELETE RESTRICT, not CASCADE: deleting a PUBLISHED note is a soft delete, and a
        -- DRAFT (which never has versions) is cleared explicitly by the service first.
        ALTER TABLE "initial_note_versions"
            ADD CONSTRAINT "initial_note_versions_initial_note_id_fkey"
            FOREIGN KEY ("initial_note_id") REFERENCES "initial_notes"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'initial_note_versions_editor_id_fkey'
    ) THEN
        ALTER TABLE "initial_note_versions"
            ADD CONSTRAINT "initial_note_versions_editor_id_fkey"
            FOREIGN KEY ("editor_id") REFERENCES "users"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'initial_note_versions_patient_id_fkey'
    ) THEN
        ALTER TABLE "initial_note_versions"
            ADD CONSTRAINT "initial_note_versions_patient_id_fkey"
            FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
