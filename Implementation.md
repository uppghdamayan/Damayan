# DAMAYAN — Clinical Document Generation (Medical Certificate, Referral Letter, Diagnostic Request, Prescription)

**Target repo:** `uppghdamayan/Damayan`
**Modules touched:** `backend/src/documents/*`, `backend/prisma/schema.prisma`, `frontend/src/components/documents/*`, `frontend/src/hooks/useDocuments.ts`

## 0. Why this doc exists

The current `documents` module (`documents.service.ts` + `templates/*.template.ts`) generates placeholder PDFs — no letterhead, no physician sign-off block, JSON dumped raw with `JSON.stringify()`. Four reference documents (real clinic output, attached separately as `.docx`) define the actual target layout and data requirements:

1. **Medical Certificate**
2. **Referral Letter** ← does not exist yet as a `DocumentType`, must be added
3. **Diagnostic Request** ← maps to the existing `DocumentType.LAB_REQUEST`
4. **Prescription**

This spec tells the implementing agent exactly what schema, backend, and frontend changes are needed so the generated PDFs match the reference layout and the two documents that require free-text clinical input (Medical Certificate, Referral Letter) get a proper "preview → fill in → generate" modal flow. `CHARGE_SLIP` is untouched — out of scope.

Read this whole document before writing code. Sections are ordered as an implementation sequence (schema → config → backend → frontend). Follow existing repo conventions (NestJS module/service/controller pattern, `@map()` snake_case columns, `class-validator` DTOs, PDFKit for rendering, TanStack Query hooks, Tailwind + shadcn/ui + existing modal class conventions in `DocumentGeneratorModal.tsx`).

---

## 1. Field mapping (source of truth for every template)

Derived from the four reference `.docx` files. `*` = requires free-text operator input at generation time (no existing DB field holds it).

### 1.1 Medical Certificate
| Field | Source |
|---|---|
| Date of Generation | `new Date()` at generation time |
| Name of Patient | `Patient.firstName/middleName/lastName/extension` |
| Patient Age | computed from `Patient.dateOfBirth` |
| Patient Sex | `Patient.sex` |
| Patient Address | `Patient.addressStreet/Barangay/City/Region/Country` joined |
| Clinic Address | clinic config (see §3) |
| Date of Latest Visit | latest `Visit.visitDatetime` for the patient |
| **Chief Complaint\*** | free text, modal input, pre-filled from latest `InitialNote.chiefComplaint` as an editable default |
| Latest Problem List | latest `InitialNote.assessment` (JSON `{title, icdCode}[]`), fallback to active `Problem[]` if no published note |
| Latest Medication List | active `Medication[]` for the patient |
| **Recommendation\*** | free text, modal input, no default |
| Name of Physician | see §3.3 (physician resolution) |

### 1.2 Referral Letter
| Field | Source |
|---|---|
| Date of Generation | `new Date()` |
| **Referral Recipient\*** | free text, modal input (e.g. `"Dr. Timoteo Gonzales (Infectious Disease)"`) |
| Name of Patient / Age / Sex | `Patient` |
| Latest Problem List | same as §1.1 |
| **Salient Points\*** | free text, modal input |
| **Reason for Referral\*** | free text, modal input |
| Latest Medication List | active `Medication[]` |
| Name of Physician | §3.3 |

### 1.3 Diagnostic Request (`DocumentType.LAB_REQUEST`)
| Field | Source |
|---|---|
| Date of Generation | `new Date()` |
| Name of Patient / Age / Sex / Address | `Patient` |
| Problem List (Assessment) | latest `InitialNote.assessment` |
| List of Labs Requested | latest `InitialNote.diagnostics` (`string[]`) |
| Name of Physician | §3.3 |

No free text required — no modal beyond the existing "Generate" confirmation.

### 1.4 Prescription
| Field | Source |
|---|---|
| Date of Generation | `new Date()` |
| Name of Patient / Age / Sex / Address | `Patient` |
| List of Medications (name, dose, instructions, quantity) | active `Medication[]`, one row per record |
| Name of Physician | §3.3 |

