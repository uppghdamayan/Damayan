import { clinicConfig } from '../../config/clinic.config';

export function drawLetterhead(doc: any, title: string) {
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(clinicConfig.name, { align: 'center' });
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
  showSigned = false,
) {
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica-Bold').text(label);
  if (showSigned) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Oblique').text('(Signed)');
    doc.moveDown(0.8);
  } else {
    doc.moveDown(3);
  }
  doc.font('Helvetica-Bold').text(formatPhysicianName(physician));
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

  // Age (shifted further right)
  doc
    .font('Helvetica-Bold')
    .text('Age: ', startX + 270, y, { continued: true })
    .font('Helvetica')
    .text(`${computeAge(patient.dateOfBirth)} years old`);

  // Sex (shifted further right)
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

export function drawAssessmentList(
  doc: any,
  assessment: { title: string; icdCode?: string | null }[] | null,
) {
  doc.font('Helvetica-Bold').fontSize(10).text('Assessment:');
  doc.font('Helvetica');
  if (assessment && assessment.length > 0) {
    assessment.forEach((a) =>
      doc.text(`•  ${a.title}${a.icdCode ? ` (${a.icdCode})` : ''}`),
    );
  } else {
    doc.text('•  No assessment on record.');
  }
  doc.moveDown(0.5);
}

export function drawMedicationList(doc: any, medications: any[]) {
  if (!medications || medications.length === 0) {
    doc.font('Helvetica').text('No active medications on record.');
    return;
  }

  const startX = doc.page.margins.left;
  const rightMargin = doc.page.width - doc.page.margins.right;
  const safetyMargin = 60; // points reserved on the right for the quantity

  medications.forEach((med) => {
    const y = doc.y;

    // Draw quantity first to avoid continued:true formatting issues
    if (med.quantity) {
      doc.font('Helvetica').text(`#${med.quantity}`, startX, y, {
        align: 'right',
        width: rightMargin - startX,
      });
    }

    // Draw medication name and formulation with limited width to avoid overlap
    doc
      .font('Helvetica-Bold')
      .text(med.name, startX, y, {
        continued: true,
        width: rightMargin - startX - safetyMargin,
      })
      .font('Helvetica')
      .text(` ${med.dose}${med.formulation ? ` ${med.formulation}` : ''}`);

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

export function drawBulletedMedicationList(doc: any, medications: any[]) {
  if (!medications || medications.length === 0) {
    doc
      .font('Helvetica')
      .text('•  No active medications on record.', { indent: 20 });
    return;
  }
  doc.font('Helvetica');
  medications.forEach((med) => {
    const parts = [med.name, med.dose, med.formulation, med.instructions]
      .filter(Boolean)
      .join(' ');
    doc.text(`•  ${parts}`, { indent: 20 });
    doc.moveDown(0.3);
  });
}
