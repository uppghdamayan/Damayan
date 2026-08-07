-- Additive only: adds mgmt_pharm column to initial_notes and progress_notes.
-- Never destructive — see GEMINI.md "Prisma / migrations" note.

ALTER TABLE "initial_notes"
  ADD COLUMN IF NOT EXISTS "mgmt_pharm" TEXT;

ALTER TABLE "progress_notes"
  ADD COLUMN IF NOT EXISTS "mgmt_pharm" TEXT;
