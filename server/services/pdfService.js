const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const dayjs = require('dayjs');
const { getComplaintTitle } = require('../utils/complaintTitle');

const NAVY = rgb(0.031, 0.169, 0.294); // approx #0B3C5D — matches the frontend's design tokens
const GREY = rgb(0.4, 0.4, 0.4);

async function newDoc() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, font, bold };
}

function drawHeader(page, bold, font, title) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: NAVY });
  page.drawText('State Consumer Disputes Redressal Forum', { x: 40, y: height - 40, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: height - 62, size: 11, font, color: rgb(0.85, 0.88, 0.92) });
  return height - 120;
}

function drawField(page, font, bold, x, y, label, value) {
  page.drawText(label, { x, y, size: 9, font: bold, color: GREY });
  page.drawText(String(value ?? '—'), { x, y: y - 14, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
}

/**
 * Generates a one-page acknowledgment/receipt PDF for a complaint —
 * the document a consumer downloads as proof of filing and current status.
 */
async function generateComplaintReceipt(complaint) {
  const { doc, font, bold } = await newDoc();
  const page = doc.addPage([595.28, 841.89]); // A4
  let y = drawHeader(page, bold, font, 'Complaint Registration Receipt');

  page.drawText(getComplaintTitle(complaint), { x: 40, y, size: 16, font: bold, color: NAVY });
  y -= 22;
  page.drawText(complaint.complaintNumber, { x: 40, y, size: 12, font, color: GREY });
  y -= 36;

  const rows = [
    ['Status', complaint.status.replace(/_/g, ' ')],
    ['Priority', complaint.priority],
    ['Category', complaint.category?.name],
    ['Consumer', complaint.consumer?.name],
    ['Seller / Trader', complaint.sellerName],
    ['Opposite Party', complaint.oppositePartyName],
    ['Complaint Amount', `Rs. ${Number(complaint.complaintAmount).toLocaleString('en-IN')}`],
    ['Court Fee (5% of claim)', `Rs. ${Number(complaint.courtFee || 0).toLocaleString('en-IN')}`],
    ['Filed On', dayjs(complaint.submittedAt).format('DD MMM YYYY, hh:mm A')],
  ];

  for (let i = 0; i < rows.length; i += 2) {
    drawField(page, font, bold, 40, y, rows[i][0], rows[i][1]);
    if (rows[i + 1]) drawField(page, font, bold, 320, y, rows[i + 1][0], rows[i + 1][1]);
    y -= 40;
  }

  y -= 10;
  page.drawText('Description', { x: 40, y, size: 9, font: bold, color: GREY });
  y -= 16;
  const description = complaint.description || '';
  const words = description.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, 10) > 515) {
      page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });

  page.drawText(
    `Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} — this is a system-generated document.`,
    { x: 40, y: 40, size: 8, font, color: GREY }
  );

  return doc.save();
}

/**
 * Generates a hearing notice PDF automatically when a hearing is scheduled —
 * replaces manual notice authoring with an auto-populated document.
 */
async function generateHearingNotice(hearing, complaint) {
  const { doc, font, bold } = await newDoc();
  const page = doc.addPage([595.28, 841.89]);
  let y = drawHeader(page, bold, font, 'Notice of Hearing');

  page.drawText(`Complaint No. ${complaint.complaintNumber}`, { x: 40, y, size: 14, font: bold, color: NAVY });
  y -= 20;
  page.drawText(getComplaintTitle(complaint), { x: 40, y, size: 11, font, color: GREY });
  y -= 30;

  const rows = [
    ['Hearing Date', dayjs(hearing.scheduledDate).format('DD MMM YYYY')],
    ['Hearing Time', hearing.scheduledTime],
    ['Consumer', complaint.consumer?.name],
    ['Opposite Party', complaint.oppositePartyName],
  ];
  for (let i = 0; i < rows.length; i += 2) {
    drawField(page, font, bold, 40, y, rows[i][0], rows[i][1]);
    if (rows[i + 1]) drawField(page, font, bold, 320, y, rows[i + 1][0], rows[i + 1][1]);
    y -= 40;
  }

  y -= 10;
  const notice = 'You are hereby notified to appear before the Forum on the above date and time in connection with the above-referenced complaint. Failure to appear may result in the matter being decided ex-parte.';
  const words = notice.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, 10) > 515) {
      page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });

  page.drawText(
    `This notice was auto-generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} when the hearing was scheduled.`,
    { x: 40, y: 40, size: 8, font, color: GREY }
  );

  return doc.save();
}

/**
 * Generates a downloadable PDF of the AI-assisted (or manually written)
 * complaint synopsis — reuses the same header/styling pipeline as the
 * complaint receipt, per the Feature 2 implementation notes.
 */
async function generateSynopsisPdf(complaint) {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([595.28, 841.89]);
  let y = drawHeader(page, bold, font, 'Formal Complaint Synopsis');

  page.drawText(getComplaintTitle(complaint), { x: 40, y, size: 16, font: bold, color: NAVY });
  y -= 22;
  page.drawText(complaint.complaintNumber, { x: 40, y, size: 12, font, color: GREY });
  y -= 36;

  const text = complaint.synopsisText || '';
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (y < 60) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
    if (!para.trim()) { y -= 10; continue; }
    const isHeading = para === para.toUpperCase() && para.trim().length > 0 && /[A-Z]/.test(para);
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const size = isHeading ? 12 : 10;
      const useFont = isHeading ? bold : font;
      if (useFont.widthOfTextAtSize(test, size) > 515) {
        page.drawText(line, { x: 40, y, size, font: useFont, color: isHeading ? NAVY : rgb(0.2, 0.2, 0.2) });
        y -= isHeading ? 18 : 14;
        line = word;
        if (y < 60) { page = doc.addPage([595.28, 841.89]); y = 800; }
      } else {
        line = test;
      }
    }
    if (line) {
      const size = isHeading ? 12 : 10;
      const useFont = isHeading ? bold : font;
      page.drawText(line, { x: 40, y, size, font: useFont, color: isHeading ? NAVY : rgb(0.2, 0.2, 0.2) });
      y -= isHeading ? 18 : 14;
    }
  }

  page.drawText(
    `Generated on ${dayjs().format('DD MMM YYYY, hh:mm A')} — AI-assisted draft; review before relying on it as a legal document.`,
    { x: 40, y: 40, size: 8, font, color: GREY }
  );

  return doc.save();
}

module.exports = { generateComplaintReceipt, generateHearingNotice, generateSynopsisPdf };
