-- Additive only: adds soft-delete support to vital_signs, mirroring the
-- is_deleted column already present on initial_notes / progress_notes.
-- Never destructive — see CLAUDE.md "Prisma / migrations" note.

ALTER TABLE "vital_signs"
  ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
