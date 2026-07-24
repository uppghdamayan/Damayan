-- Additive-only migration: adds indexes on foreign-key / filter columns to speed up
-- data fetching and relationship joins. No columns, types, constraints, or data are
-- altered, so this migration is safe to run against the live database with zero data loss.
--
-- `IF NOT EXISTS` makes every statement idempotent: if an index was already created
-- out-of-band (e.g. via `prisma db push`), the statement is a no-op instead of erroring.
--
-- Index names follow Prisma's default `<table>_<columns>_idx` convention so the schema
-- and database stay in sync for future introspection.
--
-- NOTE: these run inside the migration transaction. On a very large table you may prefer
-- to create them manually with CREATE INDEX CONCURRENTLY (outside a transaction) to avoid
-- write locks; for the current data volumes the plain CREATE INDEX below is fine.

-- users: role/isActive equality filters (account listing, candidate-doctor lookup, last-admin guard)
CREATE INDEX IF NOT EXISTS "users_role_is_active_idx" ON "users"("role", "is_active");

-- patients: default list/search filters isActive=true and sorts by (lastName, firstName)
CREATE INDEX IF NOT EXISTS "patients_is_active_last_name_first_name_idx" ON "patients"("is_active", "last_name", "first_name");

-- problems: REMOVED-status cascade onto a problem's direct children (WHERE patient_id + parent_id)
CREATE INDEX IF NOT EXISTS "problems_patient_id_parent_id_idx" ON "problems"("patient_id", "parent_id");

-- progress_notes: duplicate-draft guard and deleteAllDrafts (WHERE author_id + status)
CREATE INDEX IF NOT EXISTS "progress_notes_author_id_status_idx" ON "progress_notes"("author_id", "status");

-- attachments: note-delete cleanup filters note_id alone; the [note_type, note_id]
-- composite cannot serve a note_id-only seek (left-most-prefix rule)
CREATE INDEX IF NOT EXISTS "attachments_note_id_idx" ON "attachments"("note_id");
