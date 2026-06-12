# DAMAYAN EMR — Phase 2 Build Prompt
## Database Foundation & Full Schema Initialization

**Version:** 1.0  
**Dependencies:** Phase 1 ✅ Complete  
**Goal:** Complete database schema migrated, Prisma client generated, NestJS PrismaService wired and running

---

## Context

You are working on DAMAYAN — a Problem-Oriented EMR system built with the following stack:

- **Backend:** NestJS (TypeScript) — located at `backend/`
- **Frontend:** Next.js 16 with App Router (TypeScript) — located at `frontend/`
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma

Phase 1 is complete. The NestJS backend is scaffolded with all domain modules as empty stubs, CORS configured, global ValidationPipe, and Swagger. The Prisma package is installed. The `.env` files are in place with `DATABASE_URL` and `DIRECT_URL` pointing to a live Supabase project.

Phase 2 has **zero frontend work**. It is entirely backend + database.

---

## Phase 2 Objectives

1. Write the complete `schema.prisma` with all models, enums, relations, indexes, and field mappings
2. Run the initial full-schema migration against Supabase
3. Generate the Prisma client
4. Create `PrismaModule` and `PrismaService` in NestJS
5. Register `PrismaModule` globally in `AppModule`
6. Verify the database connection is live

---

## Step 1 — Write `backend/prisma/schema.prisma`

Replace the contents of `backend/prisma/schema.prisma` **entirely** with the following. Do not abbreviate, truncate, or omit any model.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum Role {
  DOCTOR
  NURSE
  ADMIN
}

enum Sex {
  MALE
  FEMALE
  OTHER
}

enum VisitType {
  INITIAL
  PROGRESS
}

enum NoteStatus {
  DRAFT
  PUBLISHED
}

enum ProblemStatus {
  ACTIVE
  RESOLVED
  REMOVED
}

enum MedUnit {
  MG
  G
  MCG
  ML
  UNITS
}

enum DocumentType {
  MEDICAL_CERTIFICATE
  LAB_REQUEST
  PRESCRIPTION
  CHARGE_SLIP
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  VIEW
  GENERATE
}

enum NoteType {
  INITIAL_NOTE
  PROGRESS_NOTE
}

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

model User {
  id         String   @id @db.Uuid
  email      String   @unique
  firstName  String   @map("first_name")  @db.VarChar(30)
  lastName   String   @map("last_name")   @db.VarChar(30)
  middleName String?  @map("middle_name") @db.VarChar(30)
  extension  String?  @db.VarChar(3)
  role       Role
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt      @map("updated_at")

  // Relations
  visits          Visit[]      @relation("VisitPhysician")
  createdPatients Patient[]    @relation("PatientCreatedBy")
  vitalSigns      VitalSign[]  @relation("VitalMeasuredBy")
  initialNotes    InitialNote[] @relation("InitialNoteAuthor")
  initialEdits    InitialNote[] @relation("InitialNoteEditor")
  progressNotes   ProgressNote[] @relation("ProgressNoteAuthor")
  progressEdits   ProgressNote[] @relation("ProgressNoteEditor")
  problems        Problem[]    @relation("ProblemAddedBy")
  medications     Medication[] @relation("MedicationAddedBy")
  documents       Document[]   @relation("DocumentGeneratedBy")
  attachments     Attachment[] @relation("AttachmentUploadedBy")
  auditLogs       AuditLog[]   @relation("AuditLogUser")

  @@map("users")
}

// ─────────────────────────────────────────────
// PATIENT
// ─────────────────────────────────────────────

model Patient {
  id              String   @id @default(uuid()) @db.Uuid
  patientCode     String   @unique @map("patient_code") @db.VarChar(12)
  lastName        String   @map("last_name")   @db.VarChar(30)
  firstName       String   @map("first_name")  @db.VarChar(30)
  middleName      String?  @map("middle_name") @db.VarChar(30)
  extension       String?  @db.VarChar(3)
  dateOfBirth     DateTime @map("date_of_birth") @db.Date
  sex             Sex
  addressStreet   String?  @map("address_street")
  addressBarangay String?  @map("address_barangay") @db.VarChar(100)
  addressCity     String?  @map("address_city")     @db.VarChar(100)
  addressRegion   String?  @map("address_region")   @db.VarChar(100)
  addressCountry  String   @default("Philippines")  @map("address_country") @db.VarChar(50)
  isActive        Boolean  @default(true) @map("is_active")
  createdBy       String?  @map("created_by") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt      @map("updated_at")

  // Relations
  creator     User?        @relation("PatientCreatedBy", fields: [createdBy], references: [id])
  visits      Visit[]
  problems    Problem[]
  medications Medication[]
  vitalSigns  VitalSign[]
  documents   Document[]
  attachments Attachment[]
  auditLogs   AuditLog[]   @relation("AuditLogPatient")

  @@index([lastName, firstName])
  @@map("patients")
}

