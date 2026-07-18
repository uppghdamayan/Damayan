import { clinicConfig } from '../../config/clinic.config';

export function drawLetterhead(doc: any, title: string) {
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(clinicConfig.name.toUpperCase(), { align: 'center' });
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(clinicConfig.addressLine1, { align: 'center' });
  doc.text(clinicConfig.addressLine2, { align: 'center' });
  doc.text(`Tel No.: ${clinicConfig.tel} | Email: ${clinicConfig.email}`, {
    align: 'center',
  });
  doc.moveDown(1.5);
  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown();
}

export function drawGenerationDate(doc: any, date: Date = new Date()) {
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const label = 'Date of Generation: ';
  const rightMargin = doc.page.width - doc.page.margins.right;
  const startX = doc.page.margins.left;

  const fullWidth =
    doc.font('Helvetica-Bold').fontSize(10).widthOfString(label) +
    doc.font('Helvetica').fontSize(10).widthOfString(dateStr);
  const x = rightMargin - fullWidth;

  doc.fontSize(10);
  doc
    .font('Helvetica-Bold')
    .text(label, x, doc.y, { continued: true })
    .font('Helvetica')
    .text(dateStr);
  doc.x = startX;
  doc.moveDown(1);
}

export function drawSignatureBlock(
  doc: any,
  physician: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    licenseNumber?: string | null;
    ptrNumber?: string | null;
    s2Number?: string | null;
  },
  label = 'Requested By:',
  includeSignedPlaceholder = true,
) {
  doc.moveDown(2);
  // Label is bold (matches reference images)
  doc.fontSize(10).font('Helvetica-Bold').text(label);
  if (includeSignedPlaceholder) {
    doc.moveDown(1.5);
    doc.font('Helvetica-Oblique').text('(Signed)');
    doc.moveDown(0.5);
  } else {
    // Prescription: gap with no (Signed) line
    doc.moveDown(2);
  }
  doc.font('Helvetica-Bold').fontSize(10).text(formatPhysicianName(physician));
  doc.font('Helvetica').fontSize(10);
  doc.text(`Lic. No.: ${physician.licenseNumber ?? 'N/A'}`);
  doc.text(`PTR No.: ${physician.ptrNumber ?? 'N/A'}`);
  doc.text(`S2 No.: ${physician.s2Number ?? 'N/A'}`);
}

export function formatPhysicianName(p: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
}): string {
  const mid = p.middleName ? ` ${p.middleName.charAt(0)}.` : '';
  return `Dr. ${p.firstName}${mid} ${p.lastName}, MD`;
}

export function formatPatientName(p: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  extension?: string | null;
}): string {
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
  addressStreet?: string | null;
  addressBarangay?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
  addressCountry: string;
}): string {
  return [
    p.addressStreet,
    p.addressBarangay ? `Barangay ${p.addressBarangay}` : null,
    p.addressCity,
    p.addressRegion,
    p.addressCountry,
  ]
    .filter(Boolean)
    .join(', ');
}

export function drawPatientBlock(
  doc: any,
  patient: any,
  includeAddress = true,
) {
  const startX = doc.page.margins.left;
  const y = doc.y;

  doc.fontSize(10);

  // Name of Patient
  doc
    .font('Helvetica-Bold')
    .text('Name of Patient: ', startX, y, { continued: true })
    .font('Helvetica')
    .text(formatPatientName(patient));

  // Age (shifted right, same visual row)
  doc
    .font('Helvetica-Bold')
    .text('Age: ', startX + 270, y, { continued: true })
    .font('Helvetica')
    .text(`${computeAge(patient.dateOfBirth)} years old`);

  // Sex (shifted further right, same visual row)
  doc
    .font('Helvetica-Bold')
    .text('Sex: ', startX + 410, y, { continued: true })
    .font('Helvetica')
    .text(
      patient.sex === 'MALE'
        ? 'Male'
        : patient.sex === 'FEMALE'
          ? 'Female'
          : 'Other',
    );

  doc.x = startX;
  doc.moveDown(0.2);

  if (includeAddress) {
    doc
      .font('Helvetica-Bold')
      .text('Patient Address: ', startX, doc.y, { continued: true })
      .font('Helvetica')
      .text(formatPatientAddress(patient), {
        width: doc.page.width - startX * 2,
      });
  }
  doc.moveDown(1);
}

/**
 * Assessment list with filled ● bullets (matches reference images for all docs)
 */
export function drawAssessmentList(
  doc: any,
  assessment: { title: string; icdCode?: string | null }[] | null,
) {
  doc.font('Helvetica-Bold').fontSize(10).text('Assessment:');
  doc.moveDown(0.3);
  doc.font('Helvetica');
  if (assessment && assessment.length > 0) {
    assessment.forEach((a) =>
      doc.text(`\u2022  ${a.title}`, { indent: 20 }),
    );
  } else {
    doc.text('\u2022  No assessment on record.', { indent: 20 });
  }
  doc.moveDown(0.5);
}

/**
 * Prescription medication list: bold name + dose/formulation left, #qty right-aligned.
 * Sig: line indented below.
 */
export function drawMedicationList(doc: any, medications: any[]) {
  if (!medications || medications.length === 0) {
    doc.font('Helvetica').text('No active medications on record.');
    return;
  }

  const startX = doc.page.margins.left;
  const rightMargin = doc.page.width - doc.page.margins.right;

  medications.forEach((med) => {
    const y = doc.y;

    // Draw medication name bold
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(med.name, startX, y, {
        continued: true,
      });

    // Build the dose and formulation string, then append quantity if present
    const detailParts = [
      med.dose,
      med.formulation
    ].filter(Boolean).join(' ');
    
    const qtyText = med.quantity ? ` #${med.quantity}` : '';

    doc
      .font('Helvetica')
      .text(` ${detailParts}${qtyText}`);

    doc.x = startX;
    if (med.instructions) {
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Sig: ${med.instructions}`, startX + 30, doc.y, {
          width: rightMargin - startX - 30,
        });
    }

    doc.x = startX;
    doc.moveDown(1);
  });
}

/**
 * Medical Certificate medication list:
 * ● name dose instructions  (no formulation, no Sig:) — matches reference image
 */
export function drawMedCertMedicationList(doc: any, medications: any[]) {
  if (!medications || medications.length === 0) {
    doc.font('Helvetica').text('\u2022  No active medications on record.', { indent: 20 });
    return;
  }
  doc.font('Helvetica');
  medications.forEach((med) => {
    const parts = [med.name, med.dose, med.instructions]
      .filter(Boolean)
      .join(' ');
    doc.text(`\u2022  ${parts}`, { indent: 20 });
  });
}

/**
 * Referral Letter medication list:
 * ● name dose formulation instructions  (no Sig:, no quantity) — matches reference image
 */
export function drawReferralMedicationList(doc: any, medications: any[]) {
  if (!medications || medications.length === 0) {
    doc.font('Helvetica').text('\u2022  No active medications on record.', { indent: 20 });
    return;
  }
  doc.font('Helvetica');
  medications.forEach((med) => {
    const parts = [
      med.name,
      `${med.dose}${med.formulation ? ` ${med.formulation}` : ''}`,
      med.instructions,
    ]
      .filter(Boolean)
      .join(' ');
    doc.text(`\u2022  ${parts}`, { indent: 20 });
  });
}

/**
 * Alias for drawMedCertMedicationList — kept for backwards compatibility.
 */
export function drawBulletedMedicationList(doc: any, medications: any[]) {
  drawMedCertMedicationList(doc, medications);
}
