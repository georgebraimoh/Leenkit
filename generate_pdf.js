const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const markdownPath = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\adb8683e-bf84-4e0d-b056-d06f1fb75414\\LEENKIT_PRD.md';
const pdfPath = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\adb8683e-bf84-4e0d-b056-d06f1fb75414\\LEENKIT_PRD.pdf';

const mdText = fs.readFileSync(markdownPath, 'utf8');

const doc = new PDFDocument({
  size: 'A4',
  margin: 45
});

const writeStream = fs.createWriteStream(pdfPath);
doc.pipe(writeStream);

const lines = mdText.split('\n');

lines.forEach(line => {
  const trimmed = line.trim();

  if (!trimmed) {
    doc.moveDown(0.4);
    return;
  }

  if (trimmed.startsWith('# ')) {
    doc.moveDown(0.5);
    doc.fillColor('#18A999').fontSize(22).font('Helvetica-Bold').text(trimmed.replace('# ', ''), { underline: false });
    doc.moveDown(0.3);
  } else if (trimmed.startsWith('## ')) {
    doc.moveDown(0.5);
    doc.fillColor('#172121').fontSize(16).font('Helvetica-Bold').text(trimmed.replace('## ', ''));
    doc.moveDown(0.2);
  } else if (trimmed.startsWith('### ')) {
    doc.moveDown(0.3);
    doc.fillColor('#087F73').fontSize(12).font('Helvetica-Bold').text(trimmed.replace('### ', ''));
    doc.moveDown(0.2);
  } else if (trimmed.startsWith('#### ')) {
    doc.moveDown(0.2);
    doc.fillColor('#3D4948').fontSize(11).font('Helvetica-Bold').text(trimmed.replace('#### ', ''));
    doc.moveDown(0.1);
  } else if (trimmed.startsWith('> ')) {
    doc.fillColor('#18A999').fontSize(10).font('Helvetica-Oblique').text(trimmed.replace('> ', ''), { indent: 15 });
  } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    const text = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '$1');
    doc.fillColor('#333333').fontSize(9.5).font('Helvetica').text('• ' + text, { indent: 10 });
  } else if (/^\d+\.\s/.test(trimmed)) {
    const text = trimmed.replace(/\*\*(.*?)\*\*/g, '$1');
    doc.fillColor('#333333').fontSize(9.5).font('Helvetica').text(text, { indent: 10 });
  } else if (trimmed.startsWith('|')) {
    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length > 0 && !cells[0].includes('---')) {
      doc.fillColor('#444444').fontSize(8.5).font('Helvetica-Bold').text(cells.join('  |  '), { indent: 5 });
    }
  } else {
    const cleanText = trimmed.replace(/\*\*(.*?)\*\*/g, '$1');
    doc.fillColor('#222222').fontSize(9.5).font('Helvetica').text(cleanText);
  }
});

doc.end();

writeStream.on('finish', () => {
  console.log('PDF generated successfully at:', pdfPath);
});