// ─────────────────────────────────────────────
// VISIT
// ─────────────────────────────────────────────

model Visit {
  id                 String    @id @default(uuid()) @db.Uuid
  patientId          String    @map("patient_id") @db.Uuid
  physicianId        String    @map("physician_id") @db.Uuid
  visitDatetime      DateTime  @map("visit_datetime")
  visitType          VisitType @map("visit_type")
  status             NoteStatus @default(DRAFT)
  problemChanges     Json?     @map("problem_changes")
  medicationChanges  Json?     @map("medication_changes")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt      @map("updated_at")

  // Relations
  patient      Patient       @relation(fields: [patientId], references: [id])
  physician    User          @relation("VisitPhysician", fields: [physicianId], references: [id])
  initialNote  InitialNote?
  progressNote ProgressNote?
  vitalSigns   VitalSign[]
  documents    Document[]

  @@index([patientId, visitDatetime(sort: Desc)])
  @@map("visits")
}

// ─────────────────────────────────────────────
// INITIAL NOTE
// ─────────────────────────────────────────────

model InitialNote {
  id                   String     @id @default(uuid()) @db.Uuid
  visitId              String     @unique @map("visit_id") @db.Uuid
  authorId             String?    @map("author_id") @db.Uuid
  chiefComplaint       String     @map("chief_complaint") @db.VarChar(50)
  hpi                  String     @map("hpi")
  pmhComorbidities     String?    @map("pmh_comorbidities")
  pmhSurgeries         String?    @map("pmh_surgeries")
  pmhHospitalizations  String?    @map("pmh_hospitalizations")
  allergies            String?
  familyHistory        String?    @map("family_history")
  socialHistory        String?    @map("social_history")
  obHistory            String?    @map("ob_history")
  psychosocialHistory  String?    @map("psychosocial_history")
  physicalExam         String     @map("physical_exam")
  assessment           Json
  mgmtNonpharm         String?    @map("mgmt_nonpharm")
  diagnostics          Json?
  status               NoteStatus @default(DRAFT)
  lastEditedBy         String?    @map("last_edited_by") @db.Uuid
  lastEditedAt         DateTime?  @map("last_edited_at")
  createdAt            DateTime   @default(now()) @map("created_at")
  updatedAt            DateTime   @updatedAt      @map("updated_at")

  // Relations
  visit       Visit        @relation(fields: [visitId], references: [id])
  author      User?        @relation("InitialNoteAuthor", fields: [authorId], references: [id])
  lastEditor  User?        @relation("InitialNoteEditor", fields: [lastEditedBy], references: [id])
  attachments Attachment[]

  @@map("initial_notes")
}

// ─────────────────────────────────────────────
// PROGRESS NOTE
// ─────────────────────────────────────────────

model ProgressNote {
  id                   String     @id @default(uuid()) @db.Uuid
  visitId              String     @unique @map("visit_id") @db.Uuid
  authorId             String?    @map("author_id") @db.Uuid
  subjective           String
  objective            String
  mgmtNonpharm         String?    @map("mgmt_nonpharm")
  diagnostics          Json?
  problemListSnapshot  Json?      @map("problem_list_snapshot")
  medicationSnapshot   Json?      @map("medication_snapshot")
  status               NoteStatus @default(DRAFT)
  lastEditedBy         String?    @map("last_edited_by") @db.Uuid
  lastEditedAt         DateTime?  @map("last_edited_at")
  createdAt            DateTime   @default(now()) @map("created_at")
  updatedAt            DateTime   @updatedAt      @map("updated_at")

  // Relations
  visit       Visit        @relation(fields: [visitId], references: [id])
  author      User?        @relation("ProgressNoteAuthor", fields: [authorId], references: [id])
  lastEditor  User?        @relation("ProgressNoteEditor", fields: [lastEditedBy], references: [id])
  attachments Attachment[]

  @@map("progress_notes")
}

