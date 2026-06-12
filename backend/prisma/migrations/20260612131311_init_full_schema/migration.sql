-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DOCTOR', 'NURSE', 'ADMIN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('INITIAL', 'PROGRESS');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MedUnit" AS ENUM ('MG', 'G', 'MCG', 'ML', 'UNITS');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MEDICAL_CERTIFICATE', 'LAB_REQUEST', 'PRESCRIPTION', 'CHARGE_SLIP');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'GENERATE');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('INITIAL_NOTE', 'PROGRESS_NOTE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" VARCHAR(30) NOT NULL,
    "last_name" VARCHAR(30) NOT NULL,
    "middle_name" VARCHAR(30),
    "extension" VARCHAR(3),
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "patient_code" VARCHAR(12) NOT NULL,
    "last_name" VARCHAR(30) NOT NULL,
    "first_name" VARCHAR(30) NOT NULL,
    "middle_name" VARCHAR(30),
    "extension" VARCHAR(3),
    "date_of_birth" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "address_street" TEXT,
    "address_barangay" VARCHAR(100),
    "address_city" VARCHAR(100),
    "address_region" VARCHAR(100),
    "address_country" VARCHAR(50) NOT NULL DEFAULT 'Philippines',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "physician_id" UUID NOT NULL,
    "visit_datetime" TIMESTAMP(3) NOT NULL,
    "visit_type" "VisitType" NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "problem_changes" JSONB,
    "medication_changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initial_notes" (
    "id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "author_id" UUID,
    "chief_complaint" VARCHAR(50) NOT NULL,
    "hpi" TEXT NOT NULL,
    "pmh_comorbidities" TEXT,
    "pmh_surgeries" TEXT,
    "pmh_hospitalizations" TEXT,
    "allergies" TEXT,
    "family_history" TEXT,
    "social_history" TEXT,
    "ob_history" TEXT,
    "psychosocial_history" TEXT,
    "physical_exam" TEXT NOT NULL,
    "assessment" JSONB NOT NULL,
    "mgmt_nonpharm" TEXT,
    "diagnostics" JSONB,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "last_edited_by" UUID,
    "last_edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initial_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_notes" (
    "id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "author_id" UUID,
    "subjective" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "mgmt_nonpharm" TEXT,
    "diagnostics" JSONB,
    "problem_list_snapshot" JSONB,
    "medication_snapshot" JSONB,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "last_edited_by" UUID,
    "last_edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" TEXT NOT NULL,
    "status" "ProblemStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL,
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "dose" DECIMAL(8,2) NOT NULL,
    "unit" "MedUnit" NOT NULL DEFAULT 'MG',
    "instructions" VARCHAR(50),
    "quantity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_id" UUID,
    "sbp" INTEGER,
    "dbp" INTEGER,
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature" DECIMAL(4,1),
    "oxygen_saturation" INTEGER,
    "measured_by" UUID,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_id" UUID,
    "document_type" "DocumentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "generated_by" UUID,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "note_id" UUID NOT NULL,
    "tag" VARCHAR(100) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(50),
    "text_result" TEXT,
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_role" "Role" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "table_name" VARCHAR(50) NOT NULL,
    "record_id" UUID NOT NULL,
    "patient_id" UUID,
    "changes" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patient_code_key" ON "patients"("patient_code");

-- CreateIndex
CREATE INDEX "patients_last_name_first_name_idx" ON "patients"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "visits_patient_id_visit_datetime_idx" ON "visits"("patient_id", "visit_datetime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "initial_notes_visit_id_key" ON "initial_notes"("visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "progress_notes_visit_id_key" ON "progress_notes"("visit_id");

-- CreateIndex
CREATE INDEX "problems_patient_id_sort_order_idx" ON "problems"("patient_id", "sort_order");

-- CreateIndex
CREATE INDEX "medications_patient_id_is_active_idx" ON "medications"("patient_id", "is_active");

-- CreateIndex
CREATE INDEX "vital_signs_patient_id_measured_at_idx" ON "vital_signs"("patient_id", "measured_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_patient_id_created_at_idx" ON "audit_logs"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_physician_id_fkey" FOREIGN KEY ("physician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initial_notes" ADD CONSTRAINT "initial_notes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initial_notes" ADD CONSTRAINT "initial_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initial_notes" ADD CONSTRAINT "initial_notes_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_measured_by_fkey" FOREIGN KEY ("measured_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachment_initial_note_fk" FOREIGN KEY ("note_id") REFERENCES "initial_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachment_progress_note_fk" FOREIGN KEY ("note_id") REFERENCES "progress_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