No free text required.

---

## 2. Schema changes

### 2.1 Add `REFERRAL_LETTER` to `DocumentType`

```prisma
enum DocumentType {
  MEDICAL_CERTIFICATE
  LAB_REQUEST
  PRESCRIPTION
  CHARGE_SLIP
  REFERRAL_LETTER
}
```

### 2.2 Add license fields to `User`

The reference documents sign off with `Lic. No.`, `PTR No.`, and `S2 No.` — none of these exist on `User` today. Add them as nullable strings (nullable because not every role needs them, and `S2 No.` is commonly `"N/A"`):

```prisma
model User {
  // ...existing fields...
  licenseNumber String? @map("license_number") @db.VarChar(30)
  ptrNumber     String? @map("ptr_number")     @db.VarChar(30)
  s2Number      String? @map("s2_number")      @db.VarChar(30)
  // ...existing relations...
}
```

These should be editable via the existing account-management screens (`accounts` module) for `DOCTOR` users — add them to `accounts` create/update DTOs and the account edit form as optional fields. This is a small, mechanical addition; follow the existing pattern for `firstName`/`lastName` in that module.

### 2.3 Migration

```bash
cd backend
npx prisma migrate dev --name add_referral_letter_and_physician_credentials
```

Do **not** add a JSON snapshot column to `Document` — the generated PDF in Supabase Storage remains the single source of truth for what was on a given document. Free-text inputs (chief complaint, recommendation, referral fields) are baked into the PDF and are not separately persisted in Postgres. Note this as a deliberate decision if asked — it matches the existing pattern where `Document` only stores `storageKey` + minimal metadata.

---

## 3. Backend — shared building blocks

### 3.1 Clinic configuration

Create `backend/src/config/clinic.config.ts`:

```ts
export const clinicConfig = {
  name: process.env.CLINIC_NAME ?? 'Metro Health Clinic & Diagnostic Center',
  addressLine1: process.env.CLINIC_ADDRESS_LINE1 ?? 'Unit 405, Medical Arts Building, St. Jude General Hospital',
  addressLine2: process.env.CLINIC_ADDRESS_LINE2 ?? '456 Taft Avenue, Ermita, Manila, Philippines',
  tel: process.env.CLINIC_TEL ?? '(02) 8123-4567',
  email: process.env.CLINIC_EMAIL ?? 'contact@metrohealthclinic.ph',
};
```

Add matching keys to `backend/.env.example`:

```
CLINIC_NAME=Metro Health Clinic & Diagnostic Center
CLINIC_ADDRESS_LINE1=Unit 405, Medical Arts Building, St. Jude General Hospital
CLINIC_ADDRESS_LINE2=456 Taft Avenue, Ermita, Manila, Philippines
CLINIC_TEL=(02) 8123-4567
CLINIC_EMAIL=contact@metrohealthclinic.ph
```

Single-tenant assumption: DAMAYAN serves one clinic per deployment, so this is env config, not a DB table. Do not build a "clinics" model for this.

### 3.2 Shared PDF layout helpers

Create `backend/src/documents/templates/layout.helper.ts` — every template imports from here instead of hand-rolling headers. This removes the duplicated boilerplate currently copy-pasted across the four template files.

```ts
import PDFDocument from 'pdfkit';
import { clinicConfig } from '../../config/clinic.config';

export function drawLetterhead(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(14).font('Helvetica-Bold').text(clinicConfig.name, { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(clinicConfig.addressLine1, { align: 'center' });
  doc.text(clinicConfig.addressLine2, { align: 'center' });
  doc.text(`Tel No.: ${clinicConfig.tel} | Email: ${clinicConfig.email}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor('#999999').stroke();
  doc.moveDown(0.5);
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown();
}

export function drawGenerationDate(doc: PDFKit.PDFDocument, date: Date = new Date()) {
  doc.fontSize(10).font('Helvetica').text(
    `Date of Generation: ${date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`
  );
  doc.moveDown(0.5);
}