// ─────────────────────────────────────────────
// PROBLEM
// ─────────────────────────────────────────────

model Problem {
  id        String        @id @default(uuid()) @db.Uuid
  patientId String        @map("patient_id") @db.Uuid
  parentId  String?       @map("parent_id") @db.Uuid
  title     String
  status    ProblemStatus @default(ACTIVE)
  sortOrder Int           @map("sort_order")
  addedBy   String?       @map("added_by") @db.Uuid
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @updatedAt      @map("updated_at")

  // Relations
  patient  Patient   @relation(fields: [patientId], references: [id])
  parent   Problem?  @relation("ProblemNesting", fields: [parentId], references: [id])
  children Problem[] @relation("ProblemNesting")
  addedByUser User?  @relation("ProblemAddedBy", fields: [addedBy], references: [id])

  @@index([patientId, sortOrder])
  @@map("problems")
}

// ─────────────────────────────────────────────
// MEDICATION
// ─────────────────────────────────────────────

model Medication {
  id           String   @id @default(uuid()) @db.Uuid
  patientId    String   @map("patient_id") @db.Uuid
  name         String   @db.VarChar(255)
  dose         Decimal  @db.Decimal(8, 2)
  unit         MedUnit  @default(MG)
  instructions String?  @db.VarChar(50)
  quantity     Int?
  isActive     Boolean  @default(true) @map("is_active")
  addedBy      String?  @map("added_by") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt      @map("updated_at")

  // Relations
  patient     Patient @relation(fields: [patientId], references: [id])
  addedByUser User?   @relation("MedicationAddedBy", fields: [addedBy], references: [id])

  @@index([patientId, isActive])
  @@map("medications")
}

// ─────────────────────────────────────────────
// VITAL SIGN
// ─────────────────────────────────────────────

model VitalSign {
  id                String   @id @default(uuid()) @db.Uuid
  patientId         String   @map("patient_id") @db.Uuid
  visitId           String?  @map("visit_id") @db.Uuid
  sbp               Int?
  dbp               Int?
  heartRate         Int?     @map("heart_rate")
  respiratoryRate   Int?     @map("respiratory_rate")
  temperature       Decimal? @db.Decimal(4, 1)
  oxygenSaturation  Int?     @map("oxygen_saturation")
  measuredBy        String?  @map("measured_by") @db.Uuid
  measuredAt        DateTime @map("measured_at")
  createdAt         DateTime @default(now()) @map("created_at")

  // Relations
  patient    Patient   @relation(fields: [patientId], references: [id])
  visit      Visit?    @relation(fields: [visitId], references: [id])
  measuredByUser User? @relation("VitalMeasuredBy", fields: [measuredBy], references: [id])

  @@index([patientId, measuredAt(sort: Desc)])
  @@map("vital_signs")
}

// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

model Document {
  id           String       @id @default(uuid()) @db.Uuid
  patientId    String       @map("patient_id") @db.Uuid
  visitId      String?      @map("visit_id") @db.Uuid
  documentType DocumentType @map("document_type")
  storageKey   String       @map("storage_key")
  generatedBy  String?      @map("generated_by") @db.Uuid
  generatedAt  DateTime     @default(now()) @map("generated_at")

  // Relations
  patient         Patient @relation(fields: [patientId], references: [id])
  visit           Visit?  @relation(fields: [visitId], references: [id])
  generatedByUser User?   @relation("DocumentGeneratedBy", fields: [generatedBy], references: [id])

  @@map("documents")
}

// ─────────────────────────────────────────────
// ATTACHMENT
// ─────────────────────────────────────────────

model Attachment {
  id             String   @id @default(uuid()) @db.Uuid
  patientId      String   @map("patient_id") @db.Uuid
  noteType       NoteType @map("note_type")
  noteId         String   @map("note_id") @db.Uuid
  tag            String   @db.VarChar(100)
  storageKey     String   @map("storage_key")
  mimeType       String?  @map("mime_type") @db.VarChar(50)
  textResult     String?  @map("text_result")
  uploadedBy     String?  @map("uploaded_by") @db.Uuid
  uploadedAt     DateTime @default(now()) @map("uploaded_at")

  // Relations (polymorphic via noteType + noteId — no direct FK)
  patient        Patient      @relation(fields: [patientId], references: [id])
  uploadedByUser User?        @relation("AttachmentUploadedBy", fields: [uploadedBy], references: [id])
  initialNote    InitialNote? @relation(fields: [noteId], references: [id], map: "attachment_initial_note_fk")
  progressNote   ProgressNote? @relation(fields: [noteId], references: [id], map: "attachment_progress_note_fk")

  @@map("attachments")
}

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────

