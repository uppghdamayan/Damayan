-- CreateTable
CREATE TABLE "deleted_notes" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_id" UUID,
    "original_note_id" UUID NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "content" JSONB NOT NULL,
    "author_id" UUID,
    "deleted_by" UUID,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deleted_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deleted_notes_patient_id_deleted_at_idx" ON "deleted_notes"("patient_id", "deleted_at" DESC);

-- AddForeignKey
ALTER TABLE "deleted_notes" ADD CONSTRAINT "deleted_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deleted_notes" ADD CONSTRAINT "deleted_notes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deleted_notes" ADD CONSTRAINT "deleted_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deleted_notes" ADD CONSTRAINT "deleted_notes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing soft-deleted initial_notes
INSERT INTO "deleted_notes" ("id", "patient_id", "visit_id", "original_note_id", "note_type", "content", "author_id", "deleted_by", "deleted_at", "original_created_at")
SELECT 
    gen_random_uuid(), 
    v."patient_id", 
    i."visit_id", 
    i."id", 
    'INITIAL_NOTE', 
    row_to_json(i), 
    i."author_id", 
    i."last_edited_by", -- approximation of deleted_by
    COALESCE(i."last_edited_at", i."created_at"), 
    i."created_at"
FROM "initial_notes" i
JOIN "visits" v ON i."visit_id" = v."id"
WHERE i."is_deleted" = true;

-- Migrate existing soft-deleted progress_notes
INSERT INTO "deleted_notes" ("id", "patient_id", "visit_id", "original_note_id", "note_type", "content", "author_id", "deleted_by", "deleted_at", "original_created_at")
SELECT 
    gen_random_uuid(), 
    v."patient_id", 
    p."visit_id", 
    p."id", 
    'PROGRESS_NOTE', 
    row_to_json(p), 
    p."author_id", 
    p."last_edited_by", -- approximation of deleted_by
    COALESCE(p."last_edited_at", p."created_at"), 
    p."created_at"
FROM "progress_notes" p
JOIN "visits" v ON p."visit_id" = v."id"
WHERE p."is_deleted" = true;

-- Update initial_note_versions to allow SET NULL when initial_notes are deleted
ALTER TABLE "initial_note_versions" DROP CONSTRAINT "initial_note_versions_initial_note_id_fkey";
ALTER TABLE "initial_note_versions" ALTER COLUMN "initial_note_id" DROP NOT NULL;
ALTER TABLE "initial_note_versions" ADD CONSTRAINT "initial_note_versions_initial_note_id_fkey" FOREIGN KEY ("initial_note_id") REFERENCES "initial_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Delete the soft-deleted notes from active tables (they are now in deleted_notes)
DELETE FROM "initial_notes" WHERE "id" IN (SELECT "original_note_id" FROM "deleted_notes" WHERE "note_type" = 'INITIAL_NOTE');
DELETE FROM "progress_notes" WHERE "id" IN (SELECT "original_note_id" FROM "deleted_notes" WHERE "note_type" = 'PROGRESS_NOTE');

-- AlterTable initial_notes: drop column is_deleted
ALTER TABLE "initial_notes" DROP COLUMN IF EXISTS "is_deleted";

-- AlterTable progress_notes: drop column is_deleted
ALTER TABLE "progress_notes" DROP COLUMN IF EXISTS "is_deleted";