export function drawSignatureBlock(
  doc: PDFKit.PDFDocument,
  physician: { firstName: string; lastName: string; middleName?: string | null; licenseNumber?: string | null; ptrNumber?: string | null; s2Number?: string | null },
  label = 'Requested By:',
) {
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica').text(label);
  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').text(formatPhysicianName(physician));
  doc.font('Helvetica').fontSize(9);
  doc.text(`Lic. No.: ${physician.licenseNumber ?? 'N/A'}`);
  doc.text(`PTR No.: ${physician.ptrNumber ?? 'N/A'}`);
  doc.text(`S2 No.: ${physician.s2Number ?? 'N/A'}`);
}

export function formatPhysicianName(p: { firstName: string; lastName: string; middleName?: string | null }): string {
  const mid = p.middleName ? ` ${p.middleName.charAt(0)}.` : '';
  return `Dr. ${p.firstName}${mid} ${p.lastName}, MD`;
}

export function formatPatientName(p: { firstName: string; lastName: string; middleName?: string | null; extension?: string | null }): string {
  const mid = p.middleName ? ` ${p.middleName.charAt(0)}.` : '';
  const ext = p.extension ? ` ${p.extension}` : '';
  return `${p.firstName}${mid} ${p.lastName}${ext}`;
}

export function computeAge(dateOfBirth: Date, asOf: Date = new Date()): number {
  let age = asOf.getFullYear() - dateOfBirth.getFullYear();
  const m = asOf.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

export function formatPatientAddress(p: {
  addressStreet?: string | null; addressBarangay?: string | null;
  addressCity?: string | null; addressRegion?: string | null; addressCountry: string;
}): string {
  return [
    p.addressStreet,
    p.addressBarangay ? `Barangay ${p.addressBarangay}` : null,
    p.addressCity,
    p.addressRegion,
    p.addressCountry,
  ].filter(Boolean).join(', ');
}

export function drawPatientBlock(doc: PDFKit.PDFDocument, patient: any, includeAddress = true) {
  doc.fontSize(10).font('Helvetica-Bold').text('Name of Patient: ', { continued: true })
     .font('Helvetica').text(formatPatientName(patient));
  doc.font('Helvetica-Bold').text('Age: ', { continued: true })
     .font('Helvetica').text(`${computeAge(patient.dateOfBirth)} years old   `, { continued: true })
     .font('Helvetica-Bold').text('Sex: ', { continued: true })
     .font('Helvetica').text(patient.sex === 'MALE' ? 'Male' : 'Female');
  if (includeAddress) {
    doc.font('Helvetica-Bold').text('Patient Address: ', { continued: true })
       .font('Helvetica').text(formatPatientAddress(patient));
  }
  doc.moveDown(0.5);
}

export function drawAssessmentList(doc: PDFKit.PDFDocument, assessment: { title: string; icdCode?: string | null }[] | null) {
  doc.font('Helvetica-Bold').fontSize(10).text('Assessment:');
  doc.font('Helvetica');
  if (assessment && assessment.length > 0) {
    assessment.forEach(a => doc.text(`•  ${a.title}${a.icdCode ? ` (${a.icdCode})` : ''}`));
  } else {
    doc.text('•  No assessment on record.');
  }
  doc.moveDown(0.5);
}

export function drawMedicationList(doc: PDFKit.PDFDocument, medications: any[]) {
  if (!medications || medications.length === 0) {
    doc.font('Helvetica').text('No active medications on record.');
    return;
  }
  medications.forEach(med => {
    doc.font('Helvetica-Bold').text(med.name, { continued: true })
       .font('Helvetica').text(` ${med.dose}${med.formulation ? ` ${med.formulation}` : ''}${med.quantity ? `    #${med.quantity}` : ''}`);
    if (med.instructions) doc.fontSize(9).text(`Sig: ${med.instructions}`).fontSize(10);
    doc.moveDown(0.3);
  });
}
```

This mirrors the visual structure of all four reference `.docx` files: centered clinic letterhead → underlined section title → patient block → body → signature block with Lic./PTR/S2 numbers. Adjust exact spacing/fonts by eyeballing the rendered PDF against the reference `.docx`, but the section order above is fixed.

### 3.3 Physician resolution rule

All four documents need "Name of Physician." Resolution order, implemented in `DocumentsService`:

1. If the request includes `physicianId` (only sent by non-doctor roles, see §5.2), use that user — must have `role === DOCTOR`, else `400`.
2. Else if the requesting user (`req.user`) has `role === DOCTOR`, use them.
3. Else if `visitId` is provided, fall back to `Visit.physician`.
4. Else throw `BadRequestException('A physician must be specified for this document')`.

This keeps the common case (a doctor generating their own patient's document) a single click, while letting nurses/admins generate on a doctor's behalf by picking from a dropdown.

---

## 4. Backend — DTOs

### 4.1 `backend/src/documents/dto/generate-document.dto.ts`

```ts
import { IsEnum, IsOptional, IsUUID, IsString, MaxLength, ValidateIf } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class GenerateDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsUUID()
  visitId?: string;

  @IsOptional()
  @IsUUID()
  physicianId?: string;

  // Medical Certificate
  @ValidateIf(o => o.type === DocumentType.MEDICAL_CERTIFICATE)
  @IsString()
  @MaxLength(300)
  chiefComplaint?: string;

  @ValidateIf(o => o.type === DocumentType.MEDICAL_CERTIFICATE)
  @IsString()
  @MaxLength(1000)
  recommendation?: string;

  // Referral Letter
  @ValidateIf(o => o.type === DocumentType.REFERRAL_LETTER)
  @IsString()
  @MaxLength(150)
  referralRecipient?: string;

  @ValidateIf(o => o.type === DocumentType.REFERRAL_LETTER)
  @IsString()
  @MaxLength(500)
  salientPoints?: string;

  @ValidateIf(o => o.type === DocumentType.REFERRAL_LETTER)
  @IsString()
  @MaxLength(500)
  referralReason?: string;
}
```

### 4.2 New `backend/src/documents/dto/document-draft-query.dto.ts`

Backs the new draft-preview endpoint (§5.1):

```ts
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class DocumentDraftQueryDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsUUID()
  visitId?: string;
}
```

---

## 5. Backend — service and controller

### 5.1 New draft-preview endpoint

`MEDICAL_CERTIFICATE` and `REFERRAL_LETTER` need a "view draft before generating" step. Add:

```ts
// documents.controller.ts
@Get('draft')
@Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
async draft(
  @Param('patientId') patientId: string,
  @Query() query: DocumentDraftQueryDto,
) {
  return this.documentsService.buildDraft(patientId, query.type, query.visitId);
}
```

`DocumentsService.buildDraft()` returns **only the auto-populated, non-editable data** — patient info, formatted address, computed age, latest problem list, latest medication list, latest visit date, resolved physician (or `null` + list of candidate doctors if ambiguous — see §5.3). It deliberately excludes the free-text fields; the frontend renders those as empty/editable inputs next to this data. Route this through the same data-gathering logic that `generate()` already uses so the two never drift — extract a shared private method.

### 5.2 Rewritten `documents.service.ts`

Restructure so data-gathering is shared between `buildDraft()` and `generate()`:

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocumentType, Role } from '@prisma/client';
import { renderMedicalCertificate } from './templates/medical-certificate.template';
import { renderLabRequest } from './templates/lab-request.template';
import { renderPrescription } from './templates/prescription.template';
import { renderChargeSlip } from './templates/charge-slip.template';
import { renderReferralLetter } from './templates/referral-letter.template';
import { randomUUID } from 'crypto';
import { GenerateDocumentDto } from './dto/generate-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async resolvePhysician(userId: string, physicianId: string | undefined, visitId: string | undefined) {
    if (physicianId) {
      const p = await this.prisma.user.findUnique({ where: { id: physicianId } });
      if (!p || p.role !== Role.DOCTOR) throw new BadRequestException('physicianId must reference a doctor');
      return p;
    }
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });
    if (requester?.role === Role.DOCTOR) return requester;
    if (visitId) {
      const visit = await this.prisma.visit.findUnique({ where: { id: visitId }, include: { physician: true } });
      if (visit) return visit.physician;
    }
    return null; // caller decides whether this is fatal
  }

  private async gatherData(patientId: string, type: DocumentType, visitId: string | undefined, userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const physician = await this.resolvePhysician(userId, undefined, visitId);

    const data: any = { patient, physician };

    if (type === DocumentType.MEDICAL_CERTIFICATE || type === DocumentType.REFERRAL_LETTER || type === DocumentType.LAB_REQUEST) {
      const latestNote = await this.prisma.initialNote.findFirst({
        where: { visit: { patientId }, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
      });
      data.assessment = latestNote?.assessment ?? null;
      data.diagnostics = latestNote?.diagnostics ?? null;
      data.chiefComplaintDefault = latestNote?.chiefComplaint ?? '';
    }

    if (type === DocumentType.MEDICAL_CERTIFICATE || type === DocumentType.REFERRAL_LETTER || type === DocumentType.PRESCRIPTION) {
      data.medications = await this.prisma.medication.findMany({
        where: { patientId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (type === DocumentType.MEDICAL_CERTIFICATE) {
      const latestVisit = await this.prisma.visit.findFirst({
        where: { patientId },
        orderBy: { visitDatetime: 'desc' },
      });
      data.latestVisitDate = latestVisit?.visitDatetime ?? null;
    }

    if (type === DocumentType.CHARGE_SLIP) {
      if (visitId) data.visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
      data.problems = await this.prisma.problem.findMany({ where: { patientId } });
    }

    return data;
  }

  async buildDraft(patientId: string, type: DocumentType, visitId: string | undefined) {
    // draft is generated with a system-level "viewer" — physician resolution here is best-effort;
    // pass patientId's most recent visit physician if no authenticated-doctor context is meaningful in a GET.
    const data = await this.gatherData(patientId, type, visitId, '');
    const candidateDoctors = data.physician
      ? []
      : await this.prisma.user.findMany({ where: { role: Role.DOCTOR, isActive: true }, select: { id: true, firstName: true, lastName: true } });
    return { ...data, candidateDoctors };
  }

  async generate(patientId: string, dto: GenerateDocumentDto, userId: string) {
    const { type, visitId, physicianId } = dto;
    const data = await this.gatherData(patientId, type, visitId, userId);

    if (physicianId) {
      data.physician = await this.resolvePhysician(userId, physicianId, visitId);
    }
    if (!data.physician && [DocumentType.MEDICAL_CERTIFICATE, DocumentType.REFERRAL_LETTER, DocumentType.LAB_REQUEST, DocumentType.PRESCRIPTION].includes(type)) {
      throw new BadRequestException('A physician must be specified for this document');
    }

    if (type === DocumentType.MEDICAL_CERTIFICATE) {
      if (!dto.chiefComplaint || !dto.recommendation) {
        throw new BadRequestException('chiefComplaint and recommendation are required for a Medical Certificate');
      }
      data.chiefComplaint = dto.chiefComplaint;
      data.recommendation = dto.recommendation;
    }

    if (type === DocumentType.REFERRAL_LETTER) {
      if (!dto.referralRecipient || !dto.salientPoints || !dto.referralReason) {
        throw new BadRequestException('referralRecipient, salientPoints, and referralReason are required for a Referral Letter');
      }
      data.referralRecipient = dto.referralRecipient;
      data.salientPoints = dto.salientPoints;
      data.referralReason = dto.referralReason;
    }

    let buffer: Buffer;
    switch (type) {
      case DocumentType.MEDICAL_CERTIFICATE: buffer = await renderMedicalCertificate(data); break;
      case DocumentType.LAB_REQUEST:         buffer = await renderLabRequest(data); break;
      case DocumentType.PRESCRIPTION:        buffer = await renderPrescription(data); break;
      case DocumentType.CHARGE_SLIP:         buffer = await renderChargeSlip(data); break;
      case DocumentType.REFERRAL_LETTER:     buffer = await renderReferralLetter(data); break;
      default: throw new BadRequestException('Unknown document type');
    }

    const uuid = randomUUID();
    const path = `patients/${patientId}/documents/${uuid}.pdf`;
    const storageKey = await this.storageService.upload(path, buffer, 'application/pdf');

    return this.prisma.document.create({
      data: { patientId, visitId, documentType: type, storageKey, generatedBy: userId },
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.document.findMany({
      where: { patientId },
      orderBy: { generatedAt: 'desc' },
      include: { generatedByUser: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  async getDownloadUrl(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document?.storageKey) throw new NotFoundException('Document or storage file not found');
    return { url: await this.storageService.getSignedUrl(document.storageKey) };
  }

  async remove(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    if (document.storageKey) await this.storageService.delete(document.storageKey);
    await this.prisma.document.delete({ where: { id } });
    return { success: true };
  }
}
```

