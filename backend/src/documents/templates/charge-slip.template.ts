import PDFDocument from 'pdfkit';

export const renderChargeSlip = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('Charge Slip', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Patient Name: ${data.patient.firstName} ${data.patient.lastName}`);
    doc.text(`Date of Birth: ${new Date(data.patient.dateOfBirth).toLocaleDateString()}`);
    doc.text(`Sex: ${data.patient.sex}`);
    
    doc.moveDown();
    doc.text('Visit Info:', { underline: true });
    if (data.visit) {
      doc.text(`Visit Date: ${new Date(data.visit.visitDatetime).toLocaleString()}`);
      doc.text(`Visit Type: ${data.visit.visitType}`);
      doc.text(`Services/Problems Addressed:`);
      // Simply print problems if any
      if (data.problems) {
        doc.text(JSON.stringify(data.problems, null, 2));
      }
    } else {
      doc.text('No visit selected.');
    }

    doc.moveDown(2);
    doc.text('Issued by: DAMAYAN EMR');
    doc.text(`Date Issued: ${new Date().toLocaleDateString()}`);
    
    doc.end();
  });
};