model AuditLog {
  id        String      @id @default(uuid()) @db.Uuid
  userId    String      @map("user_id") @db.Uuid
  userRole  Role        @map("user_role")
  action    AuditAction
  tableName String      @map("table_name") @db.VarChar(50)
  recordId  String      @map("record_id") @db.Uuid
  patientId String?     @map("patient_id") @db.Uuid
  changes   Json?
  ipAddress String?     @map("ip_address")
  createdAt DateTime    @default(now()) @map("created_at")

  // Relations
  user    User    @relation("AuditLogUser", fields: [userId], references: [id])
  patient Patient? @relation("AuditLogPatient", fields: [patientId], references: [id])

  @@index([patientId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@map("audit_logs")
}
```

### Schema Notes

- `Attachment` has **two optional FK relations** to `InitialNote` and `ProgressNote`. Both are optional (`?`) because a given attachment belongs to only one note type at a time. The `noteType` enum field disambiguates which FK is active. This is the correct Prisma pattern for a polymorphic attachment — do not use a single composite approach or remove either relation.
- All `id` fields that reference Supabase Auth UUIDs (specifically `User.id`) use `@id` without `@default(uuid())` — the UUID is supplied externally by Supabase Auth and must match exactly.
- All other entity `id` fields use `@default(uuid())`.
- `User.updatedAt` uses `@updatedAt` for automatic timestamp updates.

---

## Step 2 — Run the Migration

From the `backend/` directory, run:

```bash
npx prisma migrate dev --name init_full_schema
```

This performs three things atomically:
1. Introspects the current schema (empty at this point)
2. Generates the SQL migration file under `prisma/migrations/`
3. Applies the migration to the Supabase database

**Expected output:** A migration file created at `prisma/migrations/<timestamp>_init_full_schema/migration.sql` and a success message confirming all tables were created.

**If the migration fails** with a connection error, verify:
- `DATABASE_URL` in `backend/.env` uses the **Transaction Pooler** connection string (port `6543`, with `?pgbouncer=true` appended)
- `DIRECT_URL` in `backend/.env` uses the **Direct Connection** string (port `5432`, no pooler param)
- Both URLs are in the format: `postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:[port]/postgres`

**If Prisma complains about the `Attachment` dual-FK:** Prisma requires that relations with the same model have disambiguating relation names. The `@relation(map: "...")` names in the schema above handle this. If Prisma still errors, add explicit `name` fields:
```prisma
initialNote  InitialNote? @relation("AttachmentInitialNote", fields: [noteId], references: [id])
progressNote ProgressNote? @relation("AttachmentProgressNote", fields: [noteId], references: [id])
```
And add the inverse on `InitialNote` and `ProgressNote`:
```prisma
// In InitialNote model:
attachments Attachment[] @relation("AttachmentInitialNote")

// In ProgressNote model:
attachments Attachment[] @relation("AttachmentProgressNote")
```

---

## Step 3 — Generate the Prisma Client

From `backend/`:

```bash
npx prisma generate
```

This generates the fully-typed Prisma client under `node_modules/@prisma/client`. All NestJS services in subsequent phases will import from here.

**Verify generation succeeded** by checking that `node_modules/@prisma/client` contains model types for `User`, `Patient`, `Visit`, etc.

---

## Step 4 — Create `PrismaModule` and `PrismaService`

### 4.1 Create `backend/src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✓ Prisma connected to Supabase');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 4.2 Create `backend/src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

The `@Global()` decorator makes `PrismaService` available throughout the application without needing to import `PrismaModule` in every feature module. This is the standard NestJS pattern for a shared database service.

---

## Step 5 — Register `PrismaModule` in `AppModule`

Open `backend/src/app.module.ts` and add `PrismaModule` to the `imports` array. It must appear **before** all feature modules so the service is available when they initialize.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { PatientsModule } from './patients/patients.module';
import { VisitsModule } from './visits/visits.module';
import { InitialNotesModule } from './initial-notes/initial-notes.module';
import { ProgressNotesModule } from './progress-notes/progress-notes.module';
import { ProblemsModule } from './problems/problems.module';
import { MedicationsModule } from './medications/medications.module';
import { VitalsModule } from './vitals/vitals.module';
import { DocumentsModule } from './documents/documents.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,           // ← must be first after ConfigModule
    AuthModule,
    AccountsModule,
    PatientsModule,
    VisitsModule,
    InitialNotesModule,
    ProgressNotesModule,
    ProblemsModule,
    MedicationsModule,
    VitalsModule,
    DocumentsModule,
    AttachmentsModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
```

---

## Step 6 — Verify the Connection

Start the backend in development mode:

```bash
cd backend
npm run start:dev
```

**Expected console output** (order may vary):

```
✓ Prisma connected to Supabase
✓ DAMAYAN API running   → http://localhost:3001
✓ Swagger docs          → http://localhost:3001/api
```

If `Prisma connected to Supabase` appears, Phase 2 is complete.

**If `$connect()` throws a `P1001` (connection refused) error:**
- Double-check the Supabase project is not paused (free tier pauses after 7 days of inactivity)
- Confirm `DATABASE_URL` uses port `6543` (pooler) not `5432` (direct) — Prisma's runtime queries must go through the pooler
- Confirm `pgbouncer=true` is appended to `DATABASE_URL`

**If `$connect()` throws an SSL error:**
- Append `&sslmode=require` to both connection strings if not already present

---

## Step 7 — Supabase Post-Migration Verification (Manual)

After a successful migration, open the Supabase dashboard → **Table Editor** and confirm the following tables exist:

| Table | Expected Row Count |
|---|---|
| `users` | 0 |
| `patients` | 0 |
| `visits` | 0 |
| `initial_notes` | 0 |
| `progress_notes` | 0 |
| `problems` | 0 |
| `medications` | 0 |
| `vital_signs` | 0 |
| `documents` | 0 |
| `attachments` | 0 |
| `audit_logs` | 0 |

Also confirm under **Database → Enumerations** that the following enum types exist:
`Role`, `Sex`, `VisitType`, `NoteStatus`, `ProblemStatus`, `MedUnit`, `DocumentType`, `AuditAction`, `NoteType`

---

## Step 8 — Add the Custom JWT Hook SQL (Supabase)

This step is technically Phase 3 preparation but must be executed in the Supabase SQL editor **after** the `users` table is created (which happens in this migration). Execute this SQL now so it is ready for Phase 3.

Open **Supabase Dashboard → SQL Editor** and run:

```sql
-- Custom JWT access token hook
-- Injects the user's role from public.users into every Supabase JWT
-- This allows NestJS JwtStrategy to read the role claim directly from the token

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  claims := event -> 'claims';

  -- Look up role from public.users table
  SELECT role::text INTO user_role
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  -- Only inject if the user exists in our users table
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to the supabase_auth_admin role
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

Then in **Supabase Dashboard → Authentication → Hooks**, register `public.custom_access_token_hook` as the **Custom Access Token** hook. This ensures every JWT issued after this point will carry a `role` claim that matches the user's role in `public.users`.

---

## File Summary

The following files are created or modified in Phase 2:

| File | Action |
|---|---|
| `backend/prisma/schema.prisma` | **Replaced** — full schema with all 11 models and 9 enums |
| `backend/prisma/migrations/<timestamp>_init_full_schema/migration.sql` | **Created** by Prisma CLI — do not edit manually |
| `backend/src/prisma/prisma.service.ts` | **Created** |
| `backend/src/prisma/prisma.module.ts` | **Created** |
| `backend/src/app.module.ts` | **Modified** — `PrismaModule` added to imports |

No frontend files are touched in Phase 2.

---

## Phase 2 Completion Checklist

- [ ] `schema.prisma` contains all 11 models and 9 enums, field mappings intact
- [ ] Migration ran successfully: `prisma/migrations/<timestamp>_init_full_schema/migration.sql` exists
- [ ] All 11 tables visible in Supabase Table Editor
- [ ] All 9 enum types visible in Supabase Database → Enumerations
- [ ] `npx prisma generate` completed without errors
- [ ] `PrismaService` and `PrismaModule` created under `backend/src/prisma/`
- [ ] `PrismaModule` registered in `AppModule` before all feature modules
- [ ] `npm run start:dev` shows `✓ Prisma connected to Supabase` in the console
- [ ] Custom JWT hook SQL executed in Supabase and hook registered in Auth settings

**Once all items are checked, Phase 2 is done. Proceed to Phase 3: Authentication, RBAC & Admin Provisioning.**