Note the controller's `generate()` handler signature changes from `(patientId, dto.type, dto.visitId, userId)` to `(patientId, dto, userId)` — update the controller call site accordingly.

### 5.3 Controller diff summary

- Add `import { Query } from '@nestjs/common'` and `DocumentDraftQueryDto`.
- Add the `GET .../documents/draft` route from §5.1 **above** the existing `GET .../documents/:id/download` route (avoid `draft` being swallowed by a `:id` param route — actually here it's fine since `draft` isn't under `:id`, but keep it above `generate` for readability).
- Change the `POST .../documents/generate` handler to pass the whole `dto` into `documentsService.generate(patientId, dto, req.user.id)`.

---

## 6. Backend — templates

Rewrite all four using the `layout.helper.ts` primitives from §3.2. Each should visually match its reference `.docx` section-for-section. Two full examples below; apply the same pattern to the other two.

### 6.1 `backend/src/documents/templates/medical-certificate.template.ts`

```ts
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawGenerationDate, drawSignatureBlock, drawAssessmentList, drawMedicationList, formatPatientName, formatPatientAddress, computeAge } from './layout.helper';

export const renderMedicalCertificate = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'MEDICAL CERTIFICATE');
    drawGenerationDate(doc);

    doc.font('Helvetica-Bold').text('TO WHOM IT MAY CONCERN:');
    doc.moveDown(0.5);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';
    const address = formatPatientAddress(data.patient);
    const visitDateStr = data.latestVisitDate
      ? new Date(data.latestVisitDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    doc.font('Helvetica').fontSize(10).text(
      `This is to certify that ${formatPatientName(data.patient)}, ${age} years old / ${sex} residing at ${address} sought consult on ${visitDateStr} with the complaint of ${data.chiefComplaint}.`,
      { align: 'justify' }
    );
    doc.moveDown();

    drawAssessmentList(doc, data.assessment);

    doc.font('Helvetica-Bold').text('Medications Given:');
    doc.font('Helvetica');
    drawMedicationList(doc, data.medications);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Recommendations:');
    doc.font('Helvetica').text(data.recommendation, { align: 'justify' });

    drawSignatureBlock(doc, data.physician, 'Signed By:');
    doc.end();
  });
};
```

