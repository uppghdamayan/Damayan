-- Patient hard-delete currently fails with a foreign key violation because
-- child tables (visits, problems, medications, vital_signs, documents,
-- attachments, logs, versions, deleted_notes) reference patients.id with the
-- default ON DELETE RESTRICT/NO ACTION behavior. This migration switches
-- those FKs to ON DELETE CASCADE so deleting a Patient cleanly removes its
-- dependent clinical records, matching the schema.prisma relations.
--
-- audit_logs.patient_id keeps ON DELETE SET NULL (already set) so audit
-- trail rows survive patient deletion, per compliance intent.
--
-- Additive-only in effect: constraints are dropped and re-added with the
-- same shape plus the delete rule, no columns/tables/data are touched.

-- visits -> patients
ALTER TABLE "visits" DROP CONSTRAINT IF EXISTS "visits_patient_id_fkey";
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- initial_notes / progress_notes -> visits
ALTER TABLE "initial_notes" DROP CONSTRAINT IF EXISTS "initial_notes_visit_id_fkey";
ALTER TABLE "initial_notes" ADD CONSTRAINT "initial_notes_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "progress_notes" DROP CONSTRAINT IF EXISTS "progress_notes_visit_id_fkey";
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- problems / medications -> patients
ALTER TABLE "problems" DROP CONSTRAINT IF EXISTS "problems_patient_id_fkey";
ALTER TABLE "problems" ADD CONSTRAINT "problems_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medications" DROP CONSTRAINT IF EXISTS "medications_patient_id_fkey";
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- vital_signs -> patients / visits
ALTER TABLE "vital_signs" DROP CONSTRAINT IF EXISTS "vital_signs_patient_id_fkey";
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vital_signs" DROP CONSTRAINT IF EXISTS "vital_signs_visit_id_fkey";
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- documents -> patients / visits
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_patient_id_fkey";
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_visit_id_fkey";
ALTER TABLE "documents" ADD CONSTRAINT "documents_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- attachments -> patients. note_id is polymorphic (initial_notes OR progress_notes,
-- per schema.prisma comment) with no real single-table FK on live DB — the
-- attachment_initial_note_fk / attachment_progress_note_fk names in the init
-- migration file never actually applied (schema drift), confirmed by rows
-- whose note_id lives in progress_notes only. Left untouched; patient-level
-- cascade below still cleans up attachments via patient_id regardless of
-- which note they point to.
ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "attachments_patient_id_fkey";
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- problem_logs / medication_logs / initial_note_logs / initial_note_versions / deleted_notes -> patients
ALTER TABLE "problem_logs" DROP CONSTRAINT IF EXISTS "problem_logs_patient_id_fkey";
ALTER TABLE "problem_logs" ADD CONSTRAINT "problem_logs_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medication_logs" DROP CONSTRAINT IF EXISTS "medication_logs_patient_id_fkey";
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "initial_note_logs" DROP CONSTRAINT IF EXISTS "initial_note_logs_patient_id_fkey";
ALTER TABLE "initial_note_logs" ADD CONSTRAINT "initial_note_logs_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "initial_note_versions" DROP CONSTRAINT IF EXISTS "initial_note_versions_patient_id_fkey";
ALTER TABLE "initial_note_versions" ADD CONSTRAINT "initial_note_versions_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deleted_notes" DROP CONSTRAINT IF EXISTS "deleted_notes_patient_id_fkey";
ALTER TABLE "deleted_notes" ADD CONSTRAINT "deleted_notes_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deleted_notes" DROP CONSTRAINT IF EXISTS "deleted_notes_visit_id_fkey";
ALTER TABLE "deleted_notes" ADD CONSTRAINT "deleted_notes_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
