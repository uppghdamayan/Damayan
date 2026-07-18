import PDFDocument from 'pdfkit';
import {
  drawLetterhead,
  drawGenerationDate,
  drawSignatureBlock,
  drawAssessmentList,
  drawReferralMedicationList,
  formatPatientName,
  computeAge,
} from './layout.helper';

export const renderReferralLetter = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawLetterhead(doc, 'REFERRAL LETTER');
    drawGenerationDate(doc);

    // "To <recipient>:" — recipient is underlined per reference image
    doc.font('Helvetica').fontSize(10).text('To ', { continued: true });
    doc.text(data.referralRecipient, { underline: true, continued: true });
    doc.text(':');
    doc.moveDown(0.5);

    const age = computeAge(data.patient.dateOfBirth);
    const sex = data.patient.sex === 'MALE' ? 'Male' : 'Female';
    const pronoun = data.patient.sex === 'MALE' ? 'He' : 'She';

    // Underlined dynamic patient fields
    doc.text('I am kindly referring my patient ', {
      align: 'justify',
      continued: true,
    });
    doc.text(formatPatientName(data.patient), {
      underline: true,
      continued: true,
    });
    doc.text(', ', { continued: true });
    doc.text(`${age} years old / ${sex}`, { underline: true, continued: true });
    doc.text(' with the following assessment:');
    doc.moveDown(0.5);

    drawAssessmentList(doc, data.assessment);

    // "Salient points:" bold label, value underlined — matches reference image
    doc
      .font('Helvetica-Bold')
      .text('Salient points: ', { continued: true })
      .font('Helvetica')
      .text(data.salientPoints, { underline: true });
    doc.moveDown(0.3);

    // "Reason for referral:" bold label, value underlined — matches reference image
    doc
      .font('Helvetica-Bold')
      .text('Reason for referral: ', { continued: true })
      .font('Helvetica')
      .text(data.referralReason, { underline: true });
    doc.moveDown(0.5);

    doc
      .font('Helvetica')
      .text(`${pronoun} is currently on the following medications:`);
    doc.moveDown(0.3);
    drawReferralMedicationList(doc, data.medications);

    drawSignatureBlock(doc, data.physician, 'Yours Truly,');
    doc.end();
  });
};