### 6.2 `backend/src/documents/templates/referral-letter.template.ts` (new file)

```ts
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawGenerationDate, drawSignatureBlock, drawAssessmentList, drawMedicationList, formatPatientName, computeAge } from './layout.helper';

export const renderReferralLetter = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'REFERRAL LETTER');
    drawGenerationDate(doc);

    doc.font('Helvetica').fontSize(10).text(`To ${data.referralRecipient}:`);
    doc.moveDown(0.5);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';
    doc.text(`I am kindly referring my patient ${formatPatientName(data.patient)}, ${age} years old / ${sex} with the following assessment:`, { align: 'justify' });
    doc.moveDown(0.5);

    drawAssessmentList(doc, data.assessment);

    doc.font('Helvetica-Bold').text('Salient points: ', { continued: true }).font('Helvetica').text(data.salientPoints);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Reason for referral: ', { continued: true }).font('Helvetica').text(data.referralReason);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('He/She is currently on the following medications:');
    doc.font('Helvetica');
    drawMedicationList(doc, data.medications);

    drawSignatureBlock(doc, data.physician, 'Yours Truly,');
    doc.end();
  });
};
```

### 6.3 `lab-request.template.ts` (Diagnostic Request)

Same skeleton: letterhead titled `DIAGNOSTICS REQUEST`, generation date, `drawPatientBlock(doc, data.patient)`, then an `Assessment:` section via `drawAssessmentList(doc, data.assessment)`, then a `DIAGNOSTIC TESTS REQUESTED` section bulleting `data.diagnostics` (a `string[]` — bullet each entry directly, no JSON dump), then `drawSignatureBlock(doc, data.physician, 'Requested By:')`.

