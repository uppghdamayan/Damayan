import PDFDocument from 'pdfkit';
import {
  drawLetterhead,
  drawGenerationDate,
  drawSignatureBlock,
  drawMedicationList,
  drawPatientBlock,
} from './layout.helper';

export const renderPrescription = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'PRESCRIPTION');
    drawGenerationDate(doc);
    drawPatientBlock(doc, data.patient);
    doc.moveDown(1);
    // Rx is large bold (36pt) as shown in reference image
    doc.fontSize(36).font('Helvetica-Bold').text('Rx');
    // Reset to 10pt BEFORE moveDown so the gap is calculated at body-text size
    doc.fontSize(10).moveDown(0.8);
    drawMedicationList(doc, data.medications);

    // Prescription has NO (Signed) line — explicit false
    drawSignatureBlock(doc, data.physician, 'Signed By:', false);
    doc.end();
  });
};
