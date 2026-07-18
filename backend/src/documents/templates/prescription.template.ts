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
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'PRESCRIPTION');
    drawGenerationDate(doc);
    drawPatientBlock(doc, data.patient);
    doc.moveDown(2);
    doc.fontSize(36).font('Helvetica-Bold').text('Rx');
    doc.fontSize(10).font('Helvetica');
    doc.moveDown(1);
    drawMedicationList(doc, data.medications);

    drawSignatureBlock(doc, data.physician, 'Signed By:', false);
    doc.end();
  });
};
