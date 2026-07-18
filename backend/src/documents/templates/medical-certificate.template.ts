import PDFDocument from 'pdfkit';
import {
  drawLetterhead,
  drawGenerationDate,
  drawSignatureBlock,
  drawAssessmentList,
  drawBulletedMedicationList,
  formatPatientName,
  formatPatientAddress,
  computeAge,
} from './layout.helper';

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
      ? new Date(data.latestVisitDate).toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'N/A';

    // Body text with underlined dynamic fields
    doc.font('Helvetica').fontSize(10);
    doc.text('This is to certify that ', { align: 'justify', continued: true });
    doc.text(formatPatientName(data.patient), {
      underline: true,
      continued: true,
    });
    doc.text(', ', { continued: true });
    doc.text(`${age} years old / ${sex}`, { underline: true, continued: true });
    doc.text(' residing at ', { continued: true });
    doc.text(address, { underline: true, continued: true });
    doc.text(' sought consult on ', { continued: true });
    doc.text(visitDateStr, { underline: true, continued: true });
    doc.text(' with the complaint of ', { continued: true });
    doc.text(data.chiefComplaint, { underline: true, continued: true });
    doc.text('.');
    doc.moveDown(1.5);

    drawAssessmentList(doc, data.assessment);

    doc.font('Helvetica-Bold').text('Medications Given:');
    doc.moveDown(0.3);
    drawBulletedMedicationList(doc, data.medications);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Recommendations:');
    doc.moveDown(0.3);
    doc.font('Helvetica').text(data.recommendation, { align: 'justify' });

    drawSignatureBlock(doc, data.physician, 'Signed By:', true);
    doc.end();
  });
};
