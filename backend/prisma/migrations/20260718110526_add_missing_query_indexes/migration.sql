-- DropIndex
DROP INDEX "medications_patient_id_is_active_idx";

-- CreateIndex
CREATE INDEX "attachments_note_type_note_id_idx" ON "attachments"("note_type", "note_id");

-- CreateIndex
CREATE INDEX "attachments_patient_id_uploaded_at_idx" ON "attachments"("patient_id", "uploaded_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_table_name_created_at_idx" ON "audit_logs"("table_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "documents_patient_id_generated_at_idx" ON "documents"("patient_id", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "medications_patient_id_is_active_created_at_idx" ON "medications"("patient_id", "is_active", "created_at" DESC);
