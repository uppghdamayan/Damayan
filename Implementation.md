# DAMAYAN — Exact-Match Document Templates (Medical Certificate, Referral Letter, Diagnostic Request, Prescription)

**Target repo:** `uppghdamayan/Damayan`
**Supersedes/extends:** `Document-Generation-Implementation.md` (architecture doc — schema changes, DTOs, service structure, modal flow). Read that first for *why*; this file is the *exact what* for the four PDF templates. Where the two disagree on wording, **this file wins**.

## 0. The one rule that matters

Every static label, heading, and boilerplate sentence in the four templates below must be reproduced **verbatim, character-for-character** — same capitalization, same punctuation, same colons (or absence of colons), same line breaks. Only the `{{placeholder}}` tokens are dynamic. Do not rephrase, "improve," reformat, or reorder any static text. If you're unsure whether something is static boilerplate or clinician-entered free text, check §5 (field classification table) before guessing.

The four reference documents this spec is built from (already in the repo owner's possession, one already-generated real example per type):
1. `Diagnostic Request.docx`
2. `Medical Certificate.docx`
3. `Prescription.docx`
4. `Referral Letter.docx`

---

## 1. Shared letterhead (identical on all four documents)

```
METRO HEALTH CLINIC & DIAGNOSTIC CENTER
Unit 405, Medical Arts Building, St. Jude General Hospital
456 Taft Avenue, Ermita, Manila, Philippines
Tel No.: (02) 8123-4567 | Email: contact@metrohealthclinic.ph
```

- Line 1: bold, centered, larger font (clinic name).
- Lines 2–4: regular weight, centered, smaller font.
- All four values come from `clinicConfig` (see architecture doc §3.1) — **do not hardcode** these strings in the templates; hardcode them only in `clinic.config.ts` defaults so the clinic can override via env vars without touching template code.

Directly below the letterhead, each document prints its own bold, centered title (see each section below) — `DIAGNOSTICS REQUEST`, `MEDICAL CERTIFICATE`, `PRESCRIPTION`, `REFERRAL LETTER`. Note **"DIAGNOSTICS REQUEST"** is plural — not "Diagnostic Request." Reproduce exactly.

## 2. Shared signature block pattern

Three of the four documents end with:

```
{{signOffLabel}}

(Signed)

{{physicianName}}
Lic. No.: {{licenseNumber}}
PTR No.: {{ptrNumber}}
S2 No.: {{s2Number}}
```

**Prescription is the exception** — it omits the `(Signed)` line entirely:

```
{{signOffLabel}}

{{physicianName}}
Lic. No.: {{licenseNumber}}
PTR No.: {{ptrNumber}}
S2 No.: {{s2Number}}
```

`{{signOffLabel}}` per document:

| Document | Label |
|---|---|
| Diagnostic Request | `Requested By:` |
| Medical Certificate | `Signed By:` |
| Prescription | `Signed By:` |
| Referral Letter | `Yours Truly,` |

`{{physicianName}}` format: `Dr. {firstName} {middleInitial}. {lastName}, MD` (e.g. `Dr. Maria Clara S. Santos, MD`). Omit the middle-initial segment entirely if `middleName` is null.

If any of `licenseNumber` / `ptrNumber` / `s2Number` is null on the physician's account, print `N/A` — this exactly matches the reference `Diagnostic Request.docx`, which prints `S2 No.: N/A` for a physician who has no S2 license.

---

## 3. Template 1 — Diagnostic Request (`DocumentType.LAB_REQUEST`)

### 3.1 Literal layout

```
[LETTERHEAD]

DIAGNOSTICS REQUEST

Date of Generation: {{generationDate}}

Name of Patient: {{patientName}} 	Age: {{age}} years old		Sex: {{sex}}
Patient Address: {{patientAddress}}

Assessment:

{{#each assessment}}
- {{title}}
{{/each}}

DIAGNOSTIC TESTS REQUESTED

{{#each diagnostics}}
- {{item}}
{{/each}}

Requested By:

(Signed)

{{physicianName}}
Lic. No.: {{licenseNumber}}
PTR No.: {{ptrNumber}}
S2 No.: {{s2Number}}
```

Notes:
- `Assessment:` has a trailing colon. `DIAGNOSTIC TESTS REQUESTED` does **not** — reproduce that inconsistency exactly, it's in the source document.
- Assessment bullets: one per latest `InitialNote.assessment[].title`, dash-prefixed, no ICD code appended (the reference never shows one — if you want ICD data recoverable later, store it in the DB as today, just don't print it here).
- Diagnostic test bullets: one per latest `InitialNote.diagnostics[]` string, dash-prefixed, printed verbatim (no JSON, no transformation).
- `Name of Patient / Age / Sex` sit on one line; `Patient Address` on the line below. No free text required anywhere in this document.

### 3.2 PDFKit implementation

```ts
// backend/src/documents/templates/lab-request.template.ts
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawGenerationDate, drawSignatureBlock, formatPatientName, formatPatientAddress, computeAge } from './layout.helper';

export const renderLabRequest = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'DIAGNOSTICS REQUEST');
    drawGenerationDate(doc);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';

    doc.fontSize(10).font('Helvetica-Bold').text('Name of Patient: ', { continued: true })
       .font('Helvetica').text(`${formatPatientName(data.patient)}    `, { continued: true })
       .font('Helvetica-Bold').text('Age: ', { continued: true })
       .font('Helvetica').text(`${age} years old    `, { continued: true })
       .font('Helvetica-Bold').text('Sex: ', { continued: true })
       .font('Helvetica').text(sex);

    doc.font('Helvetica-Bold').text('Patient Address: ', { continued: true })
       .font('Helvetica').text(formatPatientAddress(data.patient));
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Assessment:');
    doc.font('Helvetica');
    (data.assessment ?? []).forEach((a: { title: string }) => doc.text(`- ${a.title}`));
    doc.moveDown();

    doc.font('Helvetica-Bold').text('DIAGNOSTIC TESTS REQUESTED');
    doc.font('Helvetica');
    (data.diagnostics ?? []).forEach((d: string) => doc.text(`- ${d}`));

    drawSignatureBlock(doc, data.physician, 'Requested By:');
    doc.end();
  });
};
```

---

## 4. Template 2 — Medical Certificate (`DocumentType.MEDICAL_CERTIFICATE`)

### 4.1 Literal layout

```
[LETTERHEAD]

MEDICAL CERTIFICATE

Date of Generation: {{generationDate}}

TO WHOM IT MAY CONCERN:

This is to certify that {{patientName}}, {{age}} years old / {{sex}} residing at {{patientAddress}} sought consult on {{latestVisitDate}} with the complaint of {{chiefComplaint}}.

Assessment:

{{#each assessment}}
- {{title}}
{{/each}}

Medications Given:

{{#each medications}}
- {{name}} {{dose}} {{instructions}}
{{/each}}

Recommendations:

{{recommendation}}

This certification is issued upon the request of the patient for medical clearance / work excuse purposes and should not be used for any legal proceedings unless specified.

Signed By:

(Signed)

{{physicianName}}
Lic. No.: {{licenseNumber}}
PTR No.: {{ptrNumber}}
S2 No.: {{s2Number}}
```

**Critical field classification** (this is the part most likely to be gotten wrong):

- `{{chiefComplaint}}` — free text, clinician-entered in the generate modal. It's a **clause**, not a sentence (it completes "...sought consult on [date] with the complaint of ___."). Pre-fill the input with the latest `InitialNote.chiefComplaint` as an editable default, but the clinician should edit it into full clause form if the stored value is telegraphic — e.g. stored `chiefComplaint` might be `"high-grade fever"` while the certificate needs `"acute onset of high-grade fever, severe headache, and generalized muscle/joint pain for three (3) days"`. Don't auto-expand this — just prefill and let the doctor type the real clause.
- `{{recommendation}}` — free text, clinician-entered, **multi-paragraph**. In the reference document this single field spans three paragraphs (bed-rest instructions with specific dates, medication/fluid instructions, follow-up instructions with a specific return date). Render it as-is with paragraph breaks preserved (`\n\n` in the textarea → separate `doc.text()` / `doc.moveDown()` calls, or just pass the raw string to `doc.text()` with `{ align: 'justify' }` — PDFKit renders embedded `\n` as line breaks natively).
- The final sentence (`"This certification is issued upon the request of the patient..."`) is **fixed boilerplate**, not part of the clinician's free text. Append it automatically after `{{recommendation}}`, always, verbatim. Store it as a constant, e.g. `MEDICAL_CERTIFICATE_DISCLAIMER`, in `layout.helper.ts` or the template file itself.
- `Medications Given` bullet format is `{{name}} {{dose}} {{instructions}}` on one line, **no `Sig:` prefix** — this is different from the Prescription template's two-line `Sig:` format. Don't reuse the same medication-list renderer for both; they render differently. Example from the reference: `Paracetamol 500mg every 6 hours as needed for fever or pain` (name + dose + instructions, space-joined, no bullet punctuation beyond the leading dash).

### 4.2 PDFKit implementation

```ts
// backend/src/documents/templates/medical-certificate.template.ts
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawGenerationDate, drawSignatureBlock, formatPatientName, formatPatientAddress, computeAge } from './layout.helper';

const MEDICAL_CERTIFICATE_DISCLAIMER =
  'This certification is issued upon the request of the patient for medical clearance / work excuse purposes and should not be used for any legal proceedings unless specified.';

export const renderMedicalCertificate = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'MEDICAL CERTIFICATE');
    drawGenerationDate(doc);

    doc.fontSize(10).font('Helvetica-Bold').text('TO WHOM IT MAY CONCERN:');
    doc.moveDown(0.5);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';
    const address = formatPatientAddress(data.patient);
    const visitDateStr = new Date(data.latestVisitDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.font('Helvetica').text(
      `This is to certify that ${formatPatientName(data.patient)}, ${age} years old / ${sex} residing at ${address} sought consult on ${visitDateStr} with the complaint of ${data.chiefComplaint}.`,
      { align: 'justify' }
    );
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Assessment:');
    doc.font('Helvetica');
    (data.assessment ?? []).forEach((a: { title: string }) => doc.text(`- ${a.title}`));
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Medications Given:');
    doc.font('Helvetica');
    if (data.medications?.length) {
      data.medications.forEach((m: any) => doc.text(`- ${[m.name, m.dose, m.instructions].filter(Boolean).join(' ')}`));
    } else {
      doc.text('- No active medications on record.');
    }
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Recommendations:');
    doc.moveDown(0.3);
    doc.font('Helvetica').text(data.recommendation, { align: 'justify' });
    doc.moveDown();
    doc.text(MEDICAL_CERTIFICATE_DISCLAIMER, { align: 'justify' });

    drawSignatureBlock(doc, data.physician, 'Signed By:');
    doc.end();
  });
};
```

---

## 5. Template 3 — Prescription (`DocumentType.PRESCRIPTION`)

### 5.1 Literal layout

```
[LETTERHEAD]

PRESCRIPTION

Date of Generation: {{generationDate}}

Name of Patient: {{patientName}} 	Age: {{age}} years old		Sex: {{sex}}
Patient Address: {{patientAddress}}

Rx

{{#each medications}}
{{name}} {{dose}}{{formulation}}								#{{quantity}}
Sig: {{instructions}}

{{/each}}
Signed By:

{{physicianName}}
Lic. No.: {{licenseNumber}}
PTR No.: {{ptrNumber}}
S2 No.: {{s2Number}}
```

Notes:
- `Rx` on its own line, bold, no colon.
- Each medication is **two lines**: line 1 is `{name} {dose}{formulation}` left-aligned with the `#{quantity}` right-aligned on the same visual row (reference uses tab-stops to right-align the quantity — in PDFKit, use `doc.text(nameAndDose, { continued: false })` then a second call with `{ align: 'right' }` at the same `y` via `doc.text(qty, x, y, { align: 'right' })`, or simpler: fixed-width padding). Line 2 is `Sig: {instructions}`, indented or same margin as line 1.
- Blank line between medication entries.
- **No `(Signed)` line** before the physician name — confirmed by the reference `Prescription.docx`, which is the only one of the four that goes straight from `Signed By:` to the doctor's name with no signature placeholder line between them.
- No `Assessment` section on this document at all.

### 5.2 PDFKit implementation

```ts
// backend/src/documents/templates/prescription.template.ts
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawGenerationDate, drawSignatureBlock, formatPatientName, formatPatientAddress, computeAge } from './layout.helper';

export const renderPrescription = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'PRESCRIPTION');
    drawGenerationDate(doc);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';

    doc.fontSize(10).font('Helvetica-Bold').text('Name of Patient: ', { continued: true })
       .font('Helvetica').text(`${formatPatientName(data.patient)}    `, { continued: true })
       .font('Helvetica-Bold').text('Age: ', { continued: true })
       .font('Helvetica').text(`${age} years old    `, { continued: true })
       .font('Helvetica-Bold').text('Sex: ', { continued: true })
       .font('Helvetica').text(sex);

    doc.font('Helvetica-Bold').text('Patient Address: ', { continued: true })
       .font('Helvetica').text(formatPatientAddress(data.patient));
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(13).text('Rx');
    doc.moveDown(0.3);
    doc.fontSize(10);

    if (data.medications?.length) {
      data.medications.forEach((m: any) => {
        const rightMargin = doc.page.width - doc.page.margins.right;
        const startY = doc.y;
        doc.font('Helvetica-Bold').text(`${m.name} ${m.dose}${m.formulation ? ` ${m.formulation}` : ''}`, doc.page.margins.left, startY, { continued: false });
        if (m.quantity) {
          doc.font('Helvetica').text(`#${m.quantity}`, doc.page.margins.left, startY, { width: rightMargin - doc.page.margins.left, align: 'right' });
        }
        doc.font('Helvetica').fontSize(9).text(`Sig: ${m.instructions ?? ''}`, doc.page.margins.left);
        doc.fontSize(10).moveDown(0.6);
      });
    } else {
      doc.font('Helvetica').text('No active medications on record.');
    }

    drawSignatureBlock(doc, data.physician, 'Signed By:', /* includeSignedPlaceholder */ false);
    doc.end();
  });
};
```

`drawSignatureBlock` in `layout.helper.ts` needs a 4th parameter (`includeSignedPlaceholder: boolean = true`) so Prescription can opt out of the `(Signed)` line — update the shared helper's signature:

```ts
export function drawSignatureBlock(
  doc: PDFKit.PDFDocument,
  physician: { firstName: string; lastName: string; middleName?: string | null; licenseNumber?: string | null; ptrNumber?: string | null; s2Number?: string | null },
  label: string,
  includeSignedPlaceholder: boolean = true,
) {
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica').text(label);
  if (includeSignedPlaceholder) {
    doc.moveDown(1.5);
    doc.font('Helvetica-Italic').text('(Signed)');
    doc.moveDown(0.5);
  } else {
    doc.moveDown(1);
  }
  doc.font('Helvetica-Bold').text(formatPhysicianName(physician));
  doc.font('Helvetica').fontSize(9);
  doc.text(`Lic. No.: ${physician.licenseNumber ?? 'N/A'}`);
  doc.text(`PTR No.: ${physician.ptrNumber ?? 'N/A'}`);
  doc.text(`S2 No.: ${physician.s2Number ?? 'N/A'}`);
}
```

(This replaces the version of `drawSignatureBlock` given in the architecture doc — that version didn't render `(Signed)` at all. Use this one.)

---

## 6. Template 4 — Referral Letter (`DocumentType.REFERRAL_LETTER`, new)

### 6.1 Literal layout

```
[LETTERHEAD]

