import PDFDocument from 'pdfkit';
import {
  drawLetterhead,
  drawGenerationDate,
  drawSignatureBlock,
  drawAssessmentList,
  drawPatientBlock,
} from './layout.helper';

export const renderLabRequest = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'DIAGNOSTICS REQUEST');
    drawGenerationDate(doc);
    drawPatientBlock(doc, data.patient);
    doc.moveDown(0.5);

    drawAssessmentList(doc, data.assessment);

    doc.font('Helvetica-Bold').fontSize(10).text('DIAGNOSTIC TESTS REQUESTED');
    doc.font('Helvetica');
    if (data.diagnostics && data.diagnostics.length > 0) {
      data.diagnostics.forEach((d: string) => doc.text(`- ${d}`));
    } else {
      doc.text('- No tests requested.');
    }

    drawSignatureBlock(doc, data.physician, 'Requested By:');
    doc.end();
  });
};
