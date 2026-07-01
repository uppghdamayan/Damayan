import PDFDocument from 'pdfkit';

export const renderLabRequest = async (data: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('Lab Request', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Patient Name: ${data.patient.firstName} ${data.patient.lastName}`);
    doc.text(`Date of Birth: ${new Date(data.patient.dateOfBirth).toLocaleDateString()}`);
    doc.text(`Sex: ${data.patient.sex}`);
    
    doc.moveDown();
    doc.text('Diagnostics Requested:', { underline: true });
    if (data.diagnostics) {
      doc.text(JSON.stringify(data.diagnostics, null, 2));
    } else {
      doc.text('No diagnostics recorded.');
    }

    doc.moveDown(2);
    doc.text('Issued by: DAMAYAN EMR');
    doc.text(`Date Issued: ${new Date().toLocaleDateString()}`);
    
    doc.end();
  });
};