### 6.4 `prescription.template.ts`

Same skeleton: letterhead titled `PRESCRIPTION`, generation date, `drawPatientBlock(doc, data.patient)`, then an `Rx` header, then `drawMedicationList(doc, data.medications)` formatted per the reference (`Name Dose  #Qty` on one line, `Sig: instructions` on the next — already matches `drawMedicationList`'s output), then `drawSignatureBlock(doc, data.physician, 'Signed By:')`.

### 6.5 Do not touch `charge-slip.template.ts`

Out of scope for this task — no reference document was provided for it, leave its current stub behavior as-is.

---

## 7. Frontend

### 7.1 Types

Add to wherever shared API types live (check `frontend/src/lib/types.ts` or equivalent; if it doesn't exist as a shared file, colocate in `hooks/useDocuments.ts`):

```ts
export interface DocumentDraftData {
  patient: any;
  physician: { id: string; firstName: string; lastName: string } | null;
  candidateDoctors: { id: string; firstName: string; lastName: string }[];
  assessment: { title: string; icdCode?: string }[] | null;
  diagnostics: string[] | null;
  medications: any[];
  chiefComplaintDefault?: string;
  latestVisitDate?: string | null;
}
```

### 7.2 `frontend/src/hooks/useDocuments.ts` additions

```ts
export function useDocumentDraft(patientId: string, type: string, visitId?: string, enabled = true) {
  return useQuery({
    queryKey: ['documents', patientId, 'draft', type, visitId],
    queryFn: () => apiRequest<DocumentDraftData>(
      `/patients/${patientId}/documents/draft?type=${type}${visitId ? `&visitId=${visitId}` : ''}`
    ),
    enabled: enabled && !!patientId && !!type,
    staleTime: 0, // always fresh — clinical data changes frequently
  });
}
```

Update `useGenerateDocument`'s `mutationFn` param type from `{ type: string; visitId?: string }` to `Record<string, any>` (or a proper discriminated union) so it can pass through `chiefComplaint`, `recommendation`, `referralRecipient`, `salientPoints`, `referralReason`, `physicianId`.

### 7.3 Modal flow

Keep `DocumentGeneratorModal.tsx` as the entry point (type picker), but branch behavior on selection:

- **`LAB_REQUEST`, `PRESCRIPTION`, `CHARGE_SLIP`**: unchanged — direct "Generate PDF" button, same as today.
- **`MEDICAL_CERTIFICATE`, `REFERRAL_LETTER`**: instead of "Generate PDF" being immediately actionable, show a **"Continue to Draft"** button that swaps the modal body into a two-step view (or opens a second modal — prefer swapping the body of the same modal to avoid modal-stacking).

Build two new components: `frontend/src/components/documents/MedicalCertificateModal.tsx` and `frontend/src/components/documents/ReferralLetterModal.tsx`. Each:

1. Calls `useDocumentDraft(patientId, TYPE, visitId)` on mount.
2. Renders a read-only preview panel styled to loosely resemble the final document (clinic name, patient name/age/sex, assessment bullet list, medication list) — this is the "view draft" requirement. It does not need to be pixel-perfect PDF fidelity; a clean card-based summary using existing `bg-surface-2`/`border-border` tokens from `design-standard.md` is sufficient.
3. Below the preview, renders the type-specific free-text inputs as `<textarea>`s using the existing form styling from `DocumentGeneratorModal.tsx` (`className="... bg-surface border border-border rounded-btn ..."`):
   - Medical Certificate: `Chief Complaint` (pre-filled from `draft.chiefComplaintDefault`, editable), `Recommendation` (empty).
   - Referral Letter: `Referral Recipient`, `Salient Points`, `Reason for Referral` (all empty).
4. If `draft.physician` is `null`, render a required `<select>` populated from `draft.candidateDoctors`, bound to `physicianId` in the mutation payload. If `draft.physician` is set, show it as read-only text (`Dr. {firstName} {lastName}`) with no picker.
5. Disable the "Generate PDF" button until all required free-text fields are non-empty (and `physicianId` is chosen if the doctor is ambiguous).
6. On submit, call `useGenerateDocument(patientId).mutate({ type: TYPE, visitId, ...freeTextFields, physicianId })`.
7. Reuses the same loading/error handling pattern already in `DocumentGeneratorModal.tsx` (`generateDoc.isPending`, `alert(err.message)` on error — or upgrade to a toast if the codebase has one elsewhere; check before assuming `alert` is acceptable long-term, but it's consistent with current behavior).

Wire `DocumentGeneratorModal.tsx` to render `<MedicalCertificateModal>` / `<ReferralLetterModal>` in place of its own footer when `docType` is one of those two values, passing `patientId`, `visitId`, and `onClose` through.

### 7.4 Document type picker copy

Add the new option to the `<select>` in `DocumentGeneratorModal.tsx`:

```tsx
<option value="REFERRAL_LETTER">Referral Letter</option>
```

Update the informational note below the dropdown to mention that Medical Certificate and Referral Letter require a short additional step to fill in clinical narrative before the PDF is generated.

---

## 8. Validation & error handling checklist

- [ ] `chiefComplaint`, `recommendation` required (non-empty after trim) before `MEDICAL_CERTIFICATE` generate is enabled client-side, **and** enforced server-side in the DTO/service (client checks are UX only, never trust-only).
- [ ] `referralRecipient`, `salientPoints`, `referralReason` required for `REFERRAL_LETTER`, same client+server enforcement.
- [ ] `physicianId` required whenever `draft.physician` is `null` (i.e., a nurse/admin is generating and there's no doctor-authored visit to fall back on).
- [ ] `physicianId`, if supplied, must resolve to a user with `role === DOCTOR` — 400 otherwise.
- [ ] Draft endpoint and generate endpoint both 404 if `patientId` doesn't exist.
- [ ] Character limits on free-text fields match the DTO `@MaxLength` values in both the backend DTO and the frontend `<textarea maxLength={...}>` so users get inline feedback instead of a failed request.

---

## 9. Rollout checklist

1. `npx prisma migrate dev --name add_referral_letter_and_physician_credentials` (backend).
2. Backfill `licenseNumber` / `ptrNumber` / `s2Number` for existing `DOCTOR` accounts (manual, via account edit screen or a one-off script — not required before merge, but flag it to the user since documents generated for doctors without these values will print `N/A`).
3. Add `CLINIC_*` env vars to all deployed environments (Vercel/Render/wherever backend is hosted), matching `.env.example`.
4. Regenerate Prisma client: `npx prisma generate`.
5. Run `npm run build` in `backend/` to confirm the new templates and DTOs compile.
6. Manually generate one of each of the four document types against a test patient and diff visually against the reference `.docx` files (layout, not byte-for-byte).
7. Confirm `useDocuments`/audit-log invalidation still fires on generate (unchanged, but verify the new mutation payload shape didn't break `onSuccess`).

---

## 10. Explicitly out of scope

- `CHARGE_SLIP` template — no reference document supplied, left as-is.
- Multi-clinic / multi-tenant clinic configuration — single `clinicConfig` object is sufficient for this deployment model.
- Persisting free-text inputs (`chiefComplaint`, `recommendation`, `referralRecipient`, `salientPoints`, `referralReason`) as queryable DB columns — they are one-shot inputs baked into the generated PDF only.
- PDF template visual polish beyond matching the reference `.docx` structure (e.g., no custom fonts/logos requested).