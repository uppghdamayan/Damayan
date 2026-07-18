import PDFDocument from 'pdfkit';
import {
  drawLetterhead,
  drawGenerationDate,
  drawSignatureBlock,
  drawAssessmentList,
  drawBulletedMedicationList,
  formatPatientName,
  computeAge,
} from './layout.helper';

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

    doc
      .font('Helvetica-Bold')
      .text('Salient points: ', { continued: true })
      .font('Helvetica')
      .text(data.salientPoints);
    doc.moveDown(0.3);
    doc
      .font('Helvetica-Bold')
      .text('Reason for referral: ', { continued: true })
      .font('Helvetica')
      .text(data.referralReason);
    doc.moveDown(0.5);

    doc
      .font('Helvetica-Bold')
      .text('He/She is currently on the following medications:');
    doc.moveDown(0.3);
    drawBulletedMedicationList(doc, data.medications);
    doc.moveDown(1);

    drawSignatureBlock(doc, data.physician, 'Yours Truly,', true);
    doc.end();
  });
};