REFERRAL LETTER

Date of Generation: {{generationDate}}

To {{referralRecipient}}:

I am kindly referring my patient {{patientName}}, {{age}} years old / {{sex}} with the following assessment:

{{#each assessment}}
- {{title}}
{{/each}}

Salient points: {{salientPoints}}

Reason for referral: {{referralReason}}

He is currently on the following medications:

{{#each medications}}
- {{name}} {{dose}}{{formulation}} {{instructions}}
{{/each}}

Yours Truly,

(Signed)

{{physicianName}}
Lic. No.: {{licenseNumber}}
PTR No.: {{ptrNumber}}
S2 No.: {{s2Number}}
```

Notes:
- `{{referralRecipient}}` is free text exactly as typed by the clinician, including title and specialty parenthetical — e.g. `Dr. Timoteo Gonzales (Infectious Disease)`. Print verbatim after `To ` and before the trailing colon: `To {{referralRecipient}}:`.
- No patient address, no separate age/sex line block — identity is inline in the referral sentence only, matching the reference exactly (this document has less patient-identifying detail than the other three).
- `Salient points:` and `Reason for referral:` are **not section headers on their own line** — they're bold inline labels followed immediately by the free-text value on the same paragraph/line, each its own paragraph. Do not put the free text on a new line below the label.
- Medication bullet format here is a third variant, distinct from both the Medical Certificate's and Prescription's: `{name} {dose}{formulation} {instructions}` all on one dash-prefixed line, no `Sig:` prefix, no quantity. Reference example: `Paracetamol 500 mg tab 1 tab every 6 hours as needed.`
- `He is currently on the following medications:` is fixed boilerplate (not free text) — always print this exact sentence before the medication bullets. Note the reference always refers to the patient as "He" — since sex varies per patient, generate the pronoun dynamically: `He` for `MALE`, `She` for `FEMALE`, rather than hardcoding — this is the one deliberate deviation from literal reproduction, required for correctness across patients.

### 6.2 PDFKit implementation

```ts
// backend/src/documents/templates/referral-letter.template.ts
import PDFDocument from 'pdfkit';
import { drawLetterhead, drawGenerationDate, drawSignatureBlock, formatPatientName, computeAge } from './layout.helper';

export const renderReferralLetter = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'REFERRAL LETTER');
    drawGenerationDate(doc);

    doc.fontSize(10).font('Helvetica').text(`To ${data.referralRecipient}:`);
    doc.moveDown(0.5);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';
    const pronoun = data.patient.sex === 'MALE' ? 'He' : 'She';

    doc.text(
      `I am kindly referring my patient ${formatPatientName(data.patient)}, ${age} years old / ${sex} with the following assessment:`,
      { align: 'justify' }
    );
    doc.moveDown(0.5);

    (data.assessment ?? []).forEach((a: { title: string }) => doc.text(`- ${a.title}`));
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Salient points: ', { continued: true })
       .font('Helvetica').text(data.salientPoints);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('Reason for referral: ', { continued: true })
       .font('Helvetica').text(data.referralReason);
    doc.moveDown(0.5);

    doc.font('Helvetica').text(`${pronoun} is currently on the following medications:`);
    if (data.medications?.length) {
      data.medications.forEach((m: any) =>
        doc.text(`- ${[m.name, `${m.dose}${m.formulation ? ` ${m.formulation}` : ''}`, m.instructions].filter(Boolean).join(' ')}`)
      );
    } else {
      doc.text('- No active medications on record.');
    }

    drawSignatureBlock(doc, data.physician, 'Yours Truly,');
    doc.end();
  });
};
```

---

## 7. Field classification table (free text vs. auto-populated vs. fixed boilerplate)

| Document | Field | Type |
|---|---|---|
| Medical Certificate | Chief Complaint | **free text**, modal input, pre-filled from `InitialNote.chiefComplaint` |
| Medical Certificate | Recommendations (multi-paragraph) | **free text**, modal input, no default |
| Medical Certificate | Final disclaimer sentence | **fixed boilerplate**, always appended, never editable |
| Medical Certificate | Assessment, Medications Given | auto-populated from latest `InitialNote.assessment` / active `Medication[]` |
| Referral Letter | Referral Recipient | **free text**, modal input |
| Referral Letter | Salient Points | **free text**, modal input |
| Referral Letter | Reason for Referral | **free text**, modal input |
| Referral Letter | "He/She is currently on the following medications:" | **fixed boilerplate**, pronoun auto-derived from `patient.sex` |
| Referral Letter | Assessment, medication bullets | auto-populated |
| Diagnostic Request | everything | auto-populated — **no modal free text at all** |
| Prescription | everything | auto-populated — **no modal free text at all** |

This table should directly drive the `GenerateDocumentDto` conditional validation (`@ValidateIf`) already specified in the architecture doc §4.1 — no changes needed there, just confirming the free-text field list matches exactly what's in this table (it does).

---

## 8. QA checklist — verify against the source `.docx` files directly

Before marking this done, generate one of each document type against a seeded test patient/visit/medications, export to PDF, and check off each line against the corresponding reference `.docx`:

- [ ] Letterhead: 4 lines, exact clinic name/address/tel/email, centered.
- [ ] Document title directly below letterhead, bold, centered, exact casing (`DIAGNOSTICS REQUEST` is plural).
- [ ] `Date of Generation:` uses `Month D, YYYY` format (e.g. `July 12, 2026`), generated at PDF-creation time, not a stored/edited date.
- [ ] Diagnostic Request & Prescription: `Name of Patient / Age / Sex` on one line, `Patient Address` on the next.
- [ ] Diagnostic Request: `Assessment:` has a colon; `DIAGNOSTIC TESTS REQUESTED` does not.
- [ ] Medical Certificate: identity + chief complaint folded into one certifying sentence, not a separate patient block.
- [ ] Medical Certificate: `Medications Given` bullets have no `Sig:` prefix (name + dose + instructions on one line).
- [ ] Medical Certificate: fixed disclaimer sentence appears after the free-text Recommendations, verbatim, every time.
- [ ] Prescription: two-line-per-med format (`name/dose/qty` then `Sig:` line), quantity right-aligned.
- [ ] Prescription: **no `(Signed)` line** — straight from `Signed By:` to the doctor's name.
- [ ] Referral Letter: `To {{recipient}}:` line, no patient address, pronoun-correct medication intro sentence.
- [ ] Referral Letter: `Salient points:` and `Reason for referral:` are inline-labeled paragraphs, not section headers.
- [ ] All four: signature block shows `Lic. No.`, `PTR No.`, `S2 No.`, falling back to `N/A` when a physician record has nulls.
- [ ] All four except Prescription: `(Signed)` italic placeholder line present between the sign-off label and the doctor's name.

If every box above is true, the output is considered a correct implementation of this spec